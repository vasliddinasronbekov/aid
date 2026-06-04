import json
import logging
from dataclasses import dataclass
from typing import Iterable

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone

from .models import AIErrLog, AIAssistantMessage, AIAssistantSession, AnonymousFeedback, MedicalRecord


logger = logging.getLogger(__name__)
HIGH_SEVERITIES = {AIErrLog.Severity.HIGH, AIErrLog.Severity.CRITICAL}
ASSISTANT_RISK_ORDER = {
    AIAssistantMessage.RiskLevel.LOW: 1,
    AIAssistantMessage.RiskLevel.MEDIUM: 2,
    AIAssistantMessage.RiskLevel.HIGH: 3,
    AIAssistantMessage.RiskLevel.CRITICAL: 4,
}

ASSISTANT_RISKS = set(ASSISTANT_RISK_ORDER)
ASSISTANT_STATUSES = {
    AIAssistantSession.SafetyStatus.DRAFT,
    AIAssistantSession.SafetyStatus.ADVISORY,
    AIAssistantSession.SafetyStatus.ESCALATED,
    AIAssistantSession.SafetyStatus.CLOSED,
}


@dataclass(frozen=True)
class ProtocolFinding:
    error_type: str
    severity: str
    rca_description: str
    protocol_reference: str


def group_for_regional_doctors(region_code: str) -> str:
    return f"regional_doctors_{region_code}"


def normalize_text(*parts: str) -> str:
    return " ".join(part.lower() for part in parts if part)


def higher_assistant_risk(current: str, candidate: str) -> str:
    return candidate if ASSISTANT_RISK_ORDER[candidate] > ASSISTANT_RISK_ORDER[current] else current


def analyze_medical_record(record: MedicalRecord) -> list[ProtocolFinding]:
    patient = record.patient
    text = normalize_text(record.diagnosis, record.prescriptions, record.clinical_notes)
    findings: list[ProtocolFinding] = []

    if patient.triage_status == patient.TriageStatus.RED and "vital" not in text:
        findings.append(
            ProtocolFinding(
                error_type=AIErrLog.ErrorType.ENTRY_OMISSION,
                severity=AIErrLog.Severity.HIGH,
                rca_description=(
                    "Red-zone record lacks explicit vital-sign documentation. RCA should check whether the input form "
                    "made vital capture too easy to skip during high-load intake."
                ),
                protocol_reference="MOH-P9-PERINATAL-REDZONE",
            )
        )

    if "preeclampsia" in text and "magnesium" not in text:
        findings.append(
            ProtocolFinding(
                error_type=AIErrLog.ErrorType.PRESCRIPTION_MISMATCH,
                severity=AIErrLog.Severity.CRITICAL,
                rca_description=(
                    "Possible preeclampsia pathway without magnesium-sulfate mention. RCA should inspect protocol "
                    "visibility, order-set availability, and escalation handoff design."
                ),
                protocol_reference="MOH-P6-OBSTETRIC-SAFETY",
            )
        )

    if "antibiotic" in text and "allerg" not in text:
        findings.append(
            ProtocolFinding(
                error_type=AIErrLog.ErrorType.ENTRY_OMISSION,
                severity=AIErrLog.Severity.MEDIUM,
                rca_description=(
                    "Antibiotic plan lacks allergy status. RCA should verify whether the clinical template prompts "
                    "allergy checks before submission."
                ),
                protocol_reference="MOH-P7-BLAMELESS-REPORTING",
            )
        )

    imaging = record.imaging_safety_metadata or {}
    imaging_text = normalize_text(str(imaging.get("notes", "")), str(imaging.get("modality", "")))
    if record.record_type == record.RecordType.IMAGING and "preg" in imaging_text and not imaging.get("consent_confirmed"):
        findings.append(
            ProtocolFinding(
                error_type=AIErrLog.ErrorType.IMAGING_SAFETY,
                severity=AIErrLog.Severity.HIGH,
                rca_description=(
                    "Imaging note suggests pregnancy context without consent confirmation. RCA should examine imaging "
                    "workflow prompts and patient communication safeguards."
                ),
                protocol_reference="MOH-P6-IMAGING-ETHICS",
            )
        )

    if patient.has_severe_chronic_risk and record.discharge_status == record.DischargeStatus.DISCHARGED:
        findings.append(
            ProtocolFinding(
                error_type=AIErrLog.ErrorType.DIGITAL_TWIN_RISK,
                severity=AIErrLog.Severity.HIGH,
                rca_description=(
                    "Digital Twin risk layer detected severe chronic risk at discharge. RCA should review continuity "
                    "planning, regional doctor assignment, and post-discharge monitoring availability."
                ),
                protocol_reference="MOH-P12-DIGITAL-TWIN",
            )
        )

    return findings


