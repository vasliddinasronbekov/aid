from django.contrib import admin

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


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "data_region", "locale", "is_active", "updated_at")
    list_filter = ("is_active", "data_region")
    search_fields = ("name", "legal_name", "registration_number")
    readonly_fields = ("public_id", "created_at", "updated_at")


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "region_code", "facility_type", "is_active")
    list_filter = ("organization", "is_active", "region_code")
    search_fields = ("name", "code", "address_line")
    readonly_fields = ("public_id", "created_at", "updated_at")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "hospital", "specialty", "is_active")
    list_filter = ("organization", "hospital", "specialty", "is_active")
    search_fields = ("name", "code", "hospital__name")
    readonly_fields = ("public_id", "created_at", "updated_at")


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("room_number", "department", "care_level", "bed_count", "is_active")
    list_filter = ("organization", "hospital", "department", "care_level", "is_active")
    search_fields = ("room_number", "room_qr_id", "department__name")
    readonly_fields = ("public_id", "created_at", "updated_at")


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "primary_hospital", "role", "employment_status")
    list_filter = ("organization", "primary_hospital", "role", "employment_status")
    search_fields = ("user__username", "user__first_name", "user__last_name", "license_number")
    readonly_fields = ("public_id", "created_at", "updated_at")
    filter_horizontal = ("departments",)


@admin.register(AccessGrant)
class AccessGrantAdmin(admin.ModelAdmin):
    list_display = ("staff_profile", "scope", "hospital", "department", "starts_at", "ends_at", "revoked_at")
    list_filter = ("scope", "hospital", "department", "revoked_at")
    search_fields = ("staff_profile__user__username", "reason")
    readonly_fields = ("public_id", "created_at", "updated_at")


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("display_name", "organization", "hospital", "region_code", "department", "triage_status", "updated_at")
    list_filter = ("organization", "hospital", "triage_status", "region_code", "department")
    search_fields = ("first_name", "last_name", "middle_name", "patient_identifier", "medical_record_number", "phone_number")
    readonly_fields = ("public_id", "created_at", "updated_at")


@admin.register(MedicalRecord)
class MedicalRecordAdmin(admin.ModelAdmin):
    list_display = ("patient", "hospital", "doctor_id", "record_type", "discharge_status", "ai_review_status", "created_at")
    list_filter = ("organization", "hospital", "record_type", "discharge_status", "ai_review_status")
    search_fields = ("patient__first_name", "patient__last_name", "doctor_id", "diagnosis")
    readonly_fields = ("public_id", "created_at", "updated_at")


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("patient", "hospital", "assigned_provider", "appointment_type", "status", "priority", "scheduled_start")
    list_filter = ("organization", "hospital", "appointment_type", "status", "priority")
    search_fields = ("patient__first_name", "patient__last_name", "patient__medical_record_number", "reason", "external_reference")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "assigned_provider", "created_by", "hospital", "department_ref", "room")


@admin.register(Encounter)
class EncounterAdmin(admin.ModelAdmin):
    list_display = ("patient", "hospital", "provider", "encounter_type", "status", "started_at", "ended_at")
    list_filter = ("organization", "hospital", "encounter_type", "status")
    search_fields = ("patient__first_name", "patient__last_name", "chief_complaint", "assessment", "plan")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "appointment", "provider", "hospital", "department_ref", "room")


@admin.register(PatientVital)
class PatientVitalAdmin(admin.ModelAdmin):
    list_display = ("patient", "hospital", "recorded_by", "measured_at", "systolic_bp", "diastolic_bp", "oxygen_saturation")
    list_filter = ("organization", "hospital", "measured_at")
    search_fields = ("patient__first_name", "patient__last_name", "patient__medical_record_number", "notes")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "encounter", "recorded_by", "hospital")


@admin.register(PatientAllergy)
class PatientAllergyAdmin(admin.ModelAdmin):
    list_display = ("patient", "allergen", "reaction", "severity", "status", "onset_date")
    list_filter = ("organization", "hospital", "severity", "status")
    search_fields = ("patient__first_name", "patient__last_name", "allergen", "reaction")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "recorded_by", "hospital")


@admin.register(CareTeamMembership)
class CareTeamMembershipAdmin(admin.ModelAdmin):
    list_display = ("patient", "staff_profile", "role", "is_primary", "starts_at", "ends_at")
    list_filter = ("organization", "hospital", "role", "is_primary")
    search_fields = ("patient__first_name", "patient__last_name", "staff_profile__user__username", "notes")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "staff_profile", "hospital")


@admin.register(ClinicalTask)
class ClinicalTaskAdmin(admin.ModelAdmin):
    list_display = ("title", "patient", "assigned_to", "task_type", "priority", "status", "due_at")
    list_filter = ("organization", "hospital", "department_ref", "task_type", "priority", "status")
    search_fields = ("title", "description", "patient__first_name", "patient__last_name", "assigned_to__user__username")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "encounter", "appointment", "assigned_to", "created_by", "hospital", "department_ref")


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ("patient", "referral_type", "priority", "status", "target_department", "requested_at")
    list_filter = ("organization", "hospital", "referral_type", "priority", "status", "target_department")
    search_fields = ("patient__first_name", "patient__last_name", "reason", "clinical_summary", "external_reference")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = (
        "patient",
        "encounter",
        "source_department",
        "target_hospital",
        "target_department",
        "requested_by",
        "assigned_to",
    )


