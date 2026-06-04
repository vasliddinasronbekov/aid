from django.conf import settings
from django.db import models, transaction
from django.db.models import Avg, Count, Max
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .audit import record_audit_event
from .models import (
    AIErrLog,
    AIAssistantMessage,
    AIAssistantSession,
    AccessGrant,
    Admission,
    AnonymousFeedback,
    Appointment,
    AuditEvent,
    CareTeamMembership,
    ClinicalTask,
    Department,
    DiagnosticOrder,
    Encounter,
    Hospital,
    MedicalRecord,
    Organization,
    Patient,
    PatientAllergy,
    PatientDuplicateCandidate,
    PatientVital,
    PatronageVisit,
    PerinatalRegistryEntry,
    PhoneVerificationChallenge,
    Referral,
    Room,
    StaffProfile,
)
from .permissions import (
    HasActiveStaffProfile,
    IsClinicalWriter,
    IsGovernanceReader,
    IsOrganizationAdmin,
    IsTenantMember,
    staff_profile_for,
)
from .serializers import (
    AIErrLogSerializer,
    AIAssistantMessageSerializer,
    AIAssistantSessionSerializer,
    AccessGrantSerializer,
    AdmissionSerializer,
    AnonymousFeedbackSerializer,
    AppointmentSerializer,
    AuditEventSerializer,
    CareTeamMembershipSerializer,
    ClinicalTaskSerializer,
    DepartmentSerializer,
    DiagnosticOrderSerializer,
    EncounterSerializer,
    HospitalSerializer,
    MedicalRecordSerializer,
    OrganizationSerializer,
    PatientAllergySerializer,
    PatientDuplicateCandidateSerializer,
    PatientSerializer,
    PatientVitalSerializer,
    PatronageVisitSerializer,
    PerinatalRegistryEntrySerializer,
    PhoneVerificationRequestSerializer,
    PhoneVerificationVerifySerializer,
    ReferralSerializer,
    RoomSerializer,
    StaffProfileSerializer,
)
from .services import (
    broadcast_feedback_submitted,
    feedback_summary_queryset,
    generate_ai_assistant_reply,
    review_record_and_emit,
)


class TenantScopedQuerysetMixin:
    def get_staff_profile(self):
        return staff_profile_for(self.request.user)

    def scope_queryset(self, queryset):
        user = self.request.user
        if user.is_superuser:
            return queryset

        profile = self.get_staff_profile()
        if not profile:
            return queryset.none()

        model = queryset.model
        if model is Organization:
            return queryset.filter(id=profile.organization_id)
        if model is AccessGrant:
            return queryset.filter(staff_profile__organization_id=profile.organization_id)
        if hasattr(model, "organization"):
            return queryset.filter(organization_id=profile.organization_id)
        return queryset

    def get_queryset(self):
        return self.scope_queryset(super().get_queryset())

    def tenant_defaults(self) -> dict:
        profile = self.get_staff_profile()
        if not profile:
            return {}
        defaults = {"organization": profile.organization}
        if profile.primary_hospital_id:
            defaults["hospital"] = profile.primary_hospital
        return defaults


class AuditReadMixin:
    audit_phi_accessed = False
    audit_resource_type = ""

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        profile = staff_profile_for(request.user)
        record_audit_event(
            action=AuditEvent.Action.READ,
            actor=request.user,
            organization=profile.organization if profile else None,
            resource_type=self.audit_resource_type or self.get_queryset().model.__name__,
            metadata={"operation": "list", "view": self.__class__.__name__},
            phi_accessed=self.audit_phi_accessed,
        )
        return response

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        response = super().retrieve(request, *args, **kwargs)
        record_audit_event(
            action=AuditEvent.Action.READ,
            actor=request.user,
            resource=instance,
            metadata={"operation": "retrieve", "view": self.__class__.__name__},
            phi_accessed=self.audit_phi_accessed,
        )
        return response


def ensure_patient_in_request_tenant(user, patient: Patient) -> None:
    if user.is_superuser:
        return
    profile = staff_profile_for(user)
    if not profile or patient.organization_id != profile.organization_id:
        raise PermissionDenied("Patient is outside the user's organization.")


def ensure_staff_profile_in_request_tenant(user, profile: StaffProfile | None) -> None:
    if profile is None or user.is_superuser:
        return
    requester_profile = staff_profile_for(user)
    if not requester_profile or profile.organization_id != requester_profile.organization_id:
        raise PermissionDenied("Staff profile is outside the user's organization.")


def patient_from_clinical_links(validated_data: dict, instance=None) -> Patient | None:
    patient = validated_data.get("patient")
    if patient:
        return patient
    encounter = validated_data.get("encounter", getattr(instance, "encounter", None))
    if encounter:
        return encounter.patient
    appointment = validated_data.get("appointment", getattr(instance, "appointment", None))
    if appointment:
        return appointment.patient
    if instance is not None:
        return getattr(instance, "patient", None)
    return None


class OrganizationViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsOrganizationAdmin]

    def perform_create(self, serializer):
        organization = serializer.save()
        record_audit_event(action=AuditEvent.Action.CREATE, actor=self.request.user, resource=organization)

    def perform_update(self, serializer):
        organization = serializer.save()
        record_audit_event(action=AuditEvent.Action.UPDATE, actor=self.request.user, resource=organization)


class HospitalViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = Hospital.objects.select_related("organization")
    serializer_class = HospitalSerializer
    permission_classes = [IsOrganizationAdmin]

    def perform_create(self, serializer):
        defaults = {}
        if "organization" not in serializer.validated_data:
            defaults.update(self.tenant_defaults())
        hospital = serializer.save(**defaults)
        record_audit_event(action=AuditEvent.Action.CREATE, actor=self.request.user, resource=hospital)

    def perform_update(self, serializer):
        hospital = serializer.save()
        record_audit_event(action=AuditEvent.Action.UPDATE, actor=self.request.user, resource=hospital)


class DepartmentViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = Department.objects.select_related("organization", "hospital")
    serializer_class = DepartmentSerializer
    permission_classes = [IsOrganizationAdmin]

    def perform_create(self, serializer):
        hospital = serializer.validated_data.get("hospital")
        defaults = {"organization": hospital.organization} if hospital and "organization" not in serializer.validated_data else {}
        department = serializer.save(**defaults)
        record_audit_event(action=AuditEvent.Action.CREATE, actor=self.request.user, resource=department)

    def perform_update(self, serializer):
        department = serializer.save()
        record_audit_event(action=AuditEvent.Action.UPDATE, actor=self.request.user, resource=department)


class RoomViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = Room.objects.select_related("organization", "hospital", "department")
    serializer_class = RoomSerializer
    permission_classes = [IsOrganizationAdmin]

    def perform_create(self, serializer):
        department = serializer.validated_data.get("department")
        defaults = {}
        if department:
            defaults = {
                "organization": serializer.validated_data.get("organization") or department.organization,
                "hospital": serializer.validated_data.get("hospital") or department.hospital,
            }
        room = serializer.save(**defaults)
        record_audit_event(action=AuditEvent.Action.CREATE, actor=self.request.user, resource=room)

    def perform_update(self, serializer):
        room = serializer.save()
        record_audit_event(action=AuditEvent.Action.UPDATE, actor=self.request.user, resource=room)


class StaffProfileViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = StaffProfile.objects.select_related("user", "organization", "primary_hospital").prefetch_related("departments")
    serializer_class = StaffProfileSerializer
    permission_classes = [IsOrganizationAdmin]

    def perform_create(self, serializer):
        profile = serializer.save()
        record_audit_event(action=AuditEvent.Action.CREATE, actor=self.request.user, resource=profile)

    def perform_update(self, serializer):
        profile = serializer.save()
        record_audit_event(action=AuditEvent.Action.UPDATE, actor=self.request.user, resource=profile)


class AccessGrantViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = AccessGrant.objects.select_related(
        "staff_profile",
        "staff_profile__user",
        "staff_profile__organization",
        "hospital",
        "department",
        "room",
    )
    serializer_class = AccessGrantSerializer
    permission_classes = [IsOrganizationAdmin]

    def perform_create(self, serializer):
        grant = serializer.save(granted_by=self.request.user if self.request.user.is_authenticated else None)
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=grant.staff_profile,
            metadata={"access_grant_id": grant.id, "scope": grant.scope},
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        grant = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=grant.staff_profile,
            metadata={"access_grant_id": grant.id, "scope": grant.scope, "revoked_at": str(grant.revoked_at or "")},
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )


class PatientViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = Patient.objects.select_related("organization", "hospital", "department_ref", "room")
    serializer_class = PatientSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        region_code = self.request.query_params.get("region_code")
        triage_status = self.request.query_params.get("triage_status")
        hospital = self.request.query_params.get("hospital")
        department_ref = self.request.query_params.get("department_ref")
        if region_code:
            queryset = queryset.filter(region_code=region_code)
        if triage_status:
            queryset = queryset.filter(triage_status=triage_status.upper())
        if hospital:
            queryset = queryset.filter(hospital_id=hospital)
        if department_ref:
            queryset = queryset.filter(department_ref_id=department_ref)
        return queryset

    def perform_create(self, serializer):
        defaults = {}
        if "organization" not in serializer.validated_data:
            defaults.update(self.tenant_defaults())
        patient = serializer.save(**defaults)
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=patient,
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=patient,
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    @action(detail=True, methods=["post"], url_path="sync-biomarkers")
    def sync_biomarkers(self, request, pk=None):
        patient = self.get_object()
        biomarkers = request.data.get("chronic_biomarkers")
        if not isinstance(biomarkers, dict):
            return Response({"detail": "chronic_biomarkers must be an object."}, status=status.HTTP_400_BAD_REQUEST)

        patient.chronic_biomarkers = {**patient.chronic_biomarkers, **biomarkers}
        patient.mark_biomarker_sync()
        patient.save(update_fields=["chronic_biomarkers", "last_marker_sync_at", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=patient,
            metadata={"operation": "sync_biomarkers", "keys": sorted(biomarkers.keys())},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        return Response(self.get_serializer(patient).data)

    @action(detail=True, methods=["get"])
    def chart(self, request, pk=None):
        patient = self.get_object()
        appointments = patient.appointments.select_related(
            "organization",
            "hospital",
            "department_ref",
            "room",
            "patient",
            "assigned_provider",
            "created_by",
        ).order_by("-scheduled_start")[:20]
        encounters = patient.encounters.select_related(
            "organization",
            "hospital",
            "department_ref",
            "room",
            "patient",
            "appointment",
            "provider",
        ).order_by("-started_at")[:20]
        vitals = patient.vitals.select_related("patient", "encounter", "organization", "hospital", "recorded_by").order_by(
            "-measured_at"
        )[:30]
        allergies = patient.allergies.select_related("patient", "organization", "hospital", "recorded_by").order_by(
            "status",
            "allergen",
        )
        medical_records = patient.medical_records.select_related(
            "organization",
            "hospital",
            "department_ref",
            "patient",
            "attending_provider",
        ).prefetch_related("ai_error_logs")[:20]
        care_team = patient.care_team_memberships.select_related(
            "patient",
            "staff_profile",
            "staff_profile__user",
            "organization",
            "hospital",
        ).order_by("-is_primary", "role", "staff_profile__user__last_name")
        tasks = patient.clinical_tasks.select_related(
            "organization",
            "hospital",
            "department_ref",
            "patient",
            "encounter",
            "appointment",
            "assigned_to",
            "assigned_to__user",
            "created_by",
        ).order_by("status", "due_at")[:30]
        referrals = patient.referrals.select_related(
            "organization",
            "hospital",
            "patient",
            "encounter",
            "source_department",
            "target_hospital",
            "target_department",
            "requested_by",
            "assigned_to",
            "assigned_to__user",
        ).order_by("status", "-requested_at")[:20]
        diagnostic_orders = patient.diagnostic_orders.select_related(
            "organization",
            "hospital",
            "department_ref",
            "patient",
            "encounter",
            "ordered_by",
        ).order_by("status", "-created_at")[:30]
        admissions = patient.admissions.select_related(
            "organization",
            "hospital",
            "patient",
            "encounter",
            "referral",
            "requested_by",
            "admitting_provider",
            "department_ref",
            "room",
        ).order_by("status", "-requested_at")[:10]
        perinatal_entries = patient.perinatal_registry_entries.select_related(
            "patient",
            "organization",
            "hospital",
            "department_ref",
            "assigned_provider",
        ).order_by("status", "risk_level", "next_visit_at")[:10]
        patronage_visits = patient.patronage_visits.select_related(
            "organization",
            "hospital",
            "patient",
            "assigned_to",
            "assigned_to__user",
            "created_by",
        ).order_by("status", "scheduled_for")[:20]
        duplicate_candidates = PatientDuplicateCandidate.objects.select_related(
            "organization",
            "hospital",
            "primary_patient",
            "duplicate_patient",
            "reviewed_by",
        ).filter(models.Q(primary_patient=patient) | models.Q(duplicate_patient=patient)).order_by("status", "-score")[:20]

        record_audit_event(
            action=AuditEvent.Action.READ,
            actor=request.user,
            resource=patient,
            metadata={"operation": "patient_chart"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        return Response(
            {
                "patient": PatientSerializer(patient, context=self.get_serializer_context()).data,
                "appointments": AppointmentSerializer(appointments, many=True, context=self.get_serializer_context()).data,
                "encounters": EncounterSerializer(encounters, many=True, context=self.get_serializer_context()).data,
                "vitals": PatientVitalSerializer(vitals, many=True, context=self.get_serializer_context()).data,
                "allergies": PatientAllergySerializer(allergies, many=True, context=self.get_serializer_context()).data,
                "medical_records": MedicalRecordSerializer(medical_records, many=True, context=self.get_serializer_context()).data,
                "care_team": CareTeamMembershipSerializer(care_team, many=True, context=self.get_serializer_context()).data,
                "tasks": ClinicalTaskSerializer(tasks, many=True, context=self.get_serializer_context()).data,
                "referrals": ReferralSerializer(referrals, many=True, context=self.get_serializer_context()).data,
                "diagnostic_orders": DiagnosticOrderSerializer(
                    diagnostic_orders,
                    many=True,
                    context=self.get_serializer_context(),
                ).data,
                "admissions": AdmissionSerializer(admissions, many=True, context=self.get_serializer_context()).data,
                "perinatal_registry": PerinatalRegistryEntrySerializer(
                    perinatal_entries,
                    many=True,
                    context=self.get_serializer_context(),
                ).data,
                "patronage_visits": PatronageVisitSerializer(
                    patronage_visits,
                    many=True,
                    context=self.get_serializer_context(),
                ).data,
                "duplicate_candidates": PatientDuplicateCandidateSerializer(
                    duplicate_candidates,
                    many=True,
                    context=self.get_serializer_context(),
                ).data,
            }
        )


class MedicalRecordViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = MedicalRecord.objects.select_related(
        "organization",
        "hospital",
        "department_ref",
        "patient",
        "attending_provider",
    ).prefetch_related("ai_error_logs")
    serializer_class = MedicalRecordSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        doctor_id = self.request.query_params.get("doctor_id")
        ai_review_status = self.request.query_params.get("ai_review_status")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if doctor_id:
            queryset = queryset.filter(doctor_id=doctor_id)
        if ai_review_status:
            queryset = queryset.filter(ai_review_status=ai_review_status.upper())
        return queryset

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        defaults = {
            "organization": serializer.validated_data.get("organization") or patient.organization,
            "hospital": serializer.validated_data.get("hospital") or patient.hospital,
            "department_ref": serializer.validated_data.get("department_ref") or patient.department_ref,
        }
        if self.request.user.is_authenticated and "attending_provider" not in serializer.validated_data:
            defaults["attending_provider"] = self.request.user
        record = serializer.save(**defaults)
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=record,
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        review_record_and_emit(record)

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        record = serializer.save(ai_review_status=MedicalRecord.AIReviewStatus.PENDING)
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=record,
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        review_record_and_emit(record)

    @action(detail=True, methods=["post"])
    def discharge(self, request, pk=None):
        record = self.get_object()
        with transaction.atomic():
            record.record_type = MedicalRecord.RecordType.DISCHARGE
            record.discharge_status = MedicalRecord.DischargeStatus.DISCHARGED
            if request.data.get("clinical_notes"):
                record.clinical_notes = request.data["clinical_notes"]
            record.save(update_fields=["record_type", "discharge_status", "clinical_notes", "updated_at"])
            record_audit_event(
                action=AuditEvent.Action.DISCHARGE,
                actor=request.user,
                resource=record,
                phi_accessed=True,
                risk_level=AuditEvent.RiskLevel.CRITICAL if record.patient.has_severe_chronic_risk else AuditEvent.RiskLevel.HIGH,
            )
            review_record_and_emit(record)

        serializer = self.get_serializer(record)
        return Response(serializer.data)


class AppointmentViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related(
        "organization",
        "hospital",
        "department_ref",
        "room",
        "patient",
        "assigned_provider",
        "created_by",
    )
    serializer_class = AppointmentSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        status_filter = self.request.query_params.get("status")
        assigned_provider = self.request.query_params.get("assigned_provider")
        hospital = self.request.query_params.get("hospital")
        department_ref = self.request.query_params.get("department_ref")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if assigned_provider:
            queryset = queryset.filter(assigned_provider_id=assigned_provider)
        if hospital:
            queryset = queryset.filter(hospital_id=hospital)
        if department_ref:
            queryset = queryset.filter(department_ref_id=department_ref)
        if date_from:
            queryset = queryset.filter(scheduled_start__gte=date_from)
        if date_to:
            queryset = queryset.filter(scheduled_start__lte=date_to)
        return queryset

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        defaults = {
            "organization": serializer.validated_data.get("organization") or patient.organization,
            "hospital": serializer.validated_data.get("hospital") or patient.hospital,
            "department_ref": serializer.validated_data.get("department_ref") or patient.department_ref,
            "room": serializer.validated_data.get("room") or patient.room,
            "created_by": self.request.user if self.request.user.is_authenticated else None,
        }
        if self.request.user.is_authenticated and "assigned_provider" not in serializer.validated_data:
            defaults["assigned_provider"] = self.request.user
        appointment = serializer.save(**defaults)
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=appointment,
            metadata={"operation": "appointment_create", "status": appointment.status},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        appointment = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=appointment,
            metadata={"operation": "appointment_update", "status": appointment.status},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    def _get_or_create_encounter(self, appointment: Appointment, request) -> Encounter:
        encounter_type = Encounter.EncounterType.OUTPATIENT
        if appointment.appointment_type == Appointment.AppointmentType.PATRONAGE:
            encounter_type = Encounter.EncounterType.HOME_VISIT
        elif appointment.appointment_type == Appointment.AppointmentType.PERINATAL:
            encounter_type = Encounter.EncounterType.PERINATAL
        elif appointment.appointment_type == Appointment.AppointmentType.EMERGENCY:
            encounter_type = Encounter.EncounterType.EMERGENCY

        encounter, _ = Encounter.objects.get_or_create(
            appointment=appointment,
            defaults={
                "organization": appointment.organization,
                "hospital": appointment.hospital,
                "department_ref": appointment.department_ref,
                "room": appointment.room,
                "patient": appointment.patient,
                "provider": appointment.assigned_provider or (request.user if request.user.is_authenticated else None),
                "encounter_type": encounter_type,
                "chief_complaint": appointment.reason,
            },
        )
        return encounter

    def _transition_response(self, appointment: Appointment, encounter: Encounter | None = None):
        payload = {"appointment": self.get_serializer(appointment).data}
        if encounter:
            payload["encounter"] = EncounterSerializer(encounter, context=self.get_serializer_context()).data
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status in {Appointment.Status.COMPLETED, Appointment.Status.CANCELLED}:
            return Response({"detail": "Completed or cancelled appointments cannot be checked in."}, status=status.HTTP_409_CONFLICT)

        appointment.status = Appointment.Status.CHECKED_IN
        appointment.checked_in_at = appointment.checked_in_at or timezone.now()
        appointment.save(update_fields=["status", "checked_in_at", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=appointment,
            metadata={"operation": "appointment_check_in"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return self._transition_response(appointment)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status in {Appointment.Status.COMPLETED, Appointment.Status.CANCELLED, Appointment.Status.NO_SHOW}:
            return Response({"detail": "This appointment cannot be started."}, status=status.HTTP_409_CONFLICT)

        with transaction.atomic():
            appointment.status = Appointment.Status.IN_PROGRESS
            appointment.checked_in_at = appointment.checked_in_at or timezone.now()
            appointment.save(update_fields=["status", "checked_in_at", "updated_at"])
            encounter = self._get_or_create_encounter(appointment, request)
            if encounter.status == Encounter.Status.CANCELLED:
                encounter.status = Encounter.Status.OPEN
                encounter.ended_at = None
                encounter.save(update_fields=["status", "ended_at", "updated_at"])
            record_audit_event(
                action=AuditEvent.Action.UPDATE,
                actor=request.user,
                resource=appointment,
                metadata={"operation": "appointment_start", "encounter_id": encounter.id},
                phi_accessed=True,
                risk_level=AuditEvent.RiskLevel.HIGH,
            )
        return self._transition_response(appointment, encounter)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status == Appointment.Status.CANCELLED:
            return Response({"detail": "Cancelled appointments cannot be completed."}, status=status.HTTP_409_CONFLICT)

        with transaction.atomic():
            appointment.status = Appointment.Status.COMPLETED
            appointment.completed_at = appointment.completed_at or timezone.now()
            appointment.save(update_fields=["status", "completed_at", "updated_at"])
            encounter = self._get_or_create_encounter(appointment, request)
            if request.data.get("assessment") is not None:
                encounter.assessment = request.data.get("assessment", "")
            if request.data.get("plan") is not None:
                encounter.plan = request.data.get("plan", "")
            if encounter.status == Encounter.Status.OPEN:
                encounter.status = Encounter.Status.SIGNED
                encounter.ended_at = encounter.ended_at or appointment.completed_at
            encounter.save(update_fields=["assessment", "plan", "status", "ended_at", "updated_at"])
            record_audit_event(
                action=AuditEvent.Action.UPDATE,
                actor=request.user,
                resource=appointment,
                metadata={"operation": "appointment_complete", "encounter_id": encounter.id},
                phi_accessed=True,
                risk_level=AuditEvent.RiskLevel.HIGH,
            )
        return self._transition_response(appointment, encounter)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status == Appointment.Status.COMPLETED:
            return Response({"detail": "Completed appointments cannot be cancelled."}, status=status.HTTP_409_CONFLICT)

        appointment.status = Appointment.Status.CANCELLED
        appointment.cancelled_at = appointment.cancelled_at or timezone.now()
        appointment.cancel_reason = request.data.get("cancel_reason", appointment.cancel_reason)
        appointment.save(update_fields=["status", "cancelled_at", "cancel_reason", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=appointment,
            metadata={"operation": "appointment_cancel"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return self._transition_response(appointment)

    @action(detail=True, methods=["post"], url_path="no-show")
    def no_show(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status in {Appointment.Status.COMPLETED, Appointment.Status.CANCELLED}:
            return Response({"detail": "Completed or cancelled appointments cannot be marked no-show."}, status=status.HTTP_409_CONFLICT)

        appointment.status = Appointment.Status.NO_SHOW
        appointment.notes = request.data.get("notes", appointment.notes)
        appointment.save(update_fields=["status", "notes", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=appointment,
            metadata={"operation": "appointment_no_show"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return self._transition_response(appointment)

    @action(detail=True, methods=["post"])
    def reschedule(self, request, pk=None):
        appointment = self.get_object()
        if not request.data.get("scheduled_start"):
            return Response({"detail": "scheduled_start is required."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(
            appointment,
            data={
                "scheduled_start": request.data.get("scheduled_start"),
                "scheduled_end": request.data.get("scheduled_end"),
                "status": Appointment.Status.SCHEDULED,
            },
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        appointment.scheduled_start = serializer.validated_data["scheduled_start"]
        appointment.scheduled_end = serializer.validated_data.get("scheduled_end")
        appointment.status = Appointment.Status.SCHEDULED
        appointment.checked_in_at = None
        appointment.completed_at = None
        appointment.cancelled_at = None
        appointment.cancel_reason = ""
        appointment.save(
            update_fields=[
                "scheduled_start",
                "scheduled_end",
                "status",
                "checked_in_at",
                "completed_at",
                "cancelled_at",
                "cancel_reason",
                "updated_at",
            ]
        )
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=appointment,
            metadata={"operation": "appointment_reschedule"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return self._transition_response(appointment)


class EncounterViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = Encounter.objects.select_related(
        "organization",
        "hospital",
        "department_ref",
        "room",
        "patient",
        "appointment",
        "provider",
    )
    serializer_class = EncounterSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        appointment_id = self.request.query_params.get("appointment")
        provider = self.request.query_params.get("provider")
        status_filter = self.request.query_params.get("status")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if appointment_id:
            queryset = queryset.filter(appointment_id=appointment_id)
        if provider:
            queryset = queryset.filter(provider_id=provider)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if date_from:
            queryset = queryset.filter(started_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(started_at__lte=date_to)
        return queryset

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        defaults = {
            "organization": serializer.validated_data.get("organization") or patient.organization,
            "hospital": serializer.validated_data.get("hospital") or patient.hospital,
            "department_ref": serializer.validated_data.get("department_ref") or patient.department_ref,
            "room": serializer.validated_data.get("room") or patient.room,
        }
        if self.request.user.is_authenticated and "provider" not in serializer.validated_data:
            defaults["provider"] = self.request.user
        encounter = serializer.save(**defaults)
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=encounter,
            metadata={"operation": "encounter_create", "status": encounter.status},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        encounter = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=encounter,
            metadata={"operation": "encounter_update", "status": encounter.status},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )

    @action(detail=True, methods=["post"])
    def sign(self, request, pk=None):
        encounter = self.get_object()
        if encounter.status == Encounter.Status.CANCELLED:
            return Response({"detail": "Cancelled encounters cannot be signed."}, status=status.HTTP_409_CONFLICT)

        encounter.status = Encounter.Status.SIGNED
        encounter.ended_at = encounter.ended_at or timezone.now()
        if request.data.get("assessment") is not None:
            encounter.assessment = request.data.get("assessment", "")
        if request.data.get("plan") is not None:
            encounter.plan = request.data.get("plan", "")
        encounter.save(update_fields=["status", "ended_at", "assessment", "plan", "updated_at"])

        if encounter.appointment_id and encounter.appointment.status != Appointment.Status.COMPLETED:
            encounter.appointment.status = Appointment.Status.COMPLETED
            encounter.appointment.completed_at = encounter.appointment.completed_at or encounter.ended_at
            encounter.appointment.save(update_fields=["status", "completed_at", "updated_at"])

        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=encounter,
            metadata={"operation": "encounter_sign"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        return Response(self.get_serializer(encounter).data)


class PatientVitalViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = PatientVital.objects.select_related("patient", "encounter", "organization", "hospital", "recorded_by")
    serializer_class = PatientVitalSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        encounter_id = self.request.query_params.get("encounter")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if encounter_id:
            queryset = queryset.filter(encounter_id=encounter_id)
        if date_from:
            queryset = queryset.filter(measured_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(measured_at__lte=date_to)
        return queryset

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        vital = serializer.save(
            organization=serializer.validated_data.get("organization") or patient.organization,
            hospital=serializer.validated_data.get("hospital") or patient.hospital,
            recorded_by=self.request.user if self.request.user.is_authenticated else None,
        )
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=vital,
            metadata={"operation": "patient_vital_create"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        vital = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=vital,
            metadata={"operation": "patient_vital_update"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )


class PatientAllergyViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = PatientAllergy.objects.select_related("patient", "organization", "hospital", "recorded_by")
    serializer_class = PatientAllergySerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        status_filter = self.request.query_params.get("status")
        severity = self.request.query_params.get("severity")
        active = self.request.query_params.get("active")

        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if severity:
            queryset = queryset.filter(severity=severity.upper())
        if active in {"true", "false"}:
            queryset = queryset.filter(status=PatientAllergy.Status.ACTIVE if active == "true" else PatientAllergy.Status.INACTIVE)
        return queryset

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        allergy = serializer.save(
            organization=serializer.validated_data.get("organization") or patient.organization,
            hospital=serializer.validated_data.get("hospital") or patient.hospital,
            recorded_by=self.request.user if self.request.user.is_authenticated else None,
        )
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=allergy,
            metadata={"operation": "patient_allergy_create", "severity": allergy.severity},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if allergy.severity == PatientAllergy.Severity.LIFE_THREATENING else AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        allergy = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=allergy,
            metadata={"operation": "patient_allergy_update", "severity": allergy.severity, "status": allergy.status},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if allergy.severity == PatientAllergy.Severity.LIFE_THREATENING else AuditEvent.RiskLevel.MEDIUM,
        )


class CareTeamMembershipViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = CareTeamMembership.objects.select_related(
        "patient",
        "staff_profile",
        "staff_profile__user",
        "organization",
        "hospital",
    )
    serializer_class = CareTeamMembershipSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        staff_profile = self.request.query_params.get("staff_profile")
        role = self.request.query_params.get("role")
        active = self.request.query_params.get("active")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if staff_profile:
            queryset = queryset.filter(staff_profile_id=staff_profile)
        if role:
            queryset = queryset.filter(role=role.upper())
        if active == "true":
            queryset = queryset.filter(starts_at__lte=timezone.now()).filter(models.Q(ends_at__isnull=True) | models.Q(ends_at__gt=timezone.now()))
        return queryset

    def _clear_primary(self, membership: CareTeamMembership) -> None:
        if membership.is_primary:
            CareTeamMembership.objects.filter(
                patient=membership.patient,
                role=membership.role,
                is_primary=True,
            ).exclude(id=membership.id).update(is_primary=False)

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        staff_profile = serializer.validated_data["staff_profile"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        ensure_staff_profile_in_request_tenant(self.request.user, staff_profile)
        membership = serializer.save(
            organization=serializer.validated_data.get("organization") or patient.organization,
            hospital=serializer.validated_data.get("hospital") or patient.hospital,
        )
        self._clear_primary(membership)
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=membership,
            metadata={"operation": "care_team_add", "role": membership.role, "staff_profile_id": membership.staff_profile_id},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        staff_profile = serializer.validated_data.get("staff_profile", serializer.instance.staff_profile)
        ensure_patient_in_request_tenant(self.request.user, patient)
        ensure_staff_profile_in_request_tenant(self.request.user, staff_profile)
        membership = serializer.save()
        self._clear_primary(membership)
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=membership,
            metadata={"operation": "care_team_update", "role": membership.role, "staff_profile_id": membership.staff_profile_id},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        membership = self.get_object()
        membership.ends_at = membership.ends_at or timezone.now()
        membership.is_primary = False
        membership.save(update_fields=["ends_at", "is_primary", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=membership,
            metadata={"operation": "care_team_deactivate"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(membership).data)

    @action(detail=True, methods=["post"], url_path="set-primary")
    def set_primary(self, request, pk=None):
        membership = self.get_object()
        membership.is_primary = True
        membership.ends_at = None
        membership.save(update_fields=["is_primary", "ends_at", "updated_at"])
        self._clear_primary(membership)
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=membership,
            metadata={"operation": "care_team_set_primary", "role": membership.role},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(membership).data)


class ClinicalTaskViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = ClinicalTask.objects.select_related(
        "organization",
        "hospital",
        "department_ref",
        "patient",
        "encounter",
        "appointment",
        "assigned_to",
        "assigned_to__user",
        "created_by",
    )
    serializer_class = ClinicalTaskSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        assigned_to = self.request.query_params.get("assigned_to")
        status_filter = self.request.query_params.get("status")
        priority = self.request.query_params.get("priority")
        task_type = self.request.query_params.get("task_type")
        due_before = self.request.query_params.get("due_before")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if priority:
            queryset = queryset.filter(priority=priority.upper())
        if task_type:
            queryset = queryset.filter(task_type=task_type.upper())
        if due_before:
            queryset = queryset.filter(due_at__lte=due_before)
        return queryset

    def perform_create(self, serializer):
        patient = patient_from_clinical_links(serializer.validated_data)
        if patient:
            ensure_patient_in_request_tenant(self.request.user, patient)
        ensure_staff_profile_in_request_tenant(self.request.user, serializer.validated_data.get("assigned_to"))
        defaults = {"created_by": self.request.user if self.request.user.is_authenticated else None}
        if patient:
            defaults.update(
                {
                    "organization": serializer.validated_data.get("organization") or patient.organization,
                    "hospital": serializer.validated_data.get("hospital") or patient.hospital,
                    "department_ref": serializer.validated_data.get("department_ref") or patient.department_ref,
                    "patient": serializer.validated_data.get("patient") or patient,
                }
            )
        task = serializer.save(**defaults)
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=task,
            metadata={"operation": "clinical_task_create", "status": task.status, "priority": task.priority},
            phi_accessed=bool(task.patient_id),
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = patient_from_clinical_links(serializer.validated_data, serializer.instance)
        if patient:
            ensure_patient_in_request_tenant(self.request.user, patient)
        ensure_staff_profile_in_request_tenant(
            self.request.user,
            serializer.validated_data.get("assigned_to", serializer.instance.assigned_to),
        )
        task = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=task,
            metadata={"operation": "clinical_task_update", "status": task.status, "priority": task.priority},
            phi_accessed=bool(task.patient_id),
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        task = self.get_object()
        if task.status in {ClinicalTask.Status.COMPLETED, ClinicalTask.Status.CANCELLED}:
            return Response({"detail": "Completed or cancelled tasks cannot be started."}, status=status.HTTP_409_CONFLICT)
        task.status = ClinicalTask.Status.IN_PROGRESS
        task.started_at = task.started_at or timezone.now()
        task.save(update_fields=["status", "started_at", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=task,
            metadata={"operation": "clinical_task_start"},
            phi_accessed=bool(task.patient_id),
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.status == ClinicalTask.Status.CANCELLED:
            return Response({"detail": "Cancelled tasks cannot be completed."}, status=status.HTTP_409_CONFLICT)
        task.status = ClinicalTask.Status.COMPLETED
        task.completed_at = task.completed_at or timezone.now()
        task.completion_note = request.data.get("completion_note", task.completion_note)
        task.save(update_fields=["status", "completed_at", "completion_note", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=task,
            metadata={"operation": "clinical_task_complete"},
            phi_accessed=bool(task.patient_id),
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        task = self.get_object()
        if task.status == ClinicalTask.Status.COMPLETED:
            return Response({"detail": "Completed tasks cannot be cancelled."}, status=status.HTTP_409_CONFLICT)
        task.status = ClinicalTask.Status.CANCELLED
        task.cancelled_at = task.cancelled_at or timezone.now()
        task.completion_note = request.data.get("completion_note", task.completion_note)
        task.save(update_fields=["status", "cancelled_at", "completion_note", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=task,
            metadata={"operation": "clinical_task_cancel"},
            phi_accessed=bool(task.patient_id),
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(task).data)


class ReferralViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = Referral.objects.select_related(
        "organization",
        "hospital",
        "patient",
        "encounter",
        "source_department",
        "target_hospital",
        "target_department",
        "requested_by",
        "assigned_to",
        "assigned_to__user",
    )
    serializer_class = ReferralSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        status_filter = self.request.query_params.get("status")
        referral_type = self.request.query_params.get("referral_type")
        target_department = self.request.query_params.get("target_department")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if referral_type:
            queryset = queryset.filter(referral_type=referral_type.upper())
        if target_department:
            queryset = queryset.filter(target_department_id=target_department)
        return queryset

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        ensure_staff_profile_in_request_tenant(self.request.user, serializer.validated_data.get("assigned_to"))
        referral = serializer.save(
            organization=serializer.validated_data.get("organization") or patient.organization,
            hospital=serializer.validated_data.get("hospital") or patient.hospital,
            source_department=serializer.validated_data.get("source_department") or patient.department_ref,
            requested_by=self.request.user if self.request.user.is_authenticated else None,
        )
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=referral,
            metadata={"operation": "referral_create", "status": referral.status, "priority": referral.priority},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if referral.priority == Referral.Priority.CRITICAL else AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        ensure_staff_profile_in_request_tenant(
            self.request.user,
            serializer.validated_data.get("assigned_to", serializer.instance.assigned_to),
        )
        referral = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=referral,
            metadata={"operation": "referral_update", "status": referral.status, "priority": referral.priority},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if referral.priority == Referral.Priority.CRITICAL else AuditEvent.RiskLevel.MEDIUM,
        )

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        referral = self.get_object()
        if referral.status in {Referral.Status.COMPLETED, Referral.Status.CANCELLED}:
            return Response({"detail": "Completed or cancelled referrals cannot be accepted."}, status=status.HTTP_409_CONFLICT)
        referral.status = Referral.Status.ACCEPTED
        referral.accepted_at = referral.accepted_at or timezone.now()
        referral.save(update_fields=["status", "accepted_at", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=referral,
            metadata={"operation": "referral_accept"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if referral.priority == Referral.Priority.CRITICAL else AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(referral).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        referral = self.get_object()
        if referral.status == Referral.Status.CANCELLED:
            return Response({"detail": "Cancelled referrals cannot be completed."}, status=status.HTTP_409_CONFLICT)
        referral.status = Referral.Status.COMPLETED
        referral.completed_at = referral.completed_at or timezone.now()
        if request.data.get("clinical_summary") is not None:
            referral.clinical_summary = request.data.get("clinical_summary", "")
        referral.save(update_fields=["status", "completed_at", "clinical_summary", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=referral,
            metadata={"operation": "referral_complete"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        return Response(self.get_serializer(referral).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        referral = self.get_object()
        if referral.status == Referral.Status.COMPLETED:
            return Response({"detail": "Completed referrals cannot be cancelled."}, status=status.HTTP_409_CONFLICT)
        referral.status = Referral.Status.CANCELLED
        referral.cancelled_at = referral.cancelled_at or timezone.now()
        referral.cancellation_reason = request.data.get("cancellation_reason", referral.cancellation_reason)
        referral.save(update_fields=["status", "cancelled_at", "cancellation_reason", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=referral,
            metadata={"operation": "referral_cancel"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(referral).data)


class DiagnosticOrderViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = DiagnosticOrder.objects.select_related(
        "organization",
        "hospital",
        "department_ref",
        "patient",
        "encounter",
        "ordered_by",
    )
    serializer_class = DiagnosticOrderSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        encounter_id = self.request.query_params.get("encounter")
        status_filter = self.request.query_params.get("status")
        order_type = self.request.query_params.get("order_type")
        priority = self.request.query_params.get("priority")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if encounter_id:
            queryset = queryset.filter(encounter_id=encounter_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if order_type:
            queryset = queryset.filter(order_type=order_type.upper())
        if priority:
            queryset = queryset.filter(priority=priority.upper())
        return queryset

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        order = serializer.save(
            organization=serializer.validated_data.get("organization") or patient.organization,
            hospital=serializer.validated_data.get("hospital") or patient.hospital,
            department_ref=serializer.validated_data.get("department_ref") or patient.department_ref,
            ordered_by=self.request.user if self.request.user.is_authenticated else None,
        )
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=order,
            metadata={"operation": "diagnostic_order_create", "status": order.status, "priority": order.priority},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if order.priority == DiagnosticOrder.Priority.STAT else AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        order = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=order,
            metadata={"operation": "diagnostic_order_update", "status": order.status, "priority": order.priority},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if order.priority == DiagnosticOrder.Priority.STAT else AuditEvent.RiskLevel.MEDIUM,
        )

    @action(detail=True, methods=["post"])
    def collect(self, request, pk=None):
        order = self.get_object()
        if order.status in {DiagnosticOrder.Status.RESULTED, DiagnosticOrder.Status.CANCELLED}:
            return Response({"detail": "Resulted or cancelled orders cannot be collected."}, status=status.HTTP_409_CONFLICT)
        order.status = DiagnosticOrder.Status.COLLECTED
        order.collected_at = order.collected_at or timezone.now()
        order.save(update_fields=["status", "collected_at", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=order,
            metadata={"operation": "diagnostic_order_collect"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"])
    def result(self, request, pk=None):
        order = self.get_object()
        if order.status == DiagnosticOrder.Status.CANCELLED:
            return Response({"detail": "Cancelled orders cannot be resulted."}, status=status.HTTP_409_CONFLICT)
        order.status = DiagnosticOrder.Status.RESULTED
        order.resulted_at = order.resulted_at or timezone.now()
        order.result_summary = request.data.get("result_summary", order.result_summary)
        result_payload = request.data.get("result_payload")
        if isinstance(result_payload, dict):
            order.result_payload = result_payload
        order.save(update_fields=["status", "resulted_at", "result_summary", "result_payload", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=order,
            metadata={"operation": "diagnostic_order_result"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status == DiagnosticOrder.Status.RESULTED:
            return Response({"detail": "Resulted orders cannot be cancelled."}, status=status.HTTP_409_CONFLICT)
        order.status = DiagnosticOrder.Status.CANCELLED
        order.cancellation_reason = request.data.get("cancellation_reason", order.cancellation_reason)
        order.save(update_fields=["status", "cancellation_reason", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=order,
            metadata={"operation": "diagnostic_order_cancel"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(order).data)


class AdmissionViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = Admission.objects.select_related(
        "organization",
        "hospital",
        "patient",
        "encounter",
        "referral",
        "requested_by",
        "admitting_provider",
        "department_ref",
        "room",
    )
    serializer_class = AdmissionSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        status_filter = self.request.query_params.get("status")
        hospital = self.request.query_params.get("hospital")
        department_ref = self.request.query_params.get("department_ref")
        priority = self.request.query_params.get("priority")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if hospital:
            queryset = queryset.filter(hospital_id=hospital)
        if department_ref:
            queryset = queryset.filter(department_ref_id=department_ref)
        if priority:
            queryset = queryset.filter(priority=priority.upper())
        return queryset

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        admission = serializer.save(
            organization=serializer.validated_data.get("organization") or patient.organization,
            hospital=serializer.validated_data.get("hospital") or patient.hospital,
            department_ref=serializer.validated_data.get("department_ref") or patient.department_ref,
            requested_by=self.request.user if self.request.user.is_authenticated else None,
        )
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=admission,
            metadata={"operation": "admission_create", "status": admission.status, "priority": admission.priority},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if admission.priority == Admission.Priority.CRITICAL else AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        admission = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=admission,
            metadata={"operation": "admission_update", "status": admission.status, "priority": admission.priority},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if admission.priority == Admission.Priority.CRITICAL else AuditEvent.RiskLevel.MEDIUM,
        )

    def _room_from_request(self, request):
        room_id = request.data.get("room")
        if not room_id:
            return None
        return self.scope_queryset(Room.objects.select_related("organization", "hospital", "department")).filter(id=room_id).first()

    def _department_from_request(self, request):
        department_id = request.data.get("department_ref")
        if not department_id:
            return None
        return self.scope_queryset(Department.objects.select_related("organization", "hospital")).filter(id=department_id).first()

    def _sync_patient_location(self, admission: Admission) -> None:
        patient = admission.patient
        update_fields = ["updated_at"]
        if admission.hospital_id and patient.hospital_id != admission.hospital_id:
            patient.hospital = admission.hospital
            update_fields.append("hospital")
        if admission.department_ref_id and patient.department_ref_id != admission.department_ref_id:
            patient.department_ref = admission.department_ref
            update_fields.append("department_ref")
        if patient.room_id != admission.room_id:
            patient.room = admission.room
            update_fields.append("room")
        patient.save(update_fields=update_fields)

    @action(detail=True, methods=["post"])
    def waitlist(self, request, pk=None):
        admission = self.get_object()
        if admission.status in {Admission.Status.ADMITTED, Admission.Status.DISCHARGED, Admission.Status.CANCELLED}:
            return Response({"detail": "This admission cannot be waitlisted."}, status=status.HTTP_409_CONFLICT)
        admission.status = Admission.Status.WAITLISTED
        admission.waitlisted_at = admission.waitlisted_at or timezone.now()
        admission.save(update_fields=["status", "waitlisted_at", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=admission,
            metadata={"operation": "admission_waitlist"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(admission).data)

    @action(detail=True, methods=["post"])
    def admit(self, request, pk=None):
        admission = self.get_object()
        if admission.status in {Admission.Status.DISCHARGED, Admission.Status.CANCELLED}:
            return Response({"detail": "Discharged or cancelled admissions cannot be admitted."}, status=status.HTTP_409_CONFLICT)
        room = self._room_from_request(request)
        department = self._department_from_request(request)
        if request.data.get("room") and not room:
            return Response({"detail": "room was not found in the current organization."}, status=status.HTTP_400_BAD_REQUEST)
        if request.data.get("department_ref") and not department:
            return Response({"detail": "department_ref was not found in the current organization."}, status=status.HTTP_400_BAD_REQUEST)
        if room:
            admission.room = room
            admission.department_ref = room.department
            admission.hospital = room.hospital
        elif department:
            admission.department_ref = department
            admission.hospital = department.hospital
        admission.status = Admission.Status.ADMITTED
        admission.admitted_at = admission.admitted_at or timezone.now()
        admission.admitting_provider = request.user if request.user.is_authenticated else admission.admitting_provider
        admission.save(update_fields=["room", "department_ref", "hospital", "status", "admitted_at", "admitting_provider", "updated_at"])
        self._sync_patient_location(admission)
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=admission,
            metadata={"operation": "admission_admit", "room_id": admission.room_id, "department_ref_id": admission.department_ref_id},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if admission.priority == Admission.Priority.CRITICAL else AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(admission).data)

    @action(detail=True, methods=["post"])
    def transfer(self, request, pk=None):
        admission = self.get_object()
        if admission.status not in {Admission.Status.ADMITTED, Admission.Status.TRANSFERRED}:
            return Response({"detail": "Only admitted patients can be transferred."}, status=status.HTTP_409_CONFLICT)
        room = self._room_from_request(request)
        department = self._department_from_request(request)
        if not room and not department:
            return Response({"detail": "room or department_ref is required."}, status=status.HTTP_400_BAD_REQUEST)
        if room:
            admission.room = room
            admission.department_ref = room.department
            admission.hospital = room.hospital
        elif department:
            admission.room = None
            admission.department_ref = department
            admission.hospital = department.hospital
        admission.status = Admission.Status.TRANSFERRED
        admission.transferred_at = timezone.now()
        admission.save(update_fields=["room", "department_ref", "hospital", "status", "transferred_at", "updated_at"])
        self._sync_patient_location(admission)
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=admission,
            metadata={"operation": "admission_transfer", "room_id": admission.room_id, "department_ref_id": admission.department_ref_id},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        return Response(self.get_serializer(admission).data)

    @action(detail=True, methods=["post"])
    def discharge(self, request, pk=None):
        admission = self.get_object()
        if admission.status in {Admission.Status.DISCHARGED, Admission.Status.CANCELLED}:
            return Response({"detail": "This admission is already closed."}, status=status.HTTP_409_CONFLICT)
        admission.status = Admission.Status.DISCHARGED
        admission.discharged_at = admission.discharged_at or timezone.now()
        admission.discharge_summary = request.data.get("discharge_summary", admission.discharge_summary)
        admission.save(update_fields=["status", "discharged_at", "discharge_summary", "updated_at"])
        patient = admission.patient
        patient.room = None
        patient.save(update_fields=["room", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.DISCHARGE,
            actor=request.user,
            resource=admission,
            metadata={"operation": "admission_discharge"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.CRITICAL if admission.patient.has_severe_chronic_risk else AuditEvent.RiskLevel.HIGH,
        )
        return Response(self.get_serializer(admission).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        admission = self.get_object()
        if admission.status in {Admission.Status.ADMITTED, Admission.Status.TRANSFERRED, Admission.Status.DISCHARGED}:
            return Response({"detail": "Admitted, transferred, or discharged admissions cannot be cancelled."}, status=status.HTTP_409_CONFLICT)
        admission.status = Admission.Status.CANCELLED
        admission.cancelled_at = admission.cancelled_at or timezone.now()
        admission.cancellation_reason = request.data.get("cancellation_reason", admission.cancellation_reason)
        admission.save(update_fields=["status", "cancelled_at", "cancellation_reason", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=admission,
            metadata={"operation": "admission_cancel"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(admission).data)


class PerinatalRegistryEntryViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = PerinatalRegistryEntry.objects.select_related(
        "patient",
        "organization",
        "hospital",
        "department_ref",
        "assigned_provider",
    )
    serializer_class = PerinatalRegistryEntrySerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        status_filter = self.request.query_params.get("status")
        risk_level = self.request.query_params.get("risk_level")
        due_before = self.request.query_params.get("due_before")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if risk_level:
            queryset = queryset.filter(risk_level=risk_level.upper())
        if due_before:
            queryset = queryset.filter(next_visit_at__lte=due_before)
        return queryset

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        entry = serializer.save(
            organization=serializer.validated_data.get("organization") or patient.organization,
            hospital=serializer.validated_data.get("hospital") or patient.hospital,
            department_ref=serializer.validated_data.get("department_ref") or patient.department_ref,
            assigned_provider=serializer.validated_data.get("assigned_provider")
            or (self.request.user if self.request.user.is_authenticated else None),
        )
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=entry,
            metadata={"operation": "perinatal_registry_create", "risk_level": entry.risk_level, "status": entry.status},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if entry.risk_level == PerinatalRegistryEntry.RiskLevel.CRITICAL else AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        entry = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=entry,
            metadata={"operation": "perinatal_registry_update", "risk_level": entry.risk_level, "status": entry.status},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if entry.risk_level == PerinatalRegistryEntry.RiskLevel.CRITICAL else AuditEvent.RiskLevel.MEDIUM,
        )

    @action(detail=True, methods=["post"], url_path="update-risk")
    def update_risk(self, request, pk=None):
        entry = self.get_object()
        risk_level = request.data.get("risk_level")
        if risk_level and risk_level.upper() not in PerinatalRegistryEntry.RiskLevel.values:
            return Response({"detail": "Invalid risk_level."}, status=status.HTTP_400_BAD_REQUEST)
        if risk_level:
            entry.risk_level = risk_level.upper()
        if isinstance(request.data.get("risk_factors"), list):
            entry.risk_factors = request.data["risk_factors"]
        if request.data.get("fetal_notes") is not None:
            entry.fetal_notes = request.data.get("fetal_notes", "")
        for field in ("latest_systolic_bp", "latest_diastolic_bp", "latest_glucose_mmol_l"):
            if request.data.get(field) is not None:
                setattr(entry, field, request.data.get(field))
        entry.save(
            update_fields=[
                "risk_level",
                "risk_factors",
                "fetal_notes",
                "latest_systolic_bp",
                "latest_diastolic_bp",
                "latest_glucose_mmol_l",
                "updated_at",
            ]
        )
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=entry,
            metadata={"operation": "perinatal_registry_update_risk", "risk_level": entry.risk_level},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH if entry.risk_level == PerinatalRegistryEntry.RiskLevel.CRITICAL else AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"], url_path="schedule-follow-up")
    def schedule_follow_up(self, request, pk=None):
        entry = self.get_object()
        next_visit_at = request.data.get("next_visit_at")
        if not next_visit_at:
            return Response({"detail": "next_visit_at is required."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(entry, data={"next_visit_at": next_visit_at}, partial=True)
        serializer.is_valid(raise_exception=True)
        entry.next_visit_at = serializer.validated_data["next_visit_at"]
        entry.status = PerinatalRegistryEntry.Status.WATCHLIST if entry.risk_level in {
            PerinatalRegistryEntry.RiskLevel.HIGH,
            PerinatalRegistryEntry.RiskLevel.CRITICAL,
        } else entry.status
        entry.save(update_fields=["next_visit_at", "status", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=entry,
            metadata={"operation": "perinatal_registry_schedule_follow_up", "next_visit_at": str(entry.next_visit_at)},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        entry = self.get_object()
        status_value = request.data.get("status", PerinatalRegistryEntry.Status.CLOSED).upper()
        if status_value not in {PerinatalRegistryEntry.Status.CLOSED, PerinatalRegistryEntry.Status.DELIVERED}:
            return Response({"detail": "status must be CLOSED or DELIVERED."}, status=status.HTTP_400_BAD_REQUEST)
        entry.status = status_value
        entry.closed_at = entry.closed_at or timezone.now()
        entry.outcome_notes = request.data.get("outcome_notes", entry.outcome_notes)
        entry.save(update_fields=["status", "closed_at", "outcome_notes", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=entry,
            metadata={"operation": "perinatal_registry_close", "status": entry.status},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        return Response(self.get_serializer(entry).data)


class PatronageVisitViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = PatronageVisit.objects.select_related(
        "organization",
        "hospital",
        "patient",
        "assigned_to",
        "assigned_to__user",
        "created_by",
    )
    serializer_class = PatronageVisitSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        assigned_to = self.request.query_params.get("assigned_to")
        status_filter = self.request.query_params.get("status")
        territory = self.request.query_params.get("territory")
        due_before = self.request.query_params.get("due_before")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if territory:
            queryset = queryset.filter(territory__icontains=territory)
        if due_before:
            queryset = queryset.filter(scheduled_for__lte=due_before)
        return queryset

    def create(self, request, *args, **kwargs):
        idempotency_key = request.data.get("idempotency_key")
        if idempotency_key:
            existing = self.get_queryset().filter(idempotency_key=idempotency_key).first()
            if existing:
                record_audit_event(
                    action=AuditEvent.Action.READ,
                    actor=request.user,
                    resource=existing,
                    metadata={"operation": "patronage_visit_idempotent_replay"},
                    phi_accessed=True,
                )
                return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        patient = serializer.validated_data["patient"]
        ensure_patient_in_request_tenant(self.request.user, patient)
        ensure_staff_profile_in_request_tenant(self.request.user, serializer.validated_data.get("assigned_to"))
        visit = serializer.save(
            organization=serializer.validated_data.get("organization") or patient.organization,
            hospital=serializer.validated_data.get("hospital") or patient.hospital,
            territory=serializer.validated_data.get("territory") or patient.department or patient.district,
            created_by=self.request.user if self.request.user.is_authenticated else None,
        )
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            resource=visit,
            metadata={"operation": "patronage_visit_create", "status": visit.status, "priority": visit.priority},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    def perform_update(self, serializer):
        patient = serializer.validated_data.get("patient", serializer.instance.patient)
        ensure_patient_in_request_tenant(self.request.user, patient)
        ensure_staff_profile_in_request_tenant(
            self.request.user,
            serializer.validated_data.get("assigned_to", serializer.instance.assigned_to),
        )
        visit = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            resource=visit,
            metadata={"operation": "patronage_visit_update", "status": visit.status, "priority": visit.priority},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    @action(detail=True, methods=["post"])
    def sync(self, request, pk=None):
        visit = self.get_object()
        payload = request.data.get("payload", {})
        if not isinstance(payload, dict):
            return Response({"detail": "payload must be an object."}, status=status.HTTP_400_BAD_REQUEST)
        client_version = request.data.get("server_version")
        if client_version is not None and int(client_version) < visit.server_version:
            visit.status = PatronageVisit.Status.CONFLICT
            visit.conflict_payload = payload
            visit.conflict_reason = "Client version is older than server version."
            visit.save(update_fields=["status", "conflict_payload", "conflict_reason", "updated_at"])
            record_audit_event(
                action=AuditEvent.Action.UPDATE,
                actor=request.user,
                resource=visit,
                metadata={"operation": "patronage_visit_sync_conflict", "client_version": client_version},
                phi_accessed=True,
                risk_level=AuditEvent.RiskLevel.HIGH,
            )
            return Response(self.get_serializer(visit).data, status=status.HTTP_409_CONFLICT)

        visit.payload = {**visit.payload, **payload}
        visit.status = PatronageVisit.Status.SYNCED
        visit.synced_at = timezone.now()
        visit.client_updated_at = request.data.get("client_updated_at") or visit.client_updated_at
        visit.server_version += 1
        visit.conflict_payload = {}
        visit.conflict_reason = ""
        visit.save(
            update_fields=[
                "payload",
                "status",
                "synced_at",
                "client_updated_at",
                "server_version",
                "conflict_payload",
                "conflict_reason",
                "updated_at",
            ]
        )
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=visit,
            metadata={"operation": "patronage_visit_sync", "server_version": visit.server_version},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(visit).data)

    @action(detail=True, methods=["post"], url_path="resolve-conflict")
    def resolve_conflict(self, request, pk=None):
        visit = self.get_object()
        strategy = request.data.get("strategy", "client")
        if visit.status != PatronageVisit.Status.CONFLICT:
            return Response({"detail": "Visit is not in conflict."}, status=status.HTTP_409_CONFLICT)
        if strategy not in {"client", "server"}:
            return Response({"detail": "strategy must be client or server."}, status=status.HTTP_400_BAD_REQUEST)
        if strategy == "client":
            visit.payload = {**visit.payload, **visit.conflict_payload}
        visit.status = PatronageVisit.Status.SYNCED
        visit.synced_at = timezone.now()
        visit.server_version += 1
        visit.conflict_payload = {}
        visit.conflict_reason = ""
        visit.save(update_fields=["payload", "status", "synced_at", "server_version", "conflict_payload", "conflict_reason", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=visit,
            metadata={"operation": "patronage_visit_resolve_conflict", "strategy": strategy},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        return Response(self.get_serializer(visit).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        visit = self.get_object()
        if visit.status == PatronageVisit.Status.CANCELLED:
            return Response({"detail": "Cancelled visits cannot be completed."}, status=status.HTTP_409_CONFLICT)
        payload = request.data.get("payload")
        if isinstance(payload, dict):
            visit.payload = {**visit.payload, **payload}
        visit.status = PatronageVisit.Status.COMPLETED
        visit.visited_at = visit.visited_at or timezone.now()
        visit.synced_at = visit.synced_at or timezone.now()
        visit.notes = request.data.get("notes", visit.notes)
        visit.server_version += 1
        visit.save(update_fields=["payload", "status", "visited_at", "synced_at", "notes", "server_version", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=visit,
            metadata={"operation": "patronage_visit_complete"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(visit).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        visit = self.get_object()
        if visit.status == PatronageVisit.Status.COMPLETED:
            return Response({"detail": "Completed visits cannot be cancelled."}, status=status.HTTP_409_CONFLICT)
        visit.status = PatronageVisit.Status.CANCELLED
        visit.notes = request.data.get("notes", visit.notes)
        visit.save(update_fields=["status", "notes", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            resource=visit,
            metadata={"operation": "patronage_visit_cancel"},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(self.get_serializer(visit).data)


class PatientDuplicateCandidateViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = PatientDuplicateCandidate.objects.select_related(
        "organization",
        "hospital",
        "primary_patient",
        "duplicate_patient",
        "reviewed_by",
    )
    serializer_class = PatientDuplicateCandidateSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        status_filter = self.request.query_params.get("status")
        min_score = self.request.query_params.get("min_score")
        if patient_id:
            queryset = queryset.filter(models.Q(primary_patient_id=patient_id) | models.Q(duplicate_patient_id=patient_id))
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if min_score:
            queryset = queryset.filter(score__gte=min_score)
        return queryset

    def perform_create(self, serializer):
        primary_patient = serializer.validated_data["primary_patient"]
        duplicate_patient = serializer.validated_data["duplicate_patient"]
        ensure_patient_in_request_tenant(self.request.user, primary_patient)
        ensure_patient_in_request_tenant(self.request.user, duplicate_patient)
        candidate = serializer.save(
            organization=serializer.validated_data.get("organization") or primary_patient.organization,
            hospital=serializer.validated_data.get("hospital") or primary_patient.hospital,
        )
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            actor=self.request.user,
            patient=primary_patient,
            resource=candidate,
            metadata={"operation": "duplicate_candidate_create", "score": str(candidate.score)},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )

    def perform_update(self, serializer):
        primary_patient = serializer.validated_data.get("primary_patient", serializer.instance.primary_patient)
        duplicate_patient = serializer.validated_data.get("duplicate_patient", serializer.instance.duplicate_patient)
        ensure_patient_in_request_tenant(self.request.user, primary_patient)
        ensure_patient_in_request_tenant(self.request.user, duplicate_patient)
        candidate = serializer.save()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=self.request.user,
            patient=primary_patient,
            resource=candidate,
            metadata={"operation": "duplicate_candidate_update", "status": candidate.status, "score": str(candidate.score)},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )

    def _review(self, request, candidate: PatientDuplicateCandidate, status_value: str, operation: str):
        candidate.status = status_value
        candidate.reviewed_by = request.user if request.user.is_authenticated else None
        candidate.reviewed_at = timezone.now()
        candidate.review_note = request.data.get("review_note", candidate.review_note)
        candidate.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_note", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            patient=candidate.primary_patient,
            resource=candidate,
            metadata={"operation": operation, "status": candidate.status, "score": str(candidate.score)},
            phi_accessed=True,
            risk_level=AuditEvent.RiskLevel.HIGH,
        )
        return Response(self.get_serializer(candidate).data)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        candidate = self.get_object()
        return self._review(request, candidate, PatientDuplicateCandidate.Status.CONFIRMED, "duplicate_candidate_confirm")

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        candidate = self.get_object()
        return self._review(request, candidate, PatientDuplicateCandidate.Status.DISMISSED, "duplicate_candidate_dismiss")

    @action(detail=True, methods=["post"], url_path="mark-merged")
    def mark_merged(self, request, pk=None):
        candidate = self.get_object()
        if candidate.status != PatientDuplicateCandidate.Status.CONFIRMED:
            return Response({"detail": "Only confirmed duplicates can be marked merged."}, status=status.HTTP_409_CONFLICT)
        return self._review(request, candidate, PatientDuplicateCandidate.Status.MERGED, "duplicate_candidate_mark_merged")


class AIAssistantSessionViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = (
        AIAssistantSession.objects.select_related(
            "organization",
            "hospital",
            "patient",
            "medical_record",
            "medical_record__patient",
            "staff_profile",
            "staff_profile__user",
            "created_by",
        )
        .prefetch_related("messages")
    )
    serializer_class = AIAssistantSessionSerializer
    permission_classes = [IsClinicalWriter]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        mode = self.request.query_params.get("mode")
        safety_status = self.request.query_params.get("safety_status")
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        if mode:
            queryset = queryset.filter(mode=mode.upper())
        if safety_status:
            queryset = queryset.filter(safety_status=safety_status.upper())
        return queryset

    def perform_create(self, serializer):
        record = serializer.validated_data.get("medical_record")
        patient = serializer.validated_data.get("patient")
        if record:
            ensure_patient_in_request_tenant(self.request.user, record.patient)
            if patient and record.patient_id != patient.id:
                raise ValidationError({"medical_record": "Medical record belongs to a different patient."})
            patient = record.patient
        if patient:
            ensure_patient_in_request_tenant(self.request.user, patient)

        profile = self.get_staff_profile()
        defaults = {
            "created_by": self.request.user if self.request.user.is_authenticated else None,
            "staff_profile": profile,
        }
        if record:
            defaults.update({"organization": record.organization, "hospital": record.hospital, "patient": patient})
        elif patient:
            defaults.update({"organization": patient.organization, "hospital": patient.hospital})
        elif profile:
            defaults.update({"organization": profile.organization, "hospital": profile.primary_hospital})

        session = serializer.save(**defaults)
        record_audit_event(
            action=AuditEvent.Action.AI_REVIEW,
            actor=self.request.user,
            patient=session.patient,
            resource=session,
            metadata={"operation": "ai_assistant_session_create", "mode": session.mode},
            phi_accessed=bool(session.patient_id or session.medical_record_id or session.context_snapshot),
            risk_level=AuditEvent.RiskLevel.MEDIUM,
        )

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        session = self.get_object()
        if request.method == "GET":
            messages = session.messages.all()
            record_audit_event(
                action=AuditEvent.Action.READ,
                actor=request.user,
                patient=session.patient,
                resource=session,
                metadata={"operation": "ai_assistant_messages_list"},
                phi_accessed=bool(session.patient_id or session.medical_record_id or session.context_snapshot),
            )
            return Response(AIAssistantMessageSerializer(messages, many=True).data)

        content = str(request.data.get("content", "")).strip()
        if not content:
            return Response({"detail": "content is required."}, status=status.HTTP_400_BAD_REQUEST)
        client_metadata = request.data.get("metadata", {})
        if not isinstance(client_metadata, dict):
            client_metadata = {}

        user_message = AIAssistantMessage.objects.create(
            session=session,
            role=AIAssistantMessage.Role.USER,
            content=content,
            metadata={"client": client_metadata},
        )
        reply = generate_ai_assistant_reply(session, content)

        with transaction.atomic():
            assistant_message = AIAssistantMessage.objects.create(
                session=session,
                role=AIAssistantMessage.Role.ASSISTANT,
                content=reply["content"],
                risk_level=reply["risk_level"],
                metadata=reply["metadata"],
            )
            if session.safety_status != reply["safety_status"]:
                session.safety_status = reply["safety_status"]
                session.save(update_fields=["safety_status", "updated_at"])

        record_audit_event(
            action=AuditEvent.Action.AI_REVIEW,
            actor=request.user,
            patient=session.patient,
            resource=session,
            metadata={"operation": "ai_assistant_message", "risk_level": assistant_message.risk_level},
            phi_accessed=bool(session.patient_id or session.medical_record_id or session.context_snapshot),
            risk_level=AuditEvent.RiskLevel.HIGH if assistant_message.risk_level in {
                AIAssistantMessage.RiskLevel.HIGH,
                AIAssistantMessage.RiskLevel.CRITICAL,
            } else AuditEvent.RiskLevel.MEDIUM,
        )
        return Response(
            {
                "session": AIAssistantSessionSerializer(session, context=self.get_serializer_context()).data,
                "user_message": AIAssistantMessageSerializer(user_message).data,
                "assistant_message": AIAssistantMessageSerializer(assistant_message).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        session = self.get_object()
        session.safety_status = AIAssistantSession.SafetyStatus.CLOSED
        session.closed_at = timezone.now()
        session.save(update_fields=["safety_status", "closed_at", "updated_at"])
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            actor=request.user,
            patient=session.patient,
            resource=session,
            metadata={"operation": "ai_assistant_session_close"},
            phi_accessed=bool(session.patient_id or session.medical_record_id),
        )
        return Response(self.get_serializer(session).data)


class AIErrLogViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = AIErrLog.objects.select_related("organization", "hospital", "medical_record", "medical_record__patient")
    serializer_class = AIErrLogSerializer
    permission_classes = [IsGovernanceReader]
    audit_phi_accessed = True

    def get_queryset(self):
        queryset = super().get_queryset()
        severity = self.request.query_params.get("severity")
        reviewed_by_admin = self.request.query_params.get("reviewed_by_admin")
        patient_id = self.request.query_params.get("patient")
        doctor_id = self.request.query_params.get("doctor_id")
        if severity:
            queryset = queryset.filter(severity=severity.upper())
        if reviewed_by_admin is not None:
            queryset = queryset.filter(reviewed_by_admin=reviewed_by_admin.lower() in {"1", "true", "yes", "on"})
        if patient_id:
            queryset = queryset.filter(medical_record__patient_id=patient_id)
        if doctor_id:
            queryset = queryset.filter(medical_record__doctor_id=doctor_id)
        return queryset

    @action(detail=False, methods=["get"], url_path="rca-summary")
    def rca_summary(self, request):
        data = (
            self.get_queryset()
            .values("error_type", "severity")
            .annotate(total=Count("id"))
            .order_by("error_type", "severity")
        )
        record_audit_event(
            action=AuditEvent.Action.READ,
            actor=request.user,
            resource_type="AIErrLogSummary",
            metadata={"operation": "rca_summary"},
            phi_accessed=False,
        )
        return Response(list(data))


class AnonymousFeedbackViewSet(TenantScopedQuerysetMixin, AuditReadMixin, viewsets.ModelViewSet):
    queryset = AnonymousFeedback.objects.select_related(
        "organization",
        "hospital",
        "department_ref",
        "room",
        "phone_verification",
        "target_staff_profile",
        "target_staff_profile__user",
    )
    serializer_class = AnonymousFeedbackSerializer
    audit_phi_accessed = False

    def get_permissions(self):
        if self.action in {"create", "public_room_score", "request_phone_verification", "verify_phone"}:
            return [permissions.AllowAny()]
        return [IsGovernanceReader()]

    @action(detail=False, methods=["post"], url_path="request-phone-verification")
    def request_phone_verification(self, request):
        serializer = PhoneVerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room_qr_id = serializer.validated_data.get("room_qr_id", "")
        target_staff_profile = serializer.validated_data.get("target_staff_profile")
        target_type = serializer.validated_data["target_type"]

        if target_type == PhoneVerificationChallenge.TargetType.ROOM:
            room = Room.objects.filter(room_qr_id=room_qr_id, is_active=True).first()
            if not room:
                return Response({"detail": "room_qr_id was not found."}, status=status.HTTP_400_BAD_REQUEST)

        challenge, code = PhoneVerificationChallenge.create_for_phone(
            phone_number=serializer.validated_data["phone_number"],
            target_type=target_type,
            room_qr_id=room_qr_id,
            target_staff_profile=target_staff_profile,
        )
        payload = {
            "challenge_id": challenge.challenge_id,
            "phone_last4": challenge.phone_last4,
            "expires_at": challenge.expires_at,
            "delivery_channel": challenge.delivery_channel,
            "delivery_status": challenge.delivery_status,
        }
        if settings.DEBUG:
            payload["debug_verification_code"] = code
        record_audit_event(
            action=AuditEvent.Action.CREATE,
            resource=challenge,
            resource_type="PhoneVerificationChallenge",
            metadata={"operation": "feedback_phone_verification_request", "target_type": target_type},
            phi_accessed=False,
        )
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="verify-phone")
    def verify_phone(self, request):
        serializer = PhoneVerificationVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        challenge = PhoneVerificationChallenge.objects.filter(
            challenge_id=serializer.validated_data["challenge_id"]
        ).first()
        if not challenge:
            return Response({"detail": "Verification challenge was not found."}, status=status.HTTP_404_NOT_FOUND)
        if challenge.is_consumed:
            return Response({"detail": "Verification challenge has already been used."}, status=status.HTTP_409_CONFLICT)
        if challenge.is_expired:
            return Response({"detail": "Verification challenge has expired."}, status=status.HTTP_410_GONE)
        if challenge.attempts >= challenge.max_attempts:
            return Response({"detail": "Too many verification attempts."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if not challenge.code_matches(serializer.validated_data["code"]):
            challenge.register_failed_attempt()
            return Response({"detail": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)

        token = challenge.mark_verified()
        record_audit_event(
            action=AuditEvent.Action.UPDATE,
            resource=challenge,
            resource_type="PhoneVerificationChallenge",
            metadata={"operation": "feedback_phone_verified", "target_type": challenge.target_type},
            phi_accessed=False,
        )
        return Response(
            {
                "challenge_id": challenge.challenge_id,
                "verification_token": token,
                "verified_at": challenge.verified_at,
            }
        )

    def perform_create(self, serializer):
        challenge_id = serializer.validated_data.pop("phone_verification_challenge", None)
        verification_token = serializer.validated_data.pop("phone_verification_token", "")
        if not challenge_id or not verification_token:
            raise ValidationError("Phone verification is required.")

        with transaction.atomic():
            challenge = (
                PhoneVerificationChallenge.objects.select_for_update()
                .select_related("target_staff_profile", "target_staff_profile__organization", "target_staff_profile__primary_hospital")
                .filter(challenge_id=challenge_id)
                .first()
            )
            if not challenge:
                raise ValidationError({"phone_verification_challenge": "Verification challenge was not found."})
            if challenge.is_consumed:
                raise ValidationError({"phone_verification_challenge": "Verification challenge has already been used."})
            if challenge.is_expired:
                raise ValidationError({"phone_verification_challenge": "Verification challenge has expired."})
            if not challenge.is_verified or not challenge.token_matches(verification_token):
                raise ValidationError({"phone_verification_token": "Verification token is invalid."})

            target_type = serializer.validated_data.get("target_type") or challenge.target_type
            room_qr_id = serializer.validated_data.get("room_qr_id") or challenge.room_qr_id
            target_staff_profile = serializer.validated_data.get("target_staff_profile") or challenge.target_staff_profile
            if target_type != challenge.target_type:
                raise ValidationError({"target_type": "Feedback target does not match verification challenge."})
            if challenge.room_qr_id and room_qr_id != challenge.room_qr_id:
                raise ValidationError({"room_qr_id": "room_qr_id does not match verification challenge."})
            if challenge.target_staff_profile_id and (
                not target_staff_profile or target_staff_profile.id != challenge.target_staff_profile_id
            ):
                raise ValidationError({"target_staff_profile": "Doctor target does not match verification challenge."})

            room = Room.objects.select_related("organization", "hospital", "department").filter(
                room_qr_id=room_qr_id,
                is_active=True,
            ).first() if room_qr_id else None
            if target_type == AnonymousFeedback.TargetType.ROOM and not room:
                raise ValidationError({"room_qr_id": "room_qr_id was not found."})
            if target_type == AnonymousFeedback.TargetType.DOCTOR and not target_staff_profile:
                raise ValidationError({"target_staff_profile": "target_staff_profile is required."})

            defaults = {
                "phone_verification": challenge,
                "phone_verified": True,
                "phone_hash": challenge.phone_hash,
                "target_type": target_type,
                "target_staff_profile": target_staff_profile,
                "status": AnonymousFeedback.Status.NEW,
            }
            if room:
                defaults.update(
                    {
                        "room": room,
                        "organization": room.organization,
                        "hospital": room.hospital,
                        "department_ref": room.department,
                        "department": serializer.validated_data.get("department") or room.department.name,
                        "room_qr_id": room_qr_id,
                    }
                )
            elif target_staff_profile:
                defaults.update(
                    {
                        "organization": target_staff_profile.organization,
                        "hospital": target_staff_profile.primary_hospital,
                        "department": serializer.validated_data.get("department") or "Doctor feedback",
                        "room_qr_id": room_qr_id,
                    }
                )
            feedback = serializer.save(**defaults)
            challenge.mark_consumed()

        record_audit_event(
            action=AuditEvent.Action.FEEDBACK_SUBMITTED,
            resource=feedback,
            metadata={
                "room_qr_id": feedback.room_qr_id,
                "target_type": feedback.target_type,
                "target_staff_profile_id": feedback.target_staff_profile_id,
                "rating": feedback.rating,
                "category": feedback.category,
                "severity": feedback.severity,
                "phone_verified": feedback.phone_verified,
            },
        )
        transaction.on_commit(lambda: broadcast_feedback_submitted(feedback))

    @action(detail=False, methods=["get"], permission_classes=[IsGovernanceReader])
    def summary(self, request):
        record_audit_event(
            action=AuditEvent.Action.READ,
            actor=request.user,
            resource_type="AnonymousFeedbackSummary",
            metadata={"operation": "summary"},
        )
        return Response(list(feedback_summary_queryset(self.get_staff_profile())))

    @action(detail=False, methods=["get"], url_path="public-room-score", permission_classes=[permissions.AllowAny])
    def public_room_score(self, request):
        room_qr_id = request.query_params.get("room_qr_id")
        if not room_qr_id:
            return Response({"detail": "room_qr_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        data = (
            AnonymousFeedback.objects.filter(room_qr_id=room_qr_id)
            .aggregate(avg_rating=Avg("rating"), total=Count("id"), last_feedback_at=Max("created_at"))
        )
        return Response({"room_qr_id": room_qr_id, **data})


class AuditEventViewSet(TenantScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("actor", "organization", "hospital", "patient")
    serializer_class = AuditEventSerializer
    permission_classes = [IsGovernanceReader]

    def get_queryset(self):
        queryset = super().get_queryset()
        action = self.request.query_params.get("action")
        patient = self.request.query_params.get("patient")
        actor = self.request.query_params.get("actor")
        phi_accessed = self.request.query_params.get("phi_accessed")
        if action:
            queryset = queryset.filter(action=action.upper())
        if patient:
            queryset = queryset.filter(patient_id=patient)
        if actor:
            queryset = queryset.filter(actor_id=actor)
        if phi_accessed in {"true", "false"}:
            queryset = queryset.filter(phi_accessed=phi_accessed == "true")
        return queryset