def review_record_and_emit(record: MedicalRecord) -> list[AIErrLog]:
    findings = analyze_medical_record(record)
    record.ai_error_logs.all().delete()

    logs = [
        AIErrLog(
            organization=record.organization,
            hospital=record.hospital,
            medical_record=record,
            error_type=finding.error_type,
            severity=finding.severity,
            rca_description=finding.rca_description,
            protocol_reference=finding.protocol_reference,
        )
        for finding in findings
    ]
    created_logs = AIErrLog.objects.bulk_create(logs)

    if not findings:
        status = MedicalRecord.AIReviewStatus.CLEAR
    elif any(finding.severity == AIErrLog.Severity.CRITICAL for finding in findings):
        status = MedicalRecord.AIReviewStatus.CRITICAL
    else:
        status = MedicalRecord.AIReviewStatus.NEEDS_REVIEW

    MedicalRecord.objects.filter(pk=record.pk).update(ai_review_status=status, updated_at=timezone.now())
    record.ai_review_status = status

    critical_logs = [log for log in created_logs if log.severity in HIGH_SEVERITIES]
    if critical_logs:
        transaction.on_commit(lambda: broadcast_critical_ai_error(record, critical_logs))

    return created_logs


def broadcast_active_call_alert(record: MedicalRecord) -> None:
    patient = record.patient
    payload = {
        "medical_record_id": record.id,
        "patient_id": patient.id,
        "patient_name": patient.display_name,
        "triage_status": patient.triage_status,
        "region_code": patient.region_code,
        "department": patient.department,
        "severe_chronic_tags": patient.severe_chronic_tags,
        "biomarkers": patient.chronic_biomarkers,
        "sent_at": timezone.now().isoformat(),
    }
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        group_for_regional_doctors(patient.region_code),
        {"type": "active_call_alert", "payload": payload},
    )
    async_to_sync(layer.group_send)(
        "head_physicians",
        {"type": "active_call_alert", "payload": payload},
    )


def broadcast_critical_ai_error(record: MedicalRecord, logs: Iterable[AIErrLog]) -> None:
    payload = {
        "medical_record_id": record.id,
        "patient_id": record.patient_id,
        "patient_name": record.patient.display_name,
        "doctor_id": record.doctor_id,
        "ai_review_status": record.ai_review_status,
        "errors": [
            {
                "id": log.id,
                "error_type": log.error_type,
                "severity": log.severity,
                "rca_description": log.rca_description,
                "protocol_reference": log.protocol_reference,
            }
            for log in logs
        ],
        "sent_at": timezone.now().isoformat(),
    }
    async_to_sync(get_channel_layer().group_send)(
        "head_physicians",
        {"type": "critical_ai_error", "payload": payload},
    )


def broadcast_feedback_submitted(feedback: AnonymousFeedback) -> None:
    payload = {
        "id": feedback.id,
        "target_type": feedback.target_type,
        "target_staff_profile_id": feedback.target_staff_profile_id,
        "department": feedback.department,
        "room_qr_id": feedback.room_qr_id,
        "rating": feedback.rating,
        "category": feedback.category,
        "severity": feedback.severity,
        "requires_follow_up": feedback.requires_follow_up,
        "has_comment": bool(feedback.comment.strip()),
        "created_at": feedback.created_at.isoformat(),
    }
    async_to_sync(get_channel_layer().group_send)(
        "head_physicians",
        {"type": "feedback_submitted", "payload": payload},
    )


def feedback_summary_queryset(staff_profile=None):
    queryset = AnonymousFeedback.objects.all()
    if staff_profile:
        queryset = queryset.filter(organization_id=staff_profile.organization_id)
    return (
        queryset.values("target_type", "department", "room_qr_id", "target_staff_profile")
        .annotate(avg_rating=Avg("rating"), total=Count("id"))
        .order_by("target_type", "department", "room_qr_id", "target_staff_profile")
    )


