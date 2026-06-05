import hashlib
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


def secret_digest(value: str, *, salt: str = "") -> str:
    secret = getattr(settings, "FEEDBACK_PHONE_HASH_SECRET", settings.SECRET_KEY)
    payload = f"{salt}:{secret}:{value}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


class TimeStampedModel(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Organization(TimeStampedModel):
    name = models.CharField(max_length=180)
    legal_name = models.CharField(max_length=240, blank=True)
    registration_number = models.CharField(max_length=120, blank=True)
    data_region = models.CharField(max_length=64, default="uz")
    timezone = models.CharField(max_length=64, default="Asia/Tashkent")
    locale = models.CharField(max_length=16, default="uz-Latn")
    compliance_profile = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["is_active", "name"]),
            models.Index(fields=["data_region", "is_active"]),
        ]

    def __str__(self) -> str:
        return self.name


class Hospital(TimeStampedModel):
    organization = models.ForeignKey(Organization, related_name="hospitals", on_delete=models.PROTECT)
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=180)
    facility_type = models.CharField(max_length=80, blank=True)
    address_line = models.CharField(max_length=240, blank=True)
    city = models.CharField(max_length=120, blank=True)
    region_code = models.CharField(max_length=64, db_index=True)
    phone_number = models.CharField(max_length=32, blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Tashkent")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "code"], name="unique_hospital_code_per_org"),
        ]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["region_code", "is_active"]),
        ]

    def __str__(self) -> str:
        return self.name