@admin.register(DiagnosticOrder)
class DiagnosticOrderAdmin(admin.ModelAdmin):
    list_display = ("patient", "name", "order_type", "priority", "status", "scheduled_at", "created_at")
    list_filter = ("organization", "hospital", "department_ref", "order_type", "priority", "status")
    search_fields = ("patient__first_name", "patient__last_name", "code", "name", "indication", "result_summary")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "encounter", "ordered_by", "hospital", "department_ref")


@admin.register(Admission)
class AdmissionAdmin(admin.ModelAdmin):
    list_display = ("patient", "hospital", "department_ref", "room", "priority", "status", "requested_at")
    list_filter = ("organization", "hospital", "department_ref", "source", "priority", "status")
    search_fields = ("patient__first_name", "patient__last_name", "reason", "discharge_summary", "cancellation_reason")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = (
        "patient",
        "encounter",
        "referral",
        "requested_by",
        "admitting_provider",
        "hospital",
        "department_ref",
        "room",
    )


@admin.register(PerinatalRegistryEntry)
class PerinatalRegistryEntryAdmin(admin.ModelAdmin):
    list_display = ("patient", "gestational_age_weeks", "gestational_age_days", "risk_level", "status", "next_visit_at")
    list_filter = ("organization", "hospital", "department_ref", "risk_level", "status")
    search_fields = ("patient__first_name", "patient__last_name", "enrollment_reason", "fetal_notes")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "hospital", "department_ref", "assigned_provider")


@admin.register(PatronageVisit)
class PatronageVisitAdmin(admin.ModelAdmin):
    list_display = ("patient", "assigned_to", "visit_type", "priority", "status", "scheduled_for", "server_version")
    list_filter = ("organization", "hospital", "visit_type", "priority", "status", "territory")
    search_fields = ("patient__first_name", "patient__last_name", "territory", "client_reference", "idempotency_key", "notes")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "assigned_to", "created_by", "hospital")


@admin.register(PatientDuplicateCandidate)
class PatientDuplicateCandidateAdmin(admin.ModelAdmin):
    list_display = ("primary_patient", "duplicate_patient", "score", "status", "detected_at", "reviewed_by")
    list_filter = ("organization", "hospital", "status")
    search_fields = (
        "primary_patient__first_name",
        "primary_patient__last_name",
        "duplicate_patient__first_name",
        "duplicate_patient__last_name",
        "review_note",
    )
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("primary_patient", "duplicate_patient", "hospital", "reviewed_by")


@admin.register(AIErrLog)
class AIErrLogAdmin(admin.ModelAdmin):
    list_display = ("medical_record", "organization", "hospital", "error_type", "severity", "reviewed_by_admin", "created_at")
    list_filter = ("organization", "hospital", "error_type", "severity", "reviewed_by_admin")
    search_fields = ("rca_description", "protocol_reference")


@admin.register(AIAssistantSession)
class AIAssistantSessionAdmin(admin.ModelAdmin):
    list_display = ("title", "mode", "safety_status", "patient", "staff_profile", "created_by", "updated_at")
    list_filter = ("organization", "hospital", "mode", "safety_status")
    search_fields = ("title", "patient__first_name", "patient__last_name", "created_by__username")
    readonly_fields = ("public_id", "created_at", "updated_at")
    autocomplete_fields = ("patient", "medical_record", "staff_profile", "created_by", "hospital")


@admin.register(AIAssistantMessage)
class AIAssistantMessageAdmin(admin.ModelAdmin):
    list_display = ("session", "role", "risk_level", "created_at")
    list_filter = ("role", "risk_level")
    search_fields = ("content", "session__title")
    readonly_fields = ("created_at",)
    autocomplete_fields = ("session",)


@admin.register(PhoneVerificationChallenge)
class PhoneVerificationChallengeAdmin(admin.ModelAdmin):
    list_display = ("challenge_id", "target_type", "phone_last4", "verified_at", "consumed_at", "expires_at")
    list_filter = ("target_type", "purpose", "delivery_status", "verified_at", "consumed_at")
    search_fields = ("challenge_id", "room_qr_id", "phone_hash", "target_staff_profile__user__username")
    readonly_fields = ("challenge_id", "phone_hash", "code_digest", "verification_token_digest", "created_at", "updated_at")
    autocomplete_fields = ("target_staff_profile",)


@admin.register(AnonymousFeedback)
class AnonymousFeedbackAdmin(admin.ModelAdmin):
    list_display = ("target_type", "department", "room_qr_id", "target_staff_profile", "rating", "category", "severity", "status", "created_at")
    list_filter = ("organization", "hospital", "target_type", "category", "severity", "status", "rating", "phone_verified")
    search_fields = ("room_qr_id", "anonymous_session_id", "phone_hash", "target_staff_profile__user__username", "comment")
    readonly_fields = ("public_id", "created_at")
    autocomplete_fields = ("room", "target_staff_profile", "phone_verification")


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("action", "actor", "organization", "patient", "resource_type", "phi_accessed", "risk_level", "created_at")
    list_filter = ("organization", "action", "phi_accessed", "risk_level", "success")
    search_fields = ("request_id", "resource_type", "resource_id", "actor__username", "patient__first_name", "patient__last_name")
    readonly_fields = [field.name for field in AuditEvent._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
