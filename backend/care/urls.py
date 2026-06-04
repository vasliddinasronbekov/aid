from rest_framework.routers import DefaultRouter

from .views import (
    AIErrLogViewSet,
    AIAssistantSessionViewSet,
    AccessGrantViewSet,
    AdmissionViewSet,
    AnonymousFeedbackViewSet,
    AppointmentViewSet,
    AuditEventViewSet,
    CareTeamMembershipViewSet,
    ClinicalTaskViewSet,
    DepartmentViewSet,
    DiagnosticOrderViewSet,
    EncounterViewSet,
    HospitalViewSet,
    MedicalRecordViewSet,
    OrganizationViewSet,
    PatientAllergyViewSet,
    PatientDuplicateCandidateViewSet,
    PatientViewSet,
    PatientVitalViewSet,
    PatronageVisitViewSet,
    PerinatalRegistryEntryViewSet,
    ReferralViewSet,
    RoomViewSet,
    StaffProfileViewSet,
)


router = DefaultRouter()
router.register("organizations", OrganizationViewSet)
router.register("hospitals", HospitalViewSet)
router.register("departments", DepartmentViewSet)
router.register("rooms", RoomViewSet)
router.register("staff-profiles", StaffProfileViewSet)
router.register("access-grants", AccessGrantViewSet)
router.register("patients", PatientViewSet)
router.register("medical-records", MedicalRecordViewSet)
router.register("appointments", AppointmentViewSet)
router.register("encounters", EncounterViewSet)
router.register("patient-vitals", PatientVitalViewSet)
router.register("patient-allergies", PatientAllergyViewSet)
router.register("care-team-memberships", CareTeamMembershipViewSet)
router.register("clinical-tasks", ClinicalTaskViewSet)
router.register("referrals", ReferralViewSet)
router.register("diagnostic-orders", DiagnosticOrderViewSet)
router.register("admissions", AdmissionViewSet)
router.register("perinatal-registry", PerinatalRegistryEntryViewSet)
router.register("patronage-visits", PatronageVisitViewSet)
router.register("patient-duplicate-candidates", PatientDuplicateCandidateViewSet)
router.register("ai-assistant-sessions", AIAssistantSessionViewSet)
router.register("ai-error-logs", AIErrLogViewSet)
router.register("feedback", AnonymousFeedbackViewSet)
router.register("audit-events", AuditEventViewSet)

urlpatterns = router.urls