def generate_local_ai_assistant_reply(session: AIAssistantSession, user_message: str) -> dict:
    patient = session.patient
    record = session.medical_record
    lines = [
        "AI assistant advisory, not a final medical decision.",
        "Review the evidence, local protocol, and clinician judgement before acting.",
    ]
    metadata: dict = {"mode": session.mode, "checks": []}
    risk_level = AIAssistantMessage.RiskLevel.LOW
    safety_status = AIAssistantSession.SafetyStatus.ADVISORY

    if record:
        findings = analyze_medical_record(record)
        metadata["checks"].append("protocol_review")
        metadata["finding_count"] = len(findings)
        if findings:
            lines.append("")
            lines.append("Protocol signals:")
            for finding in findings[:5]:
                lines.append(f"- {finding.severity}: {finding.rca_description} ({finding.protocol_reference})")
            if any(finding.severity == AIErrLog.Severity.CRITICAL for finding in findings):
                risk_level = AIAssistantMessage.RiskLevel.CRITICAL
                safety_status = AIAssistantSession.SafetyStatus.ESCALATED
            elif any(finding.severity == AIErrLog.Severity.HIGH for finding in findings):
                risk_level = AIAssistantMessage.RiskLevel.HIGH
                safety_status = AIAssistantSession.SafetyStatus.ESCALATED

    if patient:
        metadata["checks"].append("patient_risk_context")
        lines.append("")
        lines.append(f"Patient risk zone: {patient.triage_status}.")
        if patient.has_severe_chronic_risk:
            risk_level = higher_assistant_risk(risk_level, AIAssistantMessage.RiskLevel.HIGH)
            safety_status = AIAssistantSession.SafetyStatus.ESCALATED
            lines.append("Digital Twin signal: severe chronic-risk markers are present; confirm continuity plan and follow-up owner.")
        if patient.severe_chronic_tags:
            lines.append(f"Chronic tags: {', '.join(patient.severe_chronic_tags[:6])}.")

    normalized = user_message.lower()
    if "preeclampsia" in normalized or "eclampsia" in normalized:
        metadata["checks"].append("perinatal_keyword")
        lines.append("")
        lines.append("Perinatal prompt: verify blood pressure trend, urine protein, danger symptoms, magnesium-sulfate pathway, and escalation plan.")
        risk_level = higher_assistant_risk(risk_level, AIAssistantMessage.RiskLevel.HIGH)
        safety_status = AIAssistantSession.SafetyStatus.ESCALATED
    if "discharge" in normalized or "chiqar" in normalized:
        metadata["checks"].append("discharge_readiness")
        lines.append("")
        lines.append("Discharge readiness: check medication reconciliation, red flags, patronage task, regional doctor Active Call, and patient contact route.")
    if session.mode == AIAssistantSession.Mode.RCA_COACH:
        metadata["checks"].append("rca_coach")
        lines.append("")
        lines.append("RCA coach: describe what failed in the system, contributing conditions, recurrence prevention, owner, due date, and evidence of completion.")
    if session.mode == AIAssistantSession.Mode.PATIENT_COMMUNICATION:
        metadata["checks"].append("patient_communication")
        lines.append("")
        lines.append("Patient communication: use plain language, avoid blame, explain next steps, and document consent or refusal.")

    if len(lines) == 2:
        lines.append("")
        lines.append("No high-risk protocol keywords were detected in this short prompt. Add diagnosis, medications, vitals, allergies, and discharge context for a stronger review.")

    return {
        "content": "\n".join(lines),
        "risk_level": risk_level,
        "safety_status": safety_status,
        "metadata": metadata,
    }


def patient_context_for_ai(session: AIAssistantSession) -> dict:
    patient = session.patient
    if not patient:
        return {}
    return {
        "id": patient.id,
        "public_id": str(patient.public_id),
        "display_name": patient.display_name,
        "triage_status": patient.triage_status,
        "gender": patient.gender,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "region_code": patient.region_code,
        "district": patient.district,
        "department": patient.department,
        "severe_chronic_tags": patient.severe_chronic_tags,
        "has_severe_chronic_risk": patient.has_severe_chronic_risk,
        "chronic_biomarkers": patient.chronic_biomarkers,
        "consent_preferences": patient.consent_preferences,
    }


def medical_record_context_for_ai(session: AIAssistantSession) -> dict:
    record = session.medical_record
    if not record:
        return {}
    return {
        "id": record.id,
        "public_id": str(record.public_id),
        "record_type": record.record_type,
        "discharge_status": record.discharge_status,
        "ai_review_status": record.ai_review_status,
        "diagnosis": record.diagnosis,
        "prescriptions": record.prescriptions,
        "clinical_notes": record.clinical_notes,
        "imaging_safety_metadata": record.imaging_safety_metadata,
        "protocol_findings": [
            {
                "error_type": finding.error_type,
                "severity": finding.severity,
                "rca_description": finding.rca_description,
                "protocol_reference": finding.protocol_reference,
            }
            for finding in analyze_medical_record(record)
        ],
    }


def recent_messages_for_ai(session: AIAssistantSession) -> list[dict]:
    messages = list(session.messages.order_by("-created_at")[:8])
    messages.reverse()
    return [
        {
            "role": message.role,
            "risk_level": message.risk_level,
            "content": message.content[:4000],
            "created_at": message.created_at.isoformat(),
        }
        for message in messages
    ]


