from django.db.models import Model

from .context import get_audit_context
from .models import AuditEvent, Hospital, Organization, Patient


def resource_public_id(resource: Model | None):
    if resource is None:
        return None
    return getattr(resource, "public_id", None)


def resource_id(resource: Model | None) -> str:
    if resource is None:
        return ""
    return str(getattr(resource, "pk", ""))


def organization_from_resource(resource: Model | None, patient: Patient | None = None) -> Organization | None:
    if resource is not None and getattr(resource, "organization_id", None):
        return resource.organization
    if patient is not None and patient.organization_id:
        return patient.organization
    return None


def hospital_from_resource(resource: Model | None, patient: Patient | None = None) -> Hospital | None:
    if resource is not None and getattr(resource, "hospital_id", None):
        return resource.hospital
    if patient is not None and patient.hospital_id:
        return patient.hospital
    return None


def patient_from_resource(resource: Model | None) -> Patient | None:
    if resource is None:
        return None
    if isinstance(resource, Patient):
        return resource
    if getattr(resource, "patient_id", None):
        return resource.patient
    return None


def record_audit_event(
    *,
    action: str,
    resource: Model | None = None,
    actor=None,
    patient: Patient | None = None,
    organization: Organization | None = None,
    hospital: Hospital | None = None,
    resource_type: str = "",
    metadata: dict | None = None,
    phi_accessed: bool = False,
    success: bool = True,
    risk_level: str = AuditEvent.RiskLevel.LOW,
) -> AuditEvent:
    context = get_audit_context()
    resolved_patient = patient or patient_from_resource(resource)
    resolved_organization = organization or organization_from_resource(resource, resolved_patient)
    resolved_hospital = hospital or hospital_from_resource(resource, resolved_patient)
    resolved_actor = actor if actor and getattr(actor, "is_authenticated", False) else None

    return AuditEvent.objects.create(
        actor=resolved_actor,
        organization=resolved_organization,
        hospital=resolved_hospital,
        patient=resolved_patient,
        action=action,
        resource_type=resource_type or (resource.__class__.__name__ if resource is not None else "Unknown"),
        resource_id=resource_id(resource),
        resource_public_id=resource_public_id(resource),
        request_id=context.request_id if context else "",
        ip_address=context.ip_address if context else None,
        user_agent=context.user_agent if context else "",
        phi_accessed=phi_accessed,
        success=success,
        risk_level=risk_level,
        metadata=metadata or {},
    )
