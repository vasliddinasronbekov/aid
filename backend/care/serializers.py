from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

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


User = get_user_model()


class AuthStaffProfileSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    primary_hospital_name = serializers.CharField(source="primary_hospital.name", read_only=True)

    class Meta:
        model = StaffProfile
        fields = [
            "id",
            "public_id",
            "organization",
            "organization_name",
            "primary_hospital",
            "primary_hospital_name",
            "role",
            "employment_status",
            "license_number",
            "phone_number",
            "metadata",
        ]
        read_only_fields = fields


class AuthUserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    staff_profile = AuthStaffProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "is_superuser",
            "staff_profile",
        ]
        read_only_fields = fields

    def get_display_name(self, obj) -> str:
        return obj.get_full_name() or obj.username


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        request = self.context.get("request")
        user = authenticate(request=request, username=attrs["username"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError({"username": "Invalid username or password."})
        if not user.is_active:
            raise serializers.ValidationError({"username": "This account is inactive."})
        attrs["user"] = user
        return attrs


class RegisterSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=[
            StaffProfile.Role.HOSPITAL_ADMIN,
            StaffProfile.Role.HEAD_PHYSICIAN,
            StaffProfile.Role.PHYSICIAN,
            StaffProfile.Role.NURSE,
        ],
        default=StaffProfile.Role.HEAD_PHYSICIAN,
    )
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(trim_whitespace=False, write_only=True)
    first_name = serializers.CharField(max_length=120)
    last_name = serializers.CharField(max_length=120)
    organization_name = serializers.CharField(max_length=180)
    hospital_name = serializers.CharField(max_length=180)
    region_code = serializers.CharField(max_length=64, default="andijan-central")
    phone_number = serializers.CharField(max_length=32, required=False, allow_blank=True)
    license_number = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_username(self, value: str) -> str:
        username = value.strip()
        if not username:
            raise serializers.ValidationError("Username is required.")
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError("This username is already registered.")
        return username

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        with transaction.atomic():
            organization = Organization.objects.create(
                name=validated_data["organization_name"].strip(),
                legal_name=validated_data["organization_name"].strip(),
                data_region="uz",
                locale="uz-Latn",
            )
            hospital = Hospital.objects.create(
                organization=organization,
                code=validated_data["username"][:64],
                name=validated_data["hospital_name"].strip(),
                region_code=validated_data["region_code"].strip() or "andijan-central",
            )
            user = User.objects.create_user(
                username=validated_data["username"],
                email=validated_data.get("email", "").strip(),
                password=validated_data["password"],
                first_name=validated_data["first_name"].strip(),
                last_name=validated_data["last_name"].strip(),
            )
            StaffProfile.objects.create(
                user=user,
                organization=organization,
                primary_hospital=hospital,
                role=validated_data["role"],
                phone_number=validated_data.get("phone_number", "").strip(),
                license_number=validated_data.get("license_number", "").strip(),
                metadata={"registration_source": "self_service"},
            )
        return user


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = [
            "id",
            "public_id",
            "name",
            "legal_name",
            "registration_number",
            "data_region",
            "timezone",
            "locale",
            "compliance_profile",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "public_id", "created_at", "updated_at"]


class HospitalSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)

    class Meta:
        model = Hospital
        fields = [
            "id",
            "public_id",
            "organization",
            "organization_name",
            "code",
            "name",
            "facility_type",
            "address_line",
            "city",
            "region_code",
            "phone_number",
            "timezone",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "public_id", "organization_name", "created_at", "updated_at"]


class DepartmentSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)

    class Meta:
        model = Department
        fields = [
            "id",
            "public_id",
            "organization",
            "organization_name",
            "hospital",
            "hospital_name",
            "code",
            "name",
            "specialty",
            "floor",
            "phone_number",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "public_id", "organization_name", "hospital_name", "created_at", "updated_at"]


class RoomSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Room
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "hospital_name",
            "department",
            "department_name",
            "room_number",
            "room_qr_id",
            "care_level",
            "bed_count",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "public_id", "hospital_name", "department_name", "created_at", "updated_at"]


class StaffProfileSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_display_name = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    primary_hospital_name = serializers.CharField(source="primary_hospital.name", read_only=True)

    class Meta:
        model = StaffProfile
        fields = [
            "id",
            "public_id",
            "user",
            "user_username",
            "user_display_name",
            "organization",
            "organization_name",
            "primary_hospital",
            "primary_hospital_name",
            "departments",
            "role",
            "employment_status",
            "license_number",
            "phone_number",
            "last_privacy_training_at",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "user_username",
            "user_display_name",
            "organization_name",
            "primary_hospital_name",
            "created_at",
            "updated_at",
        ]

    def get_user_display_name(self, obj: StaffProfile) -> str:
        return obj.user.get_full_name() or obj.user.username


class AccessGrantSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = AccessGrant
        fields = [
            "id",
            "public_id",
            "staff_profile",
            "staff_name",
            "scope",
            "hospital",
            "department",
            "room",
            "starts_at",
            "ends_at",
            "reason",
            "granted_by",
            "revoked_at",
            "revoked_by",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "public_id", "staff_name", "is_active", "created_at", "updated_at"]

    def get_staff_name(self, obj: AccessGrant) -> str:
        return obj.staff_profile.user.get_full_name() or obj.staff_profile.user.username


class PatientSerializer(serializers.ModelSerializer):
    severe_chronic_tags = serializers.ListField(read_only=True)
    has_severe_chronic_risk = serializers.BooleanField(read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    department_name = serializers.CharField(source="department_ref.name", read_only=True)
    room_label = serializers.CharField(source="room.room_number", read_only=True)

    class Meta:
        model = Patient
        fields = [
            "id",
            "public_id",
            "organization",
            "organization_name",
            "hospital",
            "hospital_name",
            "department_ref",
            "department_name",
            "room",
            "room_label",
            "patient_identifier",
            "medical_record_number",
            "first_name",
            "last_name",
            "middle_name",
            "display_name",
            "date_of_birth",
            "gender",
            "phone_number",
            "address_line",
            "region_code",
            "district",
            "department",
            "triage_status",
            "chronic_biomarkers",
            "emergency_contact",
            "consent_preferences",
            "severe_chronic_tags",
            "has_severe_chronic_risk",
            "last_marker_sync_at",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "display_name",
            "organization_name",
            "hospital_name",
            "department_name",
            "room_label",
            "created_at",
            "updated_at",
            "last_marker_sync_at",
        ]


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    patient_triage_status = serializers.CharField(source="patient.triage_status", read_only=True)
    provider_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    department_name = serializers.CharField(source="department_ref.name", read_only=True)
    room_label = serializers.CharField(source="room.room_number", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "hospital_name",
            "department_ref",
            "department_name",
            "room",
            "room_label",
            "patient",
            "patient_name",
            "patient_triage_status",
            "assigned_provider",
            "provider_name",
            "created_by",
            "created_by_name",
            "appointment_type",
            "status",
            "priority",
            "scheduled_start",
            "scheduled_end",
            "checked_in_at",
            "completed_at",
            "cancelled_at",
            "cancel_reason",
            "reason",
            "notes",
            "external_reference",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "hospital_name",
            "department_name",
            "room_label",
            "patient_name",
            "patient_triage_status",
            "provider_name",
            "created_by",
            "created_by_name",
            "checked_in_at",
            "completed_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]

    def get_provider_name(self, obj: Appointment) -> str:
        if not obj.assigned_provider_id:
            return ""
        return obj.assigned_provider.get_full_name() or obj.assigned_provider.username

    def get_created_by_name(self, obj: Appointment) -> str:
        if not obj.created_by_id:
            return ""
        return obj.created_by.get_full_name() or obj.created_by.username

    def validate(self, attrs):
        scheduled_start = attrs.get("scheduled_start", getattr(self.instance, "scheduled_start", None))
        scheduled_end = attrs.get("scheduled_end", getattr(self.instance, "scheduled_end", None))
        if scheduled_start and scheduled_end and scheduled_end <= scheduled_start:
            raise serializers.ValidationError({"scheduled_end": "scheduled_end must be after scheduled_start."})
        return attrs


class EncounterSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    provider_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    department_name = serializers.CharField(source="department_ref.name", read_only=True)
    room_label = serializers.CharField(source="room.room_number", read_only=True)

    class Meta:
        model = Encounter
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "hospital_name",
            "department_ref",
            "department_name",
            "room",
            "room_label",
            "patient",
            "patient_name",
            "appointment",
            "provider",
            "provider_name",
            "encounter_type",
            "status",
            "started_at",
            "ended_at",
            "chief_complaint",
            "assessment",
            "plan",
            "follow_up_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "hospital_name",
            "department_name",
            "room_label",
            "patient_name",
            "provider_name",
            "ended_at",
            "created_at",
            "updated_at",
        ]

    def get_provider_name(self, obj: Encounter) -> str:
        if not obj.provider_id:
            return ""
        return obj.provider.get_full_name() or obj.provider.username

    def validate(self, attrs):
        started_at = attrs.get("started_at", getattr(self.instance, "started_at", None))
        ended_at = attrs.get("ended_at", getattr(self.instance, "ended_at", None))
        if started_at and ended_at and ended_at <= started_at:
            raise serializers.ValidationError({"ended_at": "ended_at must be after started_at."})
        return attrs


class PatientVitalSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PatientVital
        fields = [
            "id",
            "public_id",
            "patient",
            "patient_name",
            "encounter",
            "organization",
            "hospital",
            "recorded_by",
            "recorded_by_name",
            "measured_at",
            "systolic_bp",
            "diastolic_bp",
            "heart_rate",
            "respiratory_rate",
            "oxygen_saturation",
            "temperature_c",
            "glucose_mmol_l",
            "weight_kg",
            "height_cm",
            "pain_score",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "patient_name",
            "recorded_by",
            "recorded_by_name",
            "created_at",
            "updated_at",
        ]

    def get_recorded_by_name(self, obj: PatientVital) -> str:
        if not obj.recorded_by_id:
            return ""
        return obj.recorded_by.get_full_name() or obj.recorded_by.username

    def validate(self, attrs):
        systolic_bp = attrs.get("systolic_bp", getattr(self.instance, "systolic_bp", None))
        diastolic_bp = attrs.get("diastolic_bp", getattr(self.instance, "diastolic_bp", None))
        if systolic_bp and diastolic_bp and diastolic_bp > systolic_bp:
            raise serializers.ValidationError({"diastolic_bp": "diastolic_bp cannot exceed systolic_bp."})
        return attrs


class PatientAllergySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PatientAllergy
        fields = [
            "id",
            "public_id",
            "patient",
            "patient_name",
            "organization",
            "hospital",
            "recorded_by",
            "recorded_by_name",
            "allergen",
            "reaction",
            "severity",
            "status",
            "onset_date",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "patient_name",
            "recorded_by",
            "recorded_by_name",
            "created_at",
            "updated_at",
        ]

    def get_recorded_by_name(self, obj: PatientAllergy) -> str:
        if not obj.recorded_by_id:
            return ""
        return obj.recorded_by.get_full_name() or obj.recorded_by.username

    def validate_allergen(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Allergen is required.")
        return value


class CareTeamMembershipSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    staff_name = serializers.SerializerMethodField()
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = CareTeamMembership
        fields = [
            "id",
            "public_id",
            "patient",
            "patient_name",
            "staff_profile",
            "staff_name",
            "organization",
            "organization_name",
            "hospital",
            "hospital_name",
            "role",
            "starts_at",
            "ends_at",
            "is_primary",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "patient_name",
            "staff_name",
            "organization_name",
            "hospital_name",
            "is_active",
            "created_at",
            "updated_at",
        ]

    def get_staff_name(self, obj: CareTeamMembership) -> str:
        return obj.staff_profile.user.get_full_name() or obj.staff_profile.user.username

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "ends_at must be after starts_at."})
        return attrs


class ClinicalTaskSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    department_name = serializers.CharField(source="department_ref.name", read_only=True)

    class Meta:
        model = ClinicalTask
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "hospital_name",
            "department_ref",
            "department_name",
            "patient",
            "patient_name",
            "encounter",
            "appointment",
            "assigned_to",
            "assigned_to_name",
            "created_by",
            "created_by_name",
            "task_type",
            "status",
            "priority",
            "title",
            "description",
            "due_at",
            "started_at",
            "completed_at",
            "cancelled_at",
            "completion_note",
            "idempotency_key",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "hospital_name",
            "department_name",
            "patient_name",
            "created_by",
            "created_by_name",
            "assigned_to_name",
            "started_at",
            "completed_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]

    def get_assigned_to_name(self, obj: ClinicalTask) -> str:
        if not obj.assigned_to_id:
            return ""
        return obj.assigned_to.user.get_full_name() or obj.assigned_to.user.username

    def get_created_by_name(self, obj: ClinicalTask) -> str:
        if not obj.created_by_id:
            return ""
        return obj.created_by.get_full_name() or obj.created_by.username

    def validate(self, attrs):
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        encounter = attrs.get("encounter", getattr(self.instance, "encounter", None))
        appointment = attrs.get("appointment", getattr(self.instance, "appointment", None))
        if not patient and not encounter and not appointment:
            raise serializers.ValidationError("A task must be linked to a patient, encounter, or appointment.")
        if patient and encounter and encounter.patient_id != patient.id:
            raise serializers.ValidationError({"encounter": "Encounter belongs to a different patient."})
        if patient and appointment and appointment.patient_id != patient.id:
            raise serializers.ValidationError({"appointment": "Appointment belongs to a different patient."})
        return attrs


class ReferralSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    source_department_name = serializers.CharField(source="source_department.name", read_only=True)
    target_hospital_name = serializers.CharField(source="target_hospital.name", read_only=True)
    target_department_name = serializers.CharField(source="target_department.name", read_only=True)

    class Meta:
        model = Referral
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "patient",
            "patient_name",
            "encounter",
            "source_department",
            "source_department_name",
            "target_hospital",
            "target_hospital_name",
            "target_department",
            "target_department_name",
            "requested_by",
            "requested_by_name",
            "assigned_to",
            "assigned_to_name",
            "referral_type",
            "status",
            "priority",
            "reason",
            "clinical_summary",
            "requested_at",
            "accepted_at",
            "completed_at",
            "cancelled_at",
            "cancellation_reason",
            "external_reference",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "patient_name",
            "requested_by",
            "requested_by_name",
            "assigned_to_name",
            "source_department_name",
            "target_hospital_name",
            "target_department_name",
            "accepted_at",
            "completed_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]

    def get_requested_by_name(self, obj: Referral) -> str:
        if not obj.requested_by_id:
            return ""
        return obj.requested_by.get_full_name() or obj.requested_by.username

    def get_assigned_to_name(self, obj: Referral) -> str:
        if not obj.assigned_to_id:
            return ""
        return obj.assigned_to.user.get_full_name() or obj.assigned_to.user.username

    def validate(self, attrs):
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        encounter = attrs.get("encounter", getattr(self.instance, "encounter", None))
        if patient and encounter and encounter.patient_id != patient.id:
            raise serializers.ValidationError({"encounter": "Encounter belongs to a different patient."})
        return attrs


class DiagnosticOrderSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    ordered_by_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    department_name = serializers.CharField(source="department_ref.name", read_only=True)

    class Meta:
        model = DiagnosticOrder
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "hospital_name",
            "department_ref",
            "department_name",
            "patient",
            "patient_name",
            "encounter",
            "ordered_by",
            "ordered_by_name",
            "order_type",
            "status",
            "priority",
            "code",
            "name",
            "indication",
            "specimen",
            "scheduled_at",
            "collected_at",
            "resulted_at",
            "result_summary",
            "result_payload",
            "cancellation_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "hospital_name",
            "department_name",
            "patient_name",
            "ordered_by",
            "ordered_by_name",
            "collected_at",
            "resulted_at",
            "created_at",
            "updated_at",
        ]

    def get_ordered_by_name(self, obj: DiagnosticOrder) -> str:
        if not obj.ordered_by_id:
            return ""
        return obj.ordered_by.get_full_name() or obj.ordered_by.username

    def validate(self, attrs):
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        encounter = attrs.get("encounter", getattr(self.instance, "encounter", None))
        if patient and encounter and encounter.patient_id != patient.id:
            raise serializers.ValidationError({"encounter": "Encounter belongs to a different patient."})
        collected_at = attrs.get("collected_at", getattr(self.instance, "collected_at", None))
        resulted_at = attrs.get("resulted_at", getattr(self.instance, "resulted_at", None))
        if collected_at and resulted_at and resulted_at < collected_at:
            raise serializers.ValidationError({"resulted_at": "resulted_at cannot be before collected_at."})
        return attrs


class AdmissionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    patient_triage_status = serializers.CharField(source="patient.triage_status", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    admitting_provider_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    department_name = serializers.CharField(source="department_ref.name", read_only=True)
    room_label = serializers.CharField(source="room.room_number", read_only=True)

    class Meta:
        model = Admission
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "hospital_name",
            "patient",
            "patient_name",
            "patient_triage_status",
            "encounter",
            "referral",
            "requested_by",
            "requested_by_name",
            "admitting_provider",
            "admitting_provider_name",
            "department_ref",
            "department_name",
            "room",
            "room_label",
            "source",
            "status",
            "priority",
            "reason",
            "requested_at",
            "waitlisted_at",
            "admitted_at",
            "transferred_at",
            "discharged_at",
            "cancelled_at",
            "discharge_summary",
            "cancellation_reason",
            "triage_snapshot",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "hospital_name",
            "patient_name",
            "patient_triage_status",
            "requested_by",
            "requested_by_name",
            "admitting_provider_name",
            "department_name",
            "room_label",
            "waitlisted_at",
            "admitted_at",
            "transferred_at",
            "discharged_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]

    def get_requested_by_name(self, obj: Admission) -> str:
        if not obj.requested_by_id:
            return ""
        return obj.requested_by.get_full_name() or obj.requested_by.username

    def get_admitting_provider_name(self, obj: Admission) -> str:
        if not obj.admitting_provider_id:
            return ""
        return obj.admitting_provider.get_full_name() or obj.admitting_provider.username

    def validate(self, attrs):
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        encounter = attrs.get("encounter", getattr(self.instance, "encounter", None))
        referral = attrs.get("referral", getattr(self.instance, "referral", None))
        if patient and encounter and encounter.patient_id != patient.id:
            raise serializers.ValidationError({"encounter": "Encounter belongs to a different patient."})
        if patient and referral and referral.patient_id != patient.id:
            raise serializers.ValidationError({"referral": "Referral belongs to a different patient."})
        return attrs


class PerinatalRegistryEntrySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone_number", read_only=True)
    assigned_provider_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    department_name = serializers.CharField(source="department_ref.name", read_only=True)

    class Meta:
        model = PerinatalRegistryEntry
        fields = [
            "id",
            "public_id",
            "patient",
            "patient_name",
            "patient_phone",
            "organization",
            "hospital",
            "hospital_name",
            "department_ref",
            "department_name",
            "assigned_provider",
            "assigned_provider_name",
            "status",
            "risk_level",
            "gestational_age_weeks",
            "gestational_age_days",
            "gravida",
            "para",
            "last_menstrual_period",
            "estimated_due_date",
            "enrollment_reason",
            "risk_factors",
            "latest_systolic_bp",
            "latest_diastolic_bp",
            "latest_glucose_mmol_l",
            "fetal_notes",
            "next_visit_at",
            "enrolled_at",
            "closed_at",
            "outcome_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "patient_name",
            "patient_phone",
            "hospital_name",
            "department_name",
            "assigned_provider_name",
            "closed_at",
            "created_at",
            "updated_at",
        ]

    def get_assigned_provider_name(self, obj: PerinatalRegistryEntry) -> str:
        if not obj.assigned_provider_id:
            return ""
        return obj.assigned_provider.get_full_name() or obj.assigned_provider.username

    def validate(self, attrs):
        systolic_bp = attrs.get("latest_systolic_bp", getattr(self.instance, "latest_systolic_bp", None))
        diastolic_bp = attrs.get("latest_diastolic_bp", getattr(self.instance, "latest_diastolic_bp", None))
        if systolic_bp and diastolic_bp and diastolic_bp > systolic_bp:
            raise serializers.ValidationError({"latest_diastolic_bp": "latest_diastolic_bp cannot exceed latest_systolic_bp."})
        risk_factors = attrs.get("risk_factors", getattr(self.instance, "risk_factors", []))
        if risk_factors is not None and not isinstance(risk_factors, list):
            raise serializers.ValidationError({"risk_factors": "risk_factors must be a list."})
        return attrs


class PatronageVisitSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)

    class Meta:
        model = PatronageVisit
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "hospital_name",
            "patient",
            "patient_name",
            "assigned_to",
            "assigned_to_name",
            "created_by",
            "created_by_name",
            "visit_type",
            "status",
            "priority",
            "territory",
            "scheduled_for",
            "visited_at",
            "synced_at",
            "client_reference",
            "idempotency_key",
            "client_updated_at",
            "server_version",
            "payload",
            "conflict_payload",
            "conflict_reason",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "hospital_name",
            "patient_name",
            "assigned_to_name",
            "created_by",
            "created_by_name",
            "visited_at",
            "synced_at",
            "server_version",
            "conflict_payload",
            "conflict_reason",
            "created_at",
            "updated_at",
        ]

    def get_assigned_to_name(self, obj: PatronageVisit) -> str:
        if not obj.assigned_to_id:
            return ""
        return obj.assigned_to.user.get_full_name() or obj.assigned_to.user.username

    def get_created_by_name(self, obj: PatronageVisit) -> str:
        if not obj.created_by_id:
            return ""
        return obj.created_by.get_full_name() or obj.created_by.username

    def validate(self, attrs):
        payload = attrs.get("payload", getattr(self.instance, "payload", {}))
        if payload is not None and not isinstance(payload, dict):
            raise serializers.ValidationError({"payload": "payload must be an object."})
        return attrs