def openai_assistant_prompt() -> str:
    return (
        "You are AID Clinical AI Assistant inside a healthcare CRM. "
        "You support clinicians and head physicians with non-punitive safety review, RCA, perinatal risk review, "
        "chronic-disease Digital Twin summaries, and patient communication drafting. "
        "You are advisory only and must not present yourself as making a final diagnosis or final treatment decision. "
        "Use concise, practical clinical operations language. "
        "When risks are present, explain the evidence, uncertainty, protocol or workflow reason, and next action. "
        "For medical errors, use blameless language and focus on system causes and recurrence prevention. "
        "Return strict JSON only with these keys: content, risk_level, safety_status, follow_up_actions, protocol_references. "
        "risk_level must be LOW, MEDIUM, HIGH, or CRITICAL. "
        "safety_status must be ADVISORY or ESCALATED."
    )


def build_openai_payload(session: AIAssistantSession, user_message: str, local_reply: dict) -> str:
    payload = {
        "assistant_mode": session.mode,
        "session_title": session.title,
        "user_message": user_message,
        "context_snapshot": session.context_snapshot,
        "patient_context": patient_context_for_ai(session),
        "medical_record_context": medical_record_context_for_ai(session),
        "local_protocol_advisory": local_reply,
        "recent_messages": recent_messages_for_ai(session),
        "response_contract": {
            "content": "Clinician-facing advisory text. Plain text, no markdown tables.",
            "risk_level": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            "safety_status": ["ADVISORY", "ESCALATED"],
            "follow_up_actions": "Array of short action strings.",
            "protocol_references": "Array of protocol/reference strings when relevant.",
        },
    }
    return json.dumps(payload, default=str, ensure_ascii=False)


def output_text_from_openai_response(response) -> str:
    output_text = getattr(response, "output_text", None)
    if output_text:
        return str(output_text).strip()
    return str(response).strip()


def parse_openai_assistant_json(raw_text: str, local_reply: dict) -> dict:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = {"content": raw_text}

    risk_level = parsed.get("risk_level") or local_reply["risk_level"]
    if risk_level not in ASSISTANT_RISKS:
        risk_level = local_reply["risk_level"]

    safety_status = parsed.get("safety_status") or local_reply["safety_status"]
    if safety_status not in ASSISTANT_STATUSES or safety_status == AIAssistantSession.SafetyStatus.DRAFT:
        safety_status = local_reply["safety_status"]

    content = str(parsed.get("content") or raw_text or local_reply["content"]).strip()
    follow_up_actions = parsed.get("follow_up_actions", [])
    protocol_references = parsed.get("protocol_references", [])
    if not isinstance(follow_up_actions, list):
        follow_up_actions = []
    if not isinstance(protocol_references, list):
        protocol_references = []

    return {
        "content": content,
        "risk_level": risk_level,
        "safety_status": safety_status,
        "metadata": {
            **local_reply["metadata"],
            "provider": "openai",
            "model": settings.OPENAI_MODEL,
            "follow_up_actions": follow_up_actions[:8],
            "protocol_references": protocol_references[:8],
        },
    }


def generate_openai_ai_assistant_reply(session: AIAssistantSession, user_message: str, local_reply: dict) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=settings.OPENAI_TIMEOUT_SECONDS)
    response = client.responses.create(
        model=settings.OPENAI_MODEL,
        input=[
            {
                "role": "developer",
                "content": [{"type": "input_text", "text": openai_assistant_prompt()}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": build_openai_payload(session, user_message, local_reply)}],
            },
        ],
        max_output_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
    )
    reply = parse_openai_assistant_json(output_text_from_openai_response(response), local_reply)
    reply["metadata"]["openai_response_id"] = getattr(response, "id", "")
    return reply


def generate_ai_assistant_reply(session: AIAssistantSession, user_message: str) -> dict:
    local_reply = generate_local_ai_assistant_reply(session, user_message)
    if not settings.OPENAI_ASSISTANT_ENABLED:
        local_reply["metadata"]["provider"] = "local"
        local_reply["metadata"]["fallback_reason"] = "openai_disabled"
        return local_reply
    if not settings.OPENAI_API_KEY:
        local_reply["metadata"]["provider"] = "local"
        local_reply["metadata"]["fallback_reason"] = "missing_openai_api_key"
        return local_reply

    try:
        return generate_openai_ai_assistant_reply(session, user_message, local_reply)
    except Exception as exc:
        logger.exception("OpenAI assistant call failed")
        local_reply["metadata"]["provider"] = "local"
        local_reply["metadata"]["fallback_reason"] = "openai_error"
        local_reply["metadata"]["openai_error"] = str(exc)
        return local_reply