class Department(TimeStampedModel):
    class Specialty(models.TextChoices):
        PERINATAL = "PERINATAL", "Perinatal"
        CARDIOLOGY = "CARDIOLOGY", "Cardiology"
        THERAPY = "THERAPY", "Therapy"
        IMAGING = "IMAGING", "Imaging"
        EMERGENCY = "EMERGENCY", "Emergency"
        SURGERY = "SURGERY", "Surgery"
        LABORATORY = "LABORATORY", "Laboratory"
        ADMINISTRATION = "ADMINISTRATION", "Administration"
        OTHER = "OTHER", "Other"

    organization = models.ForeignKey(Organization, related_name="departments", on_delete=models.PROTECT)
    hospital = models.ForeignKey(Hospital, related_name="departments", on_delete=models.PROTECT)
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=160)
    specialty = models.CharField(max_length=32, choices=Specialty.choices, default=Specialty.OTHER, db_index=True)
    floor = models.CharField(max_length=40, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["hospital__name", "name"]
        constraints = [
            models.UniqueConstraint(fields=["hospital", "code"], name="unique_department_code_per_hospital"),
        ]
        indexes = [
            models.Index(fields=["organization", "specialty"]),
            models.Index(fields=["hospital", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.hospital.name} / {self.name}"


class Room(TimeStampedModel):
    class CareLevel(models.TextChoices):
        GENERAL = "GENERAL", "General"
        HIGH_DEPENDENCY = "HIGH_DEPENDENCY", "High dependency"
        ICU = "ICU", "ICU"
        DELIVERY = "DELIVERY", "Delivery"
        IMAGING = "IMAGING", "Imaging"
        PROCEDURE = "PROCEDURE", "Procedure"
        EMERGENCY = "EMERGENCY", "Emergency"

    organization = models.ForeignKey(Organization, related_name="rooms", on_delete=models.PROTECT)
    hospital = models.ForeignKey(Hospital, related_name="rooms", on_delete=models.PROTECT)
    department = models.ForeignKey(Department, related_name="rooms", on_delete=models.PROTECT)
    room_number = models.CharField(max_length=64)
    room_qr_id = models.CharField(max_length=140, unique=True, db_index=True)
    care_level = models.CharField(max_length=32, choices=CareLevel.choices, default=CareLevel.GENERAL)
    bed_count = models.PositiveSmallIntegerField(default=1)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["department__name", "room_number"]
        constraints = [
            models.UniqueConstraint(fields=["department", "room_number"], name="unique_room_number_per_department"),
        ]
        indexes = [
            models.Index(fields=["organization", "is_active"]),
            models.Index(fields=["hospital", "department"]),
        ]

    def __str__(self) -> str:
        return f"{self.department.name} {self.room_number}"


class StaffProfile(TimeStampedModel):
    class Role(models.TextChoices):
        SYSTEM_ADMIN = "SYSTEM_ADMIN", "System admin"
        HOSPITAL_ADMIN = "HOSPITAL_ADMIN", "Hospital admin"
        HEAD_PHYSICIAN = "HEAD_PHYSICIAN", "Head physician"
        PHYSICIAN = "PHYSICIAN", "Physician"
        NURSE = "NURSE", "Nurse"
        REGISTRAR = "REGISTRAR", "Registrar"
        COMPLIANCE_OFFICER = "COMPLIANCE_OFFICER", "Compliance officer"
        RESEARCHER = "RESEARCHER", "Researcher"
        AUDITOR = "AUDITOR", "Auditor"
        READ_ONLY = "READ_ONLY", "Read only"

    class EmploymentStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"
        TERMINATED = "TERMINATED", "Terminated"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="staff_profile", on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, related_name="staff_profiles", on_delete=models.PROTECT)
    primary_hospital = models.ForeignKey(
        Hospital,
        related_name="primary_staff_profiles",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    departments = models.ManyToManyField(Department, related_name="staff_profiles", blank=True)
    role = models.CharField(max_length=32, choices=Role.choices, db_index=True)
    employment_status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
        db_index=True,
    )
    license_number = models.CharField(max_length=120, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    last_privacy_training_at = models.DateField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["user__last_name", "user__first_name"]
        indexes = [
            models.Index(fields=["organization", "role", "employment_status"]),
            models.Index(fields=["primary_hospital", "role"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.get_full_name() or self.user.username} ({self.role})"

    @property
    def is_active_staff(self) -> bool:
        return self.employment_status == self.EmploymentStatus.ACTIVE


class AccessGrant(TimeStampedModel):
    class Scope(models.TextChoices):
        ORGANIZATION = "ORGANIZATION", "Organization"
        HOSPITAL = "HOSPITAL", "Hospital"
        DEPARTMENT = "DEPARTMENT", "Department"
        ROOM = "ROOM", "Room"
        PATIENT_GROUP = "PATIENT_GROUP", "Patient group"
        BREAK_GLASS = "BREAK_GLASS", "Break glass"

    staff_profile = models.ForeignKey(StaffProfile, related_name="access_grants", on_delete=models.CASCADE)
    scope = models.CharField(max_length=32, choices=Scope.choices, db_index=True)
    hospital = models.ForeignKey(Hospital, related_name="access_grants", on_delete=models.CASCADE, null=True, blank=True)
    department = models.ForeignKey(
        Department,
        related_name="access_grants",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    room = models.ForeignKey(Room, related_name="access_grants", on_delete=models.CASCADE, null=True, blank=True)
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField()
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="granted_access_profiles",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="revoked_access_profiles",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-starts_at"]
        indexes = [
            models.Index(fields=["staff_profile", "scope"]),
            models.Index(fields=["starts_at", "ends_at"]),
            models.Index(fields=["revoked_at", "scope"]),
        ]

    def __str__(self) -> str:
        return f"{self.staff_profile} - {self.scope}"

    @property
    def is_active(self) -> bool:
        now = timezone.now()
        return self.revoked_at is None and self.starts_at <= now and (self.ends_at is None or self.ends_at > now)


class Patient(TimeStampedModel):
    class TriageStatus(models.TextChoices):
        RED = "RED", "Red"
        YELLOW = "YELLOW", "Yellow"
        GREEN = "GREEN", "Green"

    class Gender(models.TextChoices):
        FEMALE = "FEMALE", "Female"
        MALE = "MALE", "Male"
        OTHER = "OTHER", "Other"
        UNKNOWN = "UNKNOWN", "Unknown"

    organization = models.ForeignKey(Organization, related_name="patients", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="patients", on_delete=models.PROTECT, null=True, blank=True)
    department_ref = models.ForeignKey(
        Department,
        related_name="current_patients",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    room = models.ForeignKey(Room, related_name="current_patients", on_delete=models.PROTECT, null=True, blank=True)
    patient_identifier = models.CharField(max_length=64, unique=True, default=uuid.uuid4)
    medical_record_number = models.CharField(max_length=80, blank=True, db_index=True)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    middle_name = models.CharField(max_length=120, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=16, choices=Gender.choices, default=Gender.UNKNOWN)
    phone_number = models.CharField(max_length=32, blank=True)
    address_line = models.CharField(max_length=240, blank=True)
    region_code = models.CharField(max_length=64, db_index=True)
    district = models.CharField(max_length=120, blank=True)
    department = models.CharField(max_length=120, blank=True)
    triage_status = models.CharField(
        max_length=10,
        choices=TriageStatus.choices,
        default=TriageStatus.GREEN,
        db_index=True,
    )
    chronic_biomarkers = models.JSONField(default=dict, blank=True)
    emergency_contact = models.JSONField(default=dict, blank=True)
    consent_preferences = models.JSONField(default=dict, blank=True)
    last_marker_sync_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["triage_status", "last_name", "first_name"]
        indexes = [
            models.Index(fields=["organization", "triage_status"]),
            models.Index(fields=["hospital", "triage_status"]),
            models.Index(fields=["region_code", "triage_status"]),
            models.Index(fields=["department", "triage_status"]),
            models.Index(fields=["medical_record_number", "organization"]),
            models.Index(fields=["is_active", "updated_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.last_name}, {self.first_name}"

    @property
    def display_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def severe_chronic_tags(self) -> list[str]:
        tags = self.chronic_biomarkers.get("severe_chronic_tags", [])
        return tags if isinstance(tags, list) else []

    @property
    def has_severe_chronic_risk(self) -> bool:
        markers = self.chronic_biomarkers or {}
        risk_level = str(markers.get("risk_level", "")).lower()
        systolic_bp = markers.get("systolic_bp")
        oxygen_saturation = markers.get("oxygen_saturation")
        eclampsia_risk = markers.get("eclampsia_risk")

        numeric_flags = [
            isinstance(systolic_bp, (int, float)) and systolic_bp >= 160,
            isinstance(oxygen_saturation, (int, float)) and oxygen_saturation < 90,
            isinstance(eclampsia_risk, (int, float)) and eclampsia_risk >= 0.7,
        ]
        return bool(self.severe_chronic_tags or risk_level in {"high", "critical"} or any(numeric_flags))

    def mark_biomarker_sync(self) -> None:
        self.last_marker_sync_at = timezone.now()


class MedicalRecord(TimeStampedModel):
    class AIReviewStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CLEAR = "CLEAR", "Clear"
        NEEDS_REVIEW = "NEEDS_REVIEW", "Needs review"
        CRITICAL = "CRITICAL", "Critical"

    class RecordType(models.TextChoices):
        CONSULTATION = "CONSULTATION", "Consultation"
        IMAGING = "IMAGING", "Imaging"
        DISCHARGE = "DISCHARGE", "Discharge"
        FOLLOW_UP = "FOLLOW_UP", "Follow up"

    class DischargeStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        DISCHARGED = "DISCHARGED", "Discharged"

    organization = models.ForeignKey(
        Organization,
        related_name="medical_records",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    hospital = models.ForeignKey(Hospital, related_name="medical_records", on_delete=models.PROTECT, null=True, blank=True)
    department_ref = models.ForeignKey(
        Department,
        related_name="medical_records",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    patient = models.ForeignKey(Patient, related_name="medical_records", on_delete=models.CASCADE)
    attending_provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="attending_medical_records",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    doctor_id = models.CharField(max_length=120, db_index=True)
    diagnosis = models.TextField()
    prescriptions = models.TextField(blank=True)
    clinical_notes = models.TextField(blank=True)
    ai_review_status = models.CharField(
        max_length=20,
        choices=AIReviewStatus.choices,
        default=AIReviewStatus.PENDING,
        db_index=True,
    )
    imaging_safety_metadata = models.JSONField(default=dict, blank=True)
    record_type = models.CharField(
        max_length=20,
        choices=RecordType.choices,
        default=RecordType.CONSULTATION,
        db_index=True,
    )
    discharge_status = models.CharField(
        max_length=20,
        choices=DischargeStatus.choices,
        default=DischargeStatus.ACTIVE,
        db_index=True,
    )
    active_call_alert_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["hospital", "created_at"]),
            models.Index(fields=["doctor_id", "created_at"]),
            models.Index(fields=["ai_review_status", "created_at"]),
            models.Index(fields=["discharge_status", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.record_type} - {self.created_at:%Y-%m-%d}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
            self.department_ref = self.department_ref or self.patient.department_ref
        super().save(*args, **kwargs)


class AIAssistantSession(TimeStampedModel):
    class Mode(models.TextChoices):
        CLINICAL_COPILOT = "CLINICAL_COPILOT", "Clinical co-pilot"
        RCA_COACH = "RCA_COACH", "RCA coach"
        DIGITAL_TWIN = "DIGITAL_TWIN", "Digital twin"
        PERINATAL_REVIEW = "PERINATAL_REVIEW", "Perinatal review"
        PATIENT_COMMUNICATION = "PATIENT_COMMUNICATION", "Patient communication"

    class SafetyStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ADVISORY = "ADVISORY", "Advisory"
        ESCALATED = "ESCALATED", "Escalated"
        CLOSED = "CLOSED", "Closed"

    organization = models.ForeignKey(Organization, related_name="ai_assistant_sessions", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="ai_assistant_sessions", on_delete=models.PROTECT, null=True, blank=True)
    patient = models.ForeignKey(Patient, related_name="ai_assistant_sessions", on_delete=models.SET_NULL, null=True, blank=True)
    medical_record = models.ForeignKey(
        MedicalRecord,
        related_name="ai_assistant_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    staff_profile = models.ForeignKey(
        StaffProfile,
        related_name="ai_assistant_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="ai_assistant_sessions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    mode = models.CharField(max_length=32, choices=Mode.choices, default=Mode.CLINICAL_COPILOT, db_index=True)
    safety_status = models.CharField(max_length=20, choices=SafetyStatus.choices, default=SafetyStatus.DRAFT, db_index=True)
    title = models.CharField(max_length=180, blank=True)
    context_snapshot = models.JSONField(default=dict, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["organization", "mode", "updated_at"]),
            models.Index(fields=["hospital", "safety_status", "updated_at"]),
            models.Index(fields=["patient", "updated_at"]),
            models.Index(fields=["created_by", "updated_at"]),
        ]

    def __str__(self) -> str:
        return self.title or f"{self.mode} session {self.public_id}"

    def save(self, *args, **kwargs) -> None:
        if self.medical_record_id:
            self.patient = self.patient or self.medical_record.patient
            self.organization = self.organization or self.medical_record.organization
            self.hospital = self.hospital or self.medical_record.hospital
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
        if self.staff_profile_id:
            self.organization = self.organization or self.staff_profile.organization
            self.hospital = self.hospital or self.staff_profile.primary_hospital
        super().save(*args, **kwargs)


class AIAssistantMessage(models.Model):
    class Role(models.TextChoices):
        SYSTEM = "SYSTEM", "System"
        USER = "USER", "User"
        ASSISTANT = "ASSISTANT", "Assistant"
        TOOL = "TOOL", "Tool"
        SAFETY = "SAFETY", "Safety"

    class RiskLevel(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    session = models.ForeignKey(AIAssistantSession, related_name="messages", on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=Role.choices, db_index=True)
    content = models.TextField()
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices, default=RiskLevel.LOW, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["session", "created_at"]),
            models.Index(fields=["role", "risk_level", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.session_id} {self.role} {self.created_at:%Y-%m-%d %H:%M:%S}"


class Appointment(TimeStampedModel):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        CHECKED_IN = "CHECKED_IN", "Checked in"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        NO_SHOW = "NO_SHOW", "No show"

    class AppointmentType(models.TextChoices):
        PRIMARY_CARE = "PRIMARY_CARE", "Primary care"
        FOLLOW_UP = "FOLLOW_UP", "Follow up"
        PATRONAGE = "PATRONAGE", "Patronage"
        PERINATAL = "PERINATAL", "Perinatal"
        LAB = "LAB", "Lab"
        IMAGING = "IMAGING", "Imaging"
        SPECIALIST = "SPECIALIST", "Specialist"
        EMERGENCY = "EMERGENCY", "Emergency"

    class Priority(models.TextChoices):
        ROUTINE = "ROUTINE", "Routine"
        SOON = "SOON", "Soon"
        URGENT = "URGENT", "Urgent"
        CRITICAL = "CRITICAL", "Critical"

    organization = models.ForeignKey(Organization, related_name="appointments", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="appointments", on_delete=models.PROTECT, null=True, blank=True)
    department_ref = models.ForeignKey(
        Department,
        related_name="appointments",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    room = models.ForeignKey(Room, related_name="appointments", on_delete=models.SET_NULL, null=True, blank=True)
    patient = models.ForeignKey(Patient, related_name="appointments", on_delete=models.CASCADE)
    assigned_provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="assigned_appointments",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_appointments",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    appointment_type = models.CharField(
        max_length=32,
        choices=AppointmentType.choices,
        default=AppointmentType.PRIMARY_CARE,
        db_index=True,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED, db_index=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.ROUTINE, db_index=True)
    scheduled_start = models.DateTimeField(db_index=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(blank=True)
    reason = models.CharField(max_length=240)
    notes = models.TextField(blank=True)
    external_reference = models.CharField(max_length=120, blank=True, db_index=True)

    class Meta:
        ordering = ["scheduled_start", "patient__last_name"]
        indexes = [
            models.Index(fields=["organization", "scheduled_start"]),
            models.Index(fields=["hospital", "scheduled_start"]),
            models.Index(fields=["assigned_provider", "scheduled_start"]),
            models.Index(fields=["status", "scheduled_start"]),
            models.Index(fields=["patient", "scheduled_start"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.scheduled_start:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
            self.department_ref = self.department_ref or self.patient.department_ref
        super().save(*args, **kwargs)


class Encounter(TimeStampedModel):
    class EncounterType(models.TextChoices):
        OUTPATIENT = "OUTPATIENT", "Outpatient"
        INPATIENT = "INPATIENT", "Inpatient"
        EMERGENCY = "EMERGENCY", "Emergency"
        HOME_VISIT = "HOME_VISIT", "Home visit"
        TELEHEALTH = "TELEHEALTH", "Telehealth"
        PERINATAL = "PERINATAL", "Perinatal"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        SIGNED = "SIGNED", "Signed"
        AMENDED = "AMENDED", "Amended"
        CANCELLED = "CANCELLED", "Cancelled"

    organization = models.ForeignKey(Organization, related_name="encounters", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="encounters", on_delete=models.PROTECT, null=True, blank=True)
    department_ref = models.ForeignKey(
        Department,
        related_name="encounters",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    room = models.ForeignKey(Room, related_name="encounters", on_delete=models.SET_NULL, null=True, blank=True)
    patient = models.ForeignKey(Patient, related_name="encounters", on_delete=models.CASCADE)
    appointment = models.OneToOneField(
        Appointment,
        related_name="encounter",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="encounters",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    encounter_type = models.CharField(max_length=32, choices=EncounterType.choices, default=EncounterType.OUTPATIENT)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True)
    started_at = models.DateTimeField(default=timezone.now, db_index=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    chief_complaint = models.TextField(blank=True)
    assessment = models.TextField(blank=True)
    plan = models.TextField(blank=True)
    follow_up_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["organization", "started_at"]),
            models.Index(fields=["hospital", "started_at"]),
            models.Index(fields=["patient", "started_at"]),
            models.Index(fields=["provider", "started_at"]),
            models.Index(fields=["status", "started_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.encounter_type} - {self.started_at:%Y-%m-%d}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
            self.department_ref = self.department_ref or self.patient.department_ref
        super().save(*args, **kwargs)


class PatientVital(TimeStampedModel):
    patient = models.ForeignKey(Patient, related_name="vitals", on_delete=models.CASCADE)
    encounter = models.ForeignKey(Encounter, related_name="vitals", on_delete=models.SET_NULL, null=True, blank=True)
    organization = models.ForeignKey(Organization, related_name="patient_vitals", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="patient_vitals", on_delete=models.PROTECT, null=True, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="recorded_vitals",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    measured_at = models.DateTimeField(default=timezone.now, db_index=True)
    systolic_bp = models.PositiveSmallIntegerField(null=True, blank=True)
    diastolic_bp = models.PositiveSmallIntegerField(null=True, blank=True)
    heart_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    respiratory_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    oxygen_saturation = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    temperature_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    glucose_mmol_l = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    height_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    pain_score = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MaxValueValidator(10)])
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-measured_at"]
        indexes = [
            models.Index(fields=["organization", "measured_at"]),
            models.Index(fields=["patient", "measured_at"]),
            models.Index(fields=["encounter", "measured_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} vitals {self.measured_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
        super().save(*args, **kwargs)


class PatientAllergy(TimeStampedModel):
    class Severity(models.TextChoices):
        LOW = "LOW", "Low"
        MODERATE = "MODERATE", "Moderate"
        HIGH = "HIGH", "High"
        LIFE_THREATENING = "LIFE_THREATENING", "Life threatening"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        ENTERED_IN_ERROR = "ENTERED_IN_ERROR", "Entered in error"

    patient = models.ForeignKey(Patient, related_name="allergies", on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, related_name="patient_allergies", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="patient_allergies", on_delete=models.PROTECT, null=True, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="recorded_allergies",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    allergen = models.CharField(max_length=180)
    reaction = models.CharField(max_length=240, blank=True)
    severity = models.CharField(max_length=32, choices=Severity.choices, default=Severity.MODERATE, db_index=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    onset_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["allergen"]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["severity", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.allergen}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
        super().save(*args, **kwargs)


class CareTeamMembership(TimeStampedModel):
    class Role(models.TextChoices):
        PRIMARY_PHYSICIAN = "PRIMARY_PHYSICIAN", "Primary physician"
        NURSE = "NURSE", "Nurse"
        SPECIALIST = "SPECIALIST", "Specialist"
        CARE_COORDINATOR = "CARE_COORDINATOR", "Care coordinator"
        REGISTRAR = "REGISTRAR", "Registrar"
        SOCIAL_WORKER = "SOCIAL_WORKER", "Social worker"
        OTHER = "OTHER", "Other"

    patient = models.ForeignKey(Patient, related_name="care_team_memberships", on_delete=models.CASCADE)
    staff_profile = models.ForeignKey(StaffProfile, related_name="care_team_memberships", on_delete=models.PROTECT)
    organization = models.ForeignKey(Organization, related_name="care_team_memberships", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="care_team_memberships", on_delete=models.PROTECT, null=True, blank=True)
    role = models.CharField(max_length=32, choices=Role.choices, db_index=True)
    starts_at = models.DateTimeField(default=timezone.now, db_index=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_primary = models.BooleanField(default=False, db_index=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["patient__last_name", "-is_primary", "role", "staff_profile__user__last_name"]
        indexes = [
            models.Index(fields=["organization", "role"]),
            models.Index(fields=["patient", "role"]),
            models.Index(fields=["staff_profile", "starts_at"]),
            models.Index(fields=["is_primary", "starts_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.staff_profile} - {self.role}"

    @property
    def is_active(self) -> bool:
        now = timezone.now()
        return self.starts_at <= now and (self.ends_at is None or self.ends_at > now)

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
        super().save(*args, **kwargs)


class ClinicalTask(TimeStampedModel):
    class TaskType(models.TextChoices):
        FOLLOW_UP = "FOLLOW_UP", "Follow up"
        MEDICATION_REVIEW = "MEDICATION_REVIEW", "Medication review"
        LAB_REVIEW = "LAB_REVIEW", "Lab review"
        IMAGING_REVIEW = "IMAGING_REVIEW", "Imaging review"
        DISCHARGE_PREP = "DISCHARGE_PREP", "Discharge prep"
        PATRONAGE_VISIT = "PATRONAGE_VISIT", "Patronage visit"
        CARE_PLAN = "CARE_PLAN", "Care plan"
        ADMIN = "ADMIN", "Admin"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        BLOCKED = "BLOCKED", "Blocked"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        ROUTINE = "ROUTINE", "Routine"
        SOON = "SOON", "Soon"
        URGENT = "URGENT", "Urgent"
        CRITICAL = "CRITICAL", "Critical"

    organization = models.ForeignKey(Organization, related_name="clinical_tasks", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="clinical_tasks", on_delete=models.PROTECT, null=True, blank=True)
    department_ref = models.ForeignKey(
        Department,
        related_name="clinical_tasks",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    patient = models.ForeignKey(Patient, related_name="clinical_tasks", on_delete=models.CASCADE, null=True, blank=True)
    encounter = models.ForeignKey(Encounter, related_name="clinical_tasks", on_delete=models.SET_NULL, null=True, blank=True)
    appointment = models.ForeignKey(Appointment, related_name="clinical_tasks", on_delete=models.SET_NULL, null=True, blank=True)
    assigned_to = models.ForeignKey(
        StaffProfile,
        related_name="assigned_clinical_tasks",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_clinical_tasks",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    task_type = models.CharField(max_length=32, choices=TaskType.choices, default=TaskType.FOLLOW_UP, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.ROUTINE, db_index=True)
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    due_at = models.DateTimeField(null=True, blank=True, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    completion_note = models.TextField(blank=True)
    idempotency_key = models.CharField(max_length=160, blank=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["status", "due_at", "-priority", "title"]
        indexes = [
            models.Index(fields=["organization", "status", "due_at"]),
            models.Index(fields=["hospital", "status", "due_at"]),
            models.Index(fields=["assigned_to", "status", "due_at"]),
            models.Index(fields=["patient", "status", "due_at"]),
            models.Index(fields=["task_type", "priority"]),
        ]

    def __str__(self) -> str:
        patient_label = self.patient.display_name if self.patient_id else "No patient"
        return f"{patient_label} - {self.title}"

    def save(self, *args, **kwargs) -> None:
        patient = self.patient
        if not patient and self.encounter_id:
            patient = self.encounter.patient
            self.patient = patient
        if not patient and self.appointment_id:
            patient = self.appointment.patient
            self.patient = patient
        if patient:
            self.organization = self.organization or patient.organization
            self.hospital = self.hospital or patient.hospital
            self.department_ref = self.department_ref or patient.department_ref
        super().save(*args, **kwargs)


class Referral(TimeStampedModel):
    class ReferralType(models.TextChoices):
        SPECIALIST = "SPECIALIST", "Specialist"
        HOSPITAL_TRANSFER = "HOSPITAL_TRANSFER", "Hospital transfer"
        IMAGING = "IMAGING", "Imaging"
        LAB = "LAB", "Lab"
        SOCIAL_SUPPORT = "SOCIAL_SUPPORT", "Social support"
        EXTERNAL = "EXTERNAL", "External"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        REQUESTED = "REQUESTED", "Requested"
        ACCEPTED = "ACCEPTED", "Accepted"
        SCHEDULED = "SCHEDULED", "Scheduled"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class Priority(models.TextChoices):
        ROUTINE = "ROUTINE", "Routine"
        SOON = "SOON", "Soon"
        URGENT = "URGENT", "Urgent"
        CRITICAL = "CRITICAL", "Critical"

    organization = models.ForeignKey(Organization, related_name="referrals", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="outgoing_referrals", on_delete=models.PROTECT, null=True, blank=True)
    patient = models.ForeignKey(Patient, related_name="referrals", on_delete=models.CASCADE)
    encounter = models.ForeignKey(Encounter, related_name="referrals", on_delete=models.SET_NULL, null=True, blank=True)
    source_department = models.ForeignKey(
        Department,
        related_name="outgoing_referrals",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    target_hospital = models.ForeignKey(
        Hospital,
        related_name="incoming_referrals",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    target_department = models.ForeignKey(
        Department,
        related_name="incoming_referrals",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="requested_referrals",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    assigned_to = models.ForeignKey(
        StaffProfile,
        related_name="assigned_referrals",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    referral_type = models.CharField(max_length=32, choices=ReferralType.choices, default=ReferralType.SPECIALIST, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED, db_index=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.ROUTINE, db_index=True)
    reason = models.CharField(max_length=240)
    clinical_summary = models.TextField(blank=True)
    requested_at = models.DateTimeField(default=timezone.now, db_index=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    external_reference = models.CharField(max_length=120, blank=True, db_index=True)

    class Meta:
        ordering = ["status", "-requested_at"]
        indexes = [
            models.Index(fields=["organization", "status", "requested_at"]),
            models.Index(fields=["hospital", "status", "requested_at"]),
            models.Index(fields=["patient", "requested_at"]),
            models.Index(fields=["target_department", "status"]),
            models.Index(fields=["referral_type", "priority"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.referral_type} - {self.status}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
            self.source_department = self.source_department or self.patient.department_ref
        super().save(*args, **kwargs)


class DiagnosticOrder(TimeStampedModel):
    class OrderType(models.TextChoices):
        LAB = "LAB", "Lab"
        IMAGING = "IMAGING", "Imaging"
        PROCEDURE = "PROCEDURE", "Procedure"
        ECG = "ECG", "ECG"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        ORDERED = "ORDERED", "Ordered"
        COLLECTED = "COLLECTED", "Collected"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        RESULTED = "RESULTED", "Resulted"
        CANCELLED = "CANCELLED", "Cancelled"

    class Priority(models.TextChoices):
        ROUTINE = "ROUTINE", "Routine"
        SOON = "SOON", "Soon"
        URGENT = "URGENT", "Urgent"
        STAT = "STAT", "Stat"

    organization = models.ForeignKey(Organization, related_name="diagnostic_orders", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="diagnostic_orders", on_delete=models.PROTECT, null=True, blank=True)
    department_ref = models.ForeignKey(
        Department,
        related_name="diagnostic_orders",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    patient = models.ForeignKey(Patient, related_name="diagnostic_orders", on_delete=models.CASCADE)
    encounter = models.ForeignKey(Encounter, related_name="diagnostic_orders", on_delete=models.SET_NULL, null=True, blank=True)
    ordered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="diagnostic_orders",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    order_type = models.CharField(max_length=20, choices=OrderType.choices, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ORDERED, db_index=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.ROUTINE, db_index=True)
    code = models.CharField(max_length=80, blank=True, db_index=True)
    name = models.CharField(max_length=180)
    indication = models.TextField(blank=True)
    specimen = models.CharField(max_length=120, blank=True)
    scheduled_at = models.DateTimeField(null=True, blank=True, db_index=True)
    collected_at = models.DateTimeField(null=True, blank=True)
    resulted_at = models.DateTimeField(null=True, blank=True)
    result_summary = models.TextField(blank=True)
    result_payload = models.JSONField(default=dict, blank=True)
    cancellation_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["status", "scheduled_at", "-created_at"]
        indexes = [
            models.Index(fields=["organization", "status", "created_at"]),
            models.Index(fields=["hospital", "status", "created_at"]),
            models.Index(fields=["patient", "created_at"]),
            models.Index(fields=["order_type", "priority"]),
            models.Index(fields=["scheduled_at", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.name} - {self.status}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
            self.department_ref = self.department_ref or self.patient.department_ref
        super().save(*args, **kwargs)


class Admission(TimeStampedModel):
    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        WAITLISTED = "WAITLISTED", "Waitlisted"
        ADMITTED = "ADMITTED", "Admitted"
        TRANSFERRED = "TRANSFERRED", "Transferred"
        DISCHARGED = "DISCHARGED", "Discharged"
        CANCELLED = "CANCELLED", "Cancelled"

    class Source(models.TextChoices):
        RECEPTION = "RECEPTION", "Reception"
        EMERGENCY = "EMERGENCY", "Emergency"
        APPOINTMENT = "APPOINTMENT", "Appointment"
        REFERRAL = "REFERRAL", "Referral"
        TRANSFER = "TRANSFER", "Transfer"

    class Priority(models.TextChoices):
        ROUTINE = "ROUTINE", "Routine"
        URGENT = "URGENT", "Urgent"
        CRITICAL = "CRITICAL", "Critical"

    organization = models.ForeignKey(Organization, related_name="admissions", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="admissions", on_delete=models.PROTECT, null=True, blank=True)
    patient = models.ForeignKey(Patient, related_name="admissions", on_delete=models.CASCADE)
    encounter = models.ForeignKey(Encounter, related_name="admissions", on_delete=models.SET_NULL, null=True, blank=True)
    referral = models.ForeignKey(Referral, related_name="admissions", on_delete=models.SET_NULL, null=True, blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="requested_admissions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    admitting_provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="admitting_provider_admissions",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    department_ref = models.ForeignKey(
        Department,
        related_name="admissions",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    room = models.ForeignKey(Room, related_name="admissions", on_delete=models.SET_NULL, null=True, blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.RECEPTION, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED, db_index=True)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.ROUTINE, db_index=True)
    reason = models.CharField(max_length=240)
    requested_at = models.DateTimeField(default=timezone.now, db_index=True)
    waitlisted_at = models.DateTimeField(null=True, blank=True)
    admitted_at = models.DateTimeField(null=True, blank=True)
    transferred_at = models.DateTimeField(null=True, blank=True)
    discharged_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    discharge_summary = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    triage_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["status", "-requested_at"]
        indexes = [
            models.Index(fields=["organization", "status", "requested_at"]),
            models.Index(fields=["hospital", "status", "requested_at"]),
            models.Index(fields=["patient", "requested_at"]),
            models.Index(fields=["department_ref", "status"]),
            models.Index(fields=["room", "status"]),
            models.Index(fields=["priority", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.status} - {self.reason}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
            self.department_ref = self.department_ref or self.patient.department_ref
            if not self.triage_snapshot:
                self.triage_snapshot = {
                    "triage_status": self.patient.triage_status,
                    "has_severe_chronic_risk": self.patient.has_severe_chronic_risk,
                }
        super().save(*args, **kwargs)


class PerinatalRegistryEntry(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        WATCHLIST = "WATCHLIST", "Watchlist"
        HOSPITALIZED = "HOSPITALIZED", "Hospitalized"
        DELIVERED = "DELIVERED", "Delivered"
        CLOSED = "CLOSED", "Closed"

    class RiskLevel(models.TextChoices):
        LOW = "LOW", "Low"
        MODERATE = "MODERATE", "Moderate"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    patient = models.ForeignKey(Patient, related_name="perinatal_registry_entries", on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, related_name="perinatal_registry_entries", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="perinatal_registry_entries", on_delete=models.PROTECT, null=True, blank=True)
    department_ref = models.ForeignKey(
        Department,
        related_name="perinatal_registry_entries",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    assigned_provider = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="perinatal_registry_entries",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices, default=RiskLevel.MODERATE, db_index=True)
    gestational_age_weeks = models.PositiveSmallIntegerField(validators=[MaxValueValidator(45)])
    gestational_age_days = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(6)])
    gravida = models.PositiveSmallIntegerField(default=1)
    para = models.PositiveSmallIntegerField(default=0)
    last_menstrual_period = models.DateField(null=True, blank=True)
    estimated_due_date = models.DateField(null=True, blank=True, db_index=True)
    enrollment_reason = models.CharField(max_length=240)
    risk_factors = models.JSONField(default=list, blank=True)
    latest_systolic_bp = models.PositiveSmallIntegerField(null=True, blank=True)
    latest_diastolic_bp = models.PositiveSmallIntegerField(null=True, blank=True)
    latest_glucose_mmol_l = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    fetal_notes = models.TextField(blank=True)
    next_visit_at = models.DateTimeField(null=True, blank=True, db_index=True)
    enrolled_at = models.DateTimeField(default=timezone.now, db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    outcome_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["risk_level", "next_visit_at", "patient__last_name"]
        indexes = [
            models.Index(fields=["organization", "status", "risk_level"]),
            models.Index(fields=["hospital", "status", "risk_level"]),
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["estimated_due_date", "status"]),
            models.Index(fields=["next_visit_at", "risk_level"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.gestational_age_weeks}w{self.gestational_age_days}d - {self.risk_level}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
            self.department_ref = self.department_ref or self.patient.department_ref
        super().save(*args, **kwargs)


class PatronageVisit(TimeStampedModel):
    class VisitType(models.TextChoices):
        ROUTINE = "ROUTINE", "Routine"
        HIGH_RISK = "HIGH_RISK", "High risk"
        POST_DISCHARGE = "POST_DISCHARGE", "Post discharge"
        PERINATAL = "PERINATAL", "Perinatal"
        CHRONIC = "CHRONIC", "Chronic"
        NEWBORN = "NEWBORN", "Newborn"

    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planned"
        OFFLINE_QUEUED = "OFFLINE_QUEUED", "Offline queued"
        SYNCED = "SYNCED", "Synced"
        CONFLICT = "CONFLICT", "Conflict"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    organization = models.ForeignKey(Organization, related_name="patronage_visits", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="patronage_visits", on_delete=models.PROTECT, null=True, blank=True)
    patient = models.ForeignKey(Patient, related_name="patronage_visits", on_delete=models.CASCADE)
    assigned_to = models.ForeignKey(
        StaffProfile,
        related_name="patronage_visits",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="created_patronage_visits",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    visit_type = models.CharField(max_length=32, choices=VisitType.choices, default=VisitType.ROUTINE, db_index=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PLANNED, db_index=True)
    priority = models.CharField(max_length=20, choices=ClinicalTask.Priority.choices, default=ClinicalTask.Priority.ROUTINE, db_index=True)
    territory = models.CharField(max_length=120, blank=True, db_index=True)
    scheduled_for = models.DateTimeField(db_index=True)
    visited_at = models.DateTimeField(null=True, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)
    client_reference = models.CharField(max_length=160, blank=True, db_index=True)
    idempotency_key = models.CharField(max_length=160, blank=True, db_index=True)
    client_updated_at = models.DateTimeField(null=True, blank=True)
    server_version = models.PositiveIntegerField(default=1)
    payload = models.JSONField(default=dict, blank=True)
    conflict_payload = models.JSONField(default=dict, blank=True)
    conflict_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["status", "scheduled_for"]
        indexes = [
            models.Index(fields=["organization", "status", "scheduled_for"]),
            models.Index(fields=["hospital", "status", "scheduled_for"]),
            models.Index(fields=["patient", "scheduled_for"]),
            models.Index(fields=["assigned_to", "status", "scheduled_for"]),
            models.Index(fields=["territory", "status"]),
            models.Index(fields=["idempotency_key", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.patient.display_name} - {self.visit_type} - {self.scheduled_for:%Y-%m-%d}"

    def save(self, *args, **kwargs) -> None:
        if self.patient_id:
            self.organization = self.organization or self.patient.organization
            self.hospital = self.hospital or self.patient.hospital
            self.territory = self.territory or self.patient.department or self.patient.district
        super().save(*args, **kwargs)


class PatientDuplicateCandidate(TimeStampedModel):
    class Status(models.TextChoices):
        NEEDS_REVIEW = "NEEDS_REVIEW", "Needs review"
        CONFIRMED = "CONFIRMED", "Confirmed duplicate"
        DISMISSED = "DISMISSED", "Dismissed"
        MERGED = "MERGED", "Merged"

    organization = models.ForeignKey(Organization, related_name="patient_duplicate_candidates", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="patient_duplicate_candidates", on_delete=models.PROTECT, null=True, blank=True)
    primary_patient = models.ForeignKey(Patient, related_name="primary_duplicate_candidates", on_delete=models.CASCADE)
    duplicate_patient = models.ForeignKey(Patient, related_name="duplicate_candidate_matches", on_delete=models.CASCADE)
    score = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0), MaxValueValidator(100)])
    match_reasons = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEEDS_REVIEW, db_index=True)
    detected_at = models.DateTimeField(default=timezone.now, db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="reviewed_duplicate_candidates",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)

    class Meta:
        ordering = ["status", "-score", "-detected_at"]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(primary_patient=models.F("duplicate_patient")),
                name="duplicate_candidate_patients_must_differ",
            ),
            models.UniqueConstraint(
                fields=["organization", "primary_patient", "duplicate_patient"],
                name="unique_duplicate_candidate_pair_per_org",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status", "score"]),
            models.Index(fields=["hospital", "status"]),
            models.Index(fields=["primary_patient", "status"]),
            models.Index(fields=["duplicate_patient", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.primary_patient.display_name} / {self.duplicate_patient.display_name} - {self.score}"

    def save(self, *args, **kwargs) -> None:
        if self.primary_patient_id:
            self.organization = self.organization or self.primary_patient.organization
            self.hospital = self.hospital or self.primary_patient.hospital
        super().save(*args, **kwargs)


class AIErrLog(models.Model):
    class ErrorType(models.TextChoices):
        ENTRY_OMISSION = "ENTRY_OMISSION", "Entry omission"
        PRESCRIPTION_MISMATCH = "PRESCRIPTION_MISMATCH", "Prescription mismatch"
        ETHICAL_DEVIATION = "ETHICAL_DEVIATION", "Ethical deviation"
        IMAGING_SAFETY = "IMAGING_SAFETY", "Imaging safety"
        DIGITAL_TWIN_RISK = "DIGITAL_TWIN_RISK", "Digital twin risk"

    class Severity(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    organization = models.ForeignKey(Organization, related_name="ai_error_logs", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="ai_error_logs", on_delete=models.PROTECT, null=True, blank=True)
    medical_record = models.ForeignKey(
        MedicalRecord,
        related_name="ai_error_logs",
        on_delete=models.CASCADE,
    )
    error_type = models.CharField(max_length=40, choices=ErrorType.choices, db_index=True)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.MEDIUM)
    rca_description = models.TextField()
    protocol_reference = models.CharField(max_length=160, blank=True)
    reviewed_by_admin = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["hospital", "created_at"]),
            models.Index(fields=["error_type", "severity"]),
            models.Index(fields=["reviewed_by_admin", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.error_type} on record {self.medical_record_id}"

    def save(self, *args, **kwargs) -> None:
        if self.medical_record_id:
            self.organization = self.organization or self.medical_record.organization
            self.hospital = self.hospital or self.medical_record.hospital
        super().save(*args, **kwargs)


class PhoneVerificationChallenge(models.Model):
    class Purpose(models.TextChoices):
        FEEDBACK = "FEEDBACK", "Feedback"

    class TargetType(models.TextChoices):
        ROOM = "ROOM", "Room"
        DOCTOR = "DOCTOR", "Doctor"
        DEPARTMENT = "DEPARTMENT", "Department"
        HOSPITAL = "HOSPITAL", "Hospital"

    challenge_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    phone_hash = models.CharField(max_length=128, db_index=True)
    phone_last4 = models.CharField(max_length=4, blank=True)
    purpose = models.CharField(max_length=32, choices=Purpose.choices, default=Purpose.FEEDBACK, db_index=True)
    target_type = models.CharField(max_length=32, choices=TargetType.choices, default=TargetType.ROOM, db_index=True)
    room_qr_id = models.CharField(max_length=120, blank=True, db_index=True)
    target_staff_profile = models.ForeignKey(
        StaffProfile,
        related_name="phone_verification_challenges",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    code_digest = models.CharField(max_length=128)
    verification_token_digest = models.CharField(max_length=128, blank=True)
    expires_at = models.DateTimeField(db_index=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    delivery_channel = models.CharField(max_length=32, default="sms")
    delivery_status = models.CharField(max_length=40, default="queued")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["phone_hash", "created_at"]),
            models.Index(fields=["target_type", "room_qr_id"]),
            models.Index(fields=["target_staff_profile", "created_at"]),
            models.Index(fields=["expires_at", "consumed_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.target_type} verification ending {self.phone_last4}"

    @staticmethod
    def normalize_phone(phone_number: str) -> str:
        digits = "".join(char for char in phone_number if char.isdigit())
        if not digits:
            return ""
        return f"+{digits}"

    @classmethod
    def phone_hash_for(cls, normalized_phone: str) -> str:
        return secret_digest(normalized_phone, salt="phone")

    @classmethod
    def create_for_phone(
        cls,
        *,
        phone_number: str,
        target_type: str = TargetType.ROOM,
        room_qr_id: str = "",
        target_staff_profile: StaffProfile | None = None,
        ttl_minutes: int = 10,
    ) -> tuple["PhoneVerificationChallenge", str]:
        normalized = cls.normalize_phone(phone_number)
        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge = cls.objects.create(
            phone_hash=cls.phone_hash_for(normalized),
            phone_last4=normalized[-4:],
            target_type=target_type,
            room_qr_id=room_qr_id,
            target_staff_profile=target_staff_profile,
            code_digest=secret_digest(code, salt="feedback-otp"),
            expires_at=timezone.now() + timedelta(minutes=ttl_minutes),
            delivery_status="queued",
        )
        return challenge, code

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_verified(self) -> bool:
        return self.verified_at is not None and bool(self.verification_token_digest)

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    def code_matches(self, code: str) -> bool:
        return secrets.compare_digest(self.code_digest, secret_digest(code, salt="feedback-otp"))

    def token_matches(self, token: str) -> bool:
        return bool(self.verification_token_digest) and secrets.compare_digest(
            self.verification_token_digest,
            secret_digest(token, salt=str(self.challenge_id)),
        )

    def register_failed_attempt(self) -> None:
        self.attempts += 1
        self.save(update_fields=["attempts", "updated_at"])

    def mark_verified(self) -> str:
        token = secrets.token_urlsafe(32)
        self.verified_at = timezone.now()
        self.verification_token_digest = secret_digest(token, salt=str(self.challenge_id))
        self.save(update_fields=["verified_at", "verification_token_digest", "updated_at"])
        return token

    def mark_consumed(self) -> None:
        self.consumed_at = timezone.now()
        self.save(update_fields=["consumed_at", "updated_at"])


class AnonymousFeedback(models.Model):
    class TargetType(models.TextChoices):
        ROOM = "ROOM", "Room"
        DOCTOR = "DOCTOR", "Doctor"
        DEPARTMENT = "DEPARTMENT", "Department"
        HOSPITAL = "HOSPITAL", "Hospital"

    class Category(models.TextChoices):
        GENERAL = "GENERAL", "General"
        COMPLAINT = "COMPLAINT", "Complaint"
        SUGGESTION = "SUGGESTION", "Suggestion"
        PRAISE = "PRAISE", "Praise"
        SAFETY = "SAFETY", "Safety"
        STAFF_CONDUCT = "STAFF_CONDUCT", "Staff conduct"
        WAIT_TIME = "WAIT_TIME", "Wait time"
        CLEANLINESS = "CLEANLINESS", "Cleanliness"
        PATIENT_RIGHTS = "PATIENT_RIGHTS", "Patient rights"

    class Severity(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    class Status(models.TextChoices):
        NEW = "NEW", "New"
        TRIAGED = "TRIAGED", "Triaged"
        IN_REVIEW = "IN_REVIEW", "In review"
        RESOLVED = "RESOLVED", "Resolved"
        DISMISSED = "DISMISSED", "Dismissed"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    organization = models.ForeignKey(
        Organization,
        related_name="anonymous_feedback",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    hospital = models.ForeignKey(Hospital, related_name="anonymous_feedback", on_delete=models.PROTECT, null=True, blank=True)
    department_ref = models.ForeignKey(
        Department,
        related_name="anonymous_feedback",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    room = models.ForeignKey(Room, related_name="anonymous_feedback", on_delete=models.PROTECT, null=True, blank=True)
    phone_verification = models.ForeignKey(
        PhoneVerificationChallenge,
        related_name="feedback_submissions",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    target_type = models.CharField(max_length=32, choices=TargetType.choices, default=TargetType.ROOM, db_index=True)
    target_staff_profile = models.ForeignKey(
        StaffProfile,
        related_name="anonymous_feedback_received",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    department = models.CharField(max_length=120, blank=True, db_index=True)
    room_qr_id = models.CharField(max_length=120, blank=True, db_index=True)
    anonymous_session_id = models.CharField(max_length=128, unique=True, default=uuid.uuid4)
    phone_hash = models.CharField(max_length=128, blank=True, db_index=True)
    contact_phone_number = models.CharField(max_length=40, blank=True)
    phone_verified = models.BooleanField(default=False, db_index=True)
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.GENERAL, db_index=True)
    severity = models.CharField(max_length=20, choices=Severity.choices, default=Severity.LOW, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW, db_index=True)
    requires_follow_up = models.BooleanField(default=False, db_index=True)
    language = models.CharField(max_length=16, default="uz-Latn")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["hospital", "created_at"]),
            models.Index(fields=["department", "room_qr_id"]),
            models.Index(fields=["rating", "created_at"]),
            models.Index(fields=["target_type", "status", "created_at"]),
            models.Index(fields=["target_staff_profile", "created_at"]),
            models.Index(fields=["category", "severity", "created_at"]),
            models.Index(fields=["phone_hash", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.target_type} {self.department}/{self.room_qr_id}: {self.rating}"

    def save(self, *args, **kwargs) -> None:
        if self.room_id:
            self.organization = self.organization or self.room.organization
            self.hospital = self.hospital or self.room.hospital
            self.department_ref = self.department_ref or self.room.department
        if self.target_staff_profile_id:
            self.organization = self.organization or self.target_staff_profile.organization
            self.hospital = self.hospital or self.target_staff_profile.primary_hospital
        if self.rating <= 2 or self.category in {self.Category.SAFETY, self.Category.PATIENT_RIGHTS}:
            self.requires_follow_up = True
        if self.severity in {self.Severity.HIGH, self.Severity.CRITICAL}:
            self.requires_follow_up = True
        super().save(*args, **kwargs)


class AuditEvent(models.Model):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Create"
        READ = "READ", "Read"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"
        EXPORT = "EXPORT", "Export"
        PRINT = "PRINT", "Print"
        BREAK_GLASS = "BREAK_GLASS", "Break glass"
        AI_REVIEW = "AI_REVIEW", "AI review"
        DISCHARGE = "DISCHARGE", "Discharge"
        FEEDBACK_SUBMITTED = "FEEDBACK_SUBMITTED", "Feedback submitted"

    class RiskLevel(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    id = models.BigAutoField(primary_key=True)
    event_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="audit_events",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    organization = models.ForeignKey(Organization, related_name="audit_events", on_delete=models.PROTECT, null=True, blank=True)
    hospital = models.ForeignKey(Hospital, related_name="audit_events", on_delete=models.PROTECT, null=True, blank=True)
    patient = models.ForeignKey(Patient, related_name="audit_events", on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=32, choices=Action.choices, db_index=True)
    resource_type = models.CharField(max_length=120, db_index=True)
    resource_id = models.CharField(max_length=120, blank=True, db_index=True)
    resource_public_id = models.UUIDField(null=True, blank=True, db_index=True)
    request_id = models.CharField(max_length=120, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    phi_accessed = models.BooleanField(default=False, db_index=True)
    success = models.BooleanField(default=True, db_index=True)
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices, default=RiskLevel.LOW, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["patient", "created_at"]),
            models.Index(fields=["action", "risk_level", "created_at"]),
            models.Index(fields=["phi_accessed", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.action} {self.resource_type} {self.created_at:%Y-%m-%d %H:%M:%S}"

    def save(self, *args, **kwargs) -> None:
        if self.pk and not kwargs.get("force_insert"):
            raise RuntimeError("AuditEvent records are append-only.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("AuditEvent records are append-only.")