class PatientDuplicateCandidateSerializer(serializers.ModelSerializer):
    primary_patient_name = serializers.CharField(source="primary_patient.display_name", read_only=True)
    primary_medical_record_number = serializers.CharField(source="primary_patient.medical_record_number", read_only=True)
    duplicate_patient_name = serializers.CharField(source="duplicate_patient.display_name", read_only=True)
    duplicate_medical_record_number = serializers.CharField(source="duplicate_patient.medical_record_number", read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)

    class Meta:
        model = PatientDuplicateCandidate
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "hospital_name",
            "primary_patient",
            "primary_patient_name",
            "primary_medical_record_number",
            "duplicate_patient",
            "duplicate_patient_name",
            "duplicate_medical_record_number",
            "score",
            "match_reasons",
            "status",
            "detected_at",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "review_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "hospital_name",
            "primary_patient_name",
            "primary_medical_record_number",
            "duplicate_patient_name",
            "duplicate_medical_record_number",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]

    def get_reviewed_by_name(self, obj: PatientDuplicateCandidate) -> str:
        if not obj.reviewed_by_id:
            return ""
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username

    def validate(self, attrs):
        primary_patient = attrs.get("primary_patient", getattr(self.instance, "primary_patient", None))
        duplicate_patient = attrs.get("duplicate_patient", getattr(self.instance, "duplicate_patient", None))
        if primary_patient and duplicate_patient and primary_patient.id == duplicate_patient.id:
            raise serializers.ValidationError({"duplicate_patient": "duplicate_patient must be different from primary_patient."})
        if primary_patient and duplicate_patient and primary_patient.organization_id != duplicate_patient.organization_id:
            raise serializers.ValidationError({"duplicate_patient": "Patients must belong to the same organization."})
        match_reasons = attrs.get("match_reasons", getattr(self.instance, "match_reasons", []))
        if match_reasons is not None and not isinstance(match_reasons, list):
            raise serializers.ValidationError({"match_reasons": "match_reasons must be a list."})
        return attrs


class AIErrLogSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="medical_record.patient.display_name", read_only=True)
    doctor_id = serializers.CharField(source="medical_record.doctor_id", read_only=True)
    medical_record_created_at = serializers.DateTimeField(source="medical_record.created_at", read_only=True)
    medical_record_ai_review_status = serializers.CharField(source="medical_record.ai_review_status", read_only=True)

    class Meta:
        model = AIErrLog
        fields = [
            "id",
            "organization",
            "hospital",
            "medical_record",
            "patient_name",
            "doctor_id",
            "medical_record_created_at",
            "medical_record_ai_review_status",
            "error_type",
            "severity",
            "rca_description",
            "protocol_reference",
            "reviewed_by_admin",
            "created_at",
        ]
        read_only_fields = ["id", "organization", "hospital", "patient_name", "created_at"]


class AIAssistantMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAssistantMessage
        fields = [
            "id",
            "session",
            "role",
            "content",
            "risk_level",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AIAssistantSessionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    staff_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    messages = AIAssistantMessageSerializer(many=True, read_only=True)

    class Meta:
        model = AIAssistantSession
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "patient",
            "patient_name",
            "medical_record",
            "staff_profile",
            "staff_name",
            "created_by",
            "created_by_name",
            "mode",
            "safety_status",
            "title",
            "context_snapshot",
            "closed_at",
            "messages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "patient_name",
            "staff_profile",
            "staff_name",
            "created_by",
            "created_by_name",
            "closed_at",
            "messages",
            "created_at",
            "updated_at",
        ]

    def get_staff_name(self, obj: AIAssistantSession) -> str:
        if not obj.staff_profile_id:
            return ""
        return obj.staff_profile.user.get_full_name() or obj.staff_profile.user.username

    def get_created_by_name(self, obj: AIAssistantSession) -> str:
        if not obj.created_by_id:
            return ""
        return obj.created_by.get_full_name() or obj.created_by.username


class MedicalRecordSerializer(serializers.ModelSerializer):
    ai_error_logs = AIErrLogSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)
    patient_triage_status = serializers.CharField(source="patient.triage_status", read_only=True)

    class Meta:
        model = MedicalRecord
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "department_ref",
            "patient",
            "patient_name",
            "patient_triage_status",
            "attending_provider",
            "doctor_id",
            "diagnosis",
            "prescriptions",
            "clinical_notes",
            "ai_review_status",
            "imaging_safety_metadata",
            "record_type",
            "discharge_status",
            "active_call_alert_sent_at",
            "ai_error_logs",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "ai_review_status",
            "active_call_alert_sent_at",
            "ai_error_logs",
            "patient_name",
            "patient_triage_status",
            "created_at",
            "updated_at",
        ]

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if not self._can_view_ai_review(request):
            fields.pop("ai_review_status", None)
            fields.pop("ai_error_logs", None)
        return fields

    @staticmethod
    def _can_view_ai_review(request) -> bool:
        if not request or not getattr(request, "user", None) or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = getattr(request.user, "staff_profile", None)
        return bool(
            profile
            and profile.role
            in {
                StaffProfile.Role.SYSTEM_ADMIN,
                StaffProfile.Role.HOSPITAL_ADMIN,
                StaffProfile.Role.HEAD_PHYSICIAN,
                StaffProfile.Role.COMPLIANCE_OFFICER,
                StaffProfile.Role.AUDITOR,
            }
        )


class PhoneVerificationRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=40, write_only=True)
    target_type = serializers.ChoiceField(
        choices=PhoneVerificationChallenge.TargetType.choices,
        default=PhoneVerificationChallenge.TargetType.ROOM,
    )
    room_qr_id = serializers.CharField(max_length=120, required=False, allow_blank=True)
    target_staff_profile = serializers.PrimaryKeyRelatedField(
        queryset=StaffProfile.objects.select_related("organization", "primary_hospital").filter(
            employment_status=StaffProfile.EmploymentStatus.ACTIVE
        ),
        required=False,
        allow_null=True,
    )

    def validate_phone_number(self, value: str) -> str:
        normalized = PhoneVerificationChallenge.normalize_phone(value)
        digits = "".join(char for char in normalized if char.isdigit())
        if len(digits) < 8 or len(digits) > 15:
            raise serializers.ValidationError("Enter a valid phone number.")
        return normalized

    def validate(self, attrs):
        target_type = attrs.get("target_type")
        if target_type == PhoneVerificationChallenge.TargetType.ROOM and not attrs.get("room_qr_id"):
            raise serializers.ValidationError({"room_qr_id": "room_qr_id is required for room feedback."})
        if target_type == PhoneVerificationChallenge.TargetType.DOCTOR and not attrs.get("target_staff_profile"):
            raise serializers.ValidationError({"target_staff_profile": "target_staff_profile is required for doctor feedback."})
        return attrs


class PhoneVerificationVerifySerializer(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    code = serializers.CharField(max_length=12, trim_whitespace=True)


class AnonymousFeedbackSerializer(serializers.ModelSerializer):
    anonymous_session_id = serializers.CharField(required=False)
    phone_verification_challenge = serializers.UUIDField(write_only=True, required=False)
    phone_verification_token = serializers.CharField(write_only=True, required=False, trim_whitespace=True)
    phone_number = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=40)
    target_staff_name = serializers.SerializerMethodField()

    class Meta:
        model = AnonymousFeedback
        fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "department_ref",
            "room",
            "phone_verification",
            "target_type",
            "target_staff_profile",
            "target_doctor_label",
            "target_staff_name",
            "department",
            "room_qr_id",
            "anonymous_session_id",
            "phone_hash",
            "contact_phone_number",
            "phone_verified",
            "category",
            "severity",
            "status",
            "requires_follow_up",
            "language",
            "rating",
            "comment",
            "phone_number",
            "phone_verification_challenge",
            "phone_verification_token",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "public_id",
            "organization",
            "hospital",
            "department_ref",
            "room",
            "phone_verification",
            "target_staff_name",
            "phone_hash",
            "contact_phone_number",
            "phone_verified",
            "requires_follow_up",
            "created_at",
        ]

    def get_target_staff_name(self, obj: AnonymousFeedback) -> str:
        if not obj.target_staff_profile_id:
            return obj.target_doctor_label
        return obj.target_staff_profile.user.get_full_name() or obj.target_staff_profile.user.username

    def validate(self, attrs):
        view = self.context.get("view")
        if getattr(view, "action", "") == "create":
            has_verification = attrs.get("phone_verification_challenge") and attrs.get("phone_verification_token")
            has_phone = bool(attrs.get("phone_number", "").strip())
            if not has_verification and not has_phone:
                raise serializers.ValidationError({"phone_number": "Phone number is required."})
            if (
                attrs.get("target_type") == AnonymousFeedback.TargetType.DOCTOR
                and not attrs.get("target_staff_profile")
                and not attrs.get("target_doctor_label", "").strip()
            ):
                raise serializers.ValidationError({"target_staff_profile": "Select a doctor."})
        return attrs

    def validate_phone_number(self, value: str) -> str:
        if not value.strip():
            return ""
        normalized = PhoneVerificationChallenge.normalize_phone(value)
        digits = "".join(char for char in normalized if char.isdigit())
        if len(digits) < 8 or len(digits) > 15:
            raise serializers.ValidationError("Enter a valid phone number.")
        return normalized

    def validate_comment(self, value: str) -> str:
        return value.strip()


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    patient_name = serializers.CharField(source="patient.display_name", read_only=True)

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "event_id",
            "actor",
            "actor_username",
            "organization",
            "hospital",
            "patient",
            "patient_name",
            "action",
            "resource_type",
            "resource_id",
            "resource_public_id",
            "request_id",
            "ip_address",
            "user_agent",
            "phi_accessed",
            "success",
            "risk_level",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields
