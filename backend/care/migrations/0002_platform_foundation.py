# Platform foundation schema for production healthcare CRM.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


def populate_existing_public_ids(apps, schema_editor):
    for model_name in ("Patient", "MedicalRecord", "AnonymousFeedback"):
        model = apps.get_model("care", model_name)
        for instance in model.objects.filter(public_id__isnull=True).only("pk"):
            instance.public_id = uuid.uuid4()
            instance.save(update_fields=["public_id"])


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("care", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=180)),
                ("legal_name", models.CharField(blank=True, max_length=240)),
                ("registration_number", models.CharField(blank=True, max_length=120)),
                ("data_region", models.CharField(default="uz", max_length=64)),
                ("timezone", models.CharField(default="Asia/Tashkent", max_length=64)),
                ("locale", models.CharField(default="uz-Latn", max_length=16)),
                ("compliance_profile", models.JSONField(blank=True, default=dict)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
            ],
            options={
                "ordering": ["name"],
                "indexes": [
                    models.Index(fields=["is_active", "name"], name="care_organi_is_acti_42f645_idx"),
                    models.Index(fields=["data_region", "is_active"], name="care_organi_data_re_1161d9_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Hospital",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("code", models.CharField(max_length=64)),
                ("name", models.CharField(max_length=180)),
                ("facility_type", models.CharField(blank=True, max_length=80)),
                ("address_line", models.CharField(blank=True, max_length=240)),
                ("city", models.CharField(blank=True, max_length=120)),
                ("region_code", models.CharField(db_index=True, max_length=64)),
                ("phone_number", models.CharField(blank=True, max_length=32)),
                ("timezone", models.CharField(default="Asia/Tashkent", max_length=64)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="hospitals",
                        to="care.organization",
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
                "indexes": [
                    models.Index(fields=["organization", "is_active"], name="care_hospit_organiz_7ef5dc_idx"),
                    models.Index(fields=["region_code", "is_active"], name="care_hospit_region__8ea232_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("organization", "code"), name="unique_hospital_code_per_org"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Department",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("code", models.CharField(max_length=64)),
                ("name", models.CharField(max_length=160)),
                (
                    "specialty",
                    models.CharField(
                        choices=[
                            ("PERINATAL", "Perinatal"),
                            ("CARDIOLOGY", "Cardiology"),
                            ("THERAPY", "Therapy"),
                            ("IMAGING", "Imaging"),
                            ("EMERGENCY", "Emergency"),
                            ("SURGERY", "Surgery"),
                            ("LABORATORY", "Laboratory"),
                            ("ADMINISTRATION", "Administration"),
                            ("OTHER", "Other"),
                        ],
                        db_index=True,
                        default="OTHER",
                        max_length=32,
                    ),
                ),
                ("floor", models.CharField(blank=True, max_length=40)),
                ("phone_number", models.CharField(blank=True, max_length=32)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "hospital",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="departments",
                        to="care.hospital",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="departments",
                        to="care.organization",
                    ),
                ),
            ],
            options={
                "ordering": ["hospital__name", "name"],
                "indexes": [
                    models.Index(fields=["organization", "specialty"], name="care_depart_organiz_2d5047_idx"),
                    models.Index(fields=["hospital", "is_active"], name="care_depart_hospita_dbb29e_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("hospital", "code"), name="unique_department_code_per_hospital"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Room",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("room_number", models.CharField(max_length=64)),
                ("room_qr_id", models.CharField(db_index=True, max_length=140, unique=True)),
                (
                    "care_level",
                    models.CharField(
                        choices=[
                            ("GENERAL", "General"),
                            ("HIGH_DEPENDENCY", "High dependency"),
                            ("ICU", "ICU"),
                            ("DELIVERY", "Delivery"),
                            ("IMAGING", "Imaging"),
                            ("PROCEDURE", "Procedure"),
                            ("EMERGENCY", "Emergency"),
                        ],
                        default="GENERAL",
                        max_length=32,
                    ),
                ),
                ("bed_count", models.PositiveSmallIntegerField(default=1)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "department",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="rooms",
                        to="care.department",
                    ),
                ),
                (
                    "hospital",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="rooms",
                        to="care.hospital",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="rooms",
                        to="care.organization",
                    ),
                ),
            ],
            options={
                "ordering": ["department__name", "room_number"],
                "indexes": [
                    models.Index(fields=["organization", "is_active"], name="care_room_organiz_cdfb82_idx"),
                    models.Index(fields=["hospital", "department"], name="care_room_hospita_7ebd8d_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(fields=("department", "room_number"), name="unique_room_number_per_department"),
                ],
            },
        ),
        migrations.CreateModel(
            name="StaffProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("SYSTEM_ADMIN", "System admin"),
                            ("HOSPITAL_ADMIN", "Hospital admin"),
                            ("HEAD_PHYSICIAN", "Head physician"),
                            ("PHYSICIAN", "Physician"),
                            ("NURSE", "Nurse"),
                            ("REGISTRAR", "Registrar"),
                            ("COMPLIANCE_OFFICER", "Compliance officer"),
                            ("RESEARCHER", "Researcher"),
                            ("AUDITOR", "Auditor"),
                            ("READ_ONLY", "Read only"),
                        ],
                        db_index=True,
                        max_length=32,
                    ),
                ),
                (
                    "employment_status",
                    models.CharField(
                        choices=[("ACTIVE", "Active"), ("SUSPENDED", "Suspended"), ("TERMINATED", "Terminated")],
                        db_index=True,
                        default="ACTIVE",
                        max_length=20,
                    ),
                ),
                ("license_number", models.CharField(blank=True, max_length=120)),
                ("phone_number", models.CharField(blank=True, max_length=32)),
                ("last_privacy_training_at", models.DateField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "departments",
                    models.ManyToManyField(blank=True, related_name="staff_profiles", to="care.department"),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="staff_profiles",
                        to="care.organization",
                    ),
                ),
                (
                    "primary_hospital",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="primary_staff_profiles",
                        to="care.hospital",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="staff_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["user__last_name", "user__first_name"],
                "indexes": [
                    models.Index(
                        fields=["organization", "role", "employment_status"],
                        name="care_staffp_organiz_973878_idx",
                    ),
                    models.Index(fields=["primary_hospital", "role"], name="care_staffp_primary_40b29d_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="AccessGrant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "scope",
                    models.CharField(
                        choices=[
                            ("ORGANIZATION", "Organization"),
                            ("HOSPITAL", "Hospital"),
                            ("DEPARTMENT", "Department"),
                            ("ROOM", "Room"),
                            ("PATIENT_GROUP", "Patient group"),
                            ("BREAK_GLASS", "Break glass"),
                        ],
                        db_index=True,
                        max_length=32,
                    ),
                ),
                ("starts_at", models.DateTimeField(default=timezone.now)),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("reason", models.TextField()),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                (
                    "department",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_grants",
                        to="care.department",
                    ),
                ),
                (
                    "granted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="granted_access_profiles",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "hospital",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_grants",
                        to="care.hospital",
                    ),
                ),
                (
                    "revoked_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="revoked_access_profiles",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_grants",
                        to="care.room",
                    ),
                ),
                (
                    "staff_profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_grants",
                        to="care.staffprofile",
                    ),
                ),
            ],
            options={
                "ordering": ["-starts_at"],
                "indexes": [
                    models.Index(fields=["staff_profile", "scope"], name="care_access_staff_p_975b96_idx"),
                    models.Index(fields=["starts_at", "ends_at"], name="care_access_starts__d6ad9d_idx"),
                    models.Index(fields=["revoked_at", "scope"], name="care_access_revoked_38a738_idx"),
                ],
            },
        ),
        migrations.AddField(
            model_name="patient",
            name="public_id",
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="patient",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="patients",
                to="care.organization",
            ),
        ),
        migrations.AddField(
            model_name="patient",
            name="hospital",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="patients",
                to="care.hospital",
            ),
        ),
        migrations.AddField(
            model_name="patient",
            name="department_ref",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="current_patients",
                to="care.department",
            ),
        ),
        migrations.AddField(
            model_name="patient",
            name="room",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="current_patients",
                to="care.room",
            ),
        ),
        migrations.AddField(
            model_name="patient",
            name="medical_record_number",
            field=models.CharField(blank=True, db_index=True, max_length=80),
        ),
        migrations.AddField(
            model_name="patient",
            name="middle_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="patient",
            name="gender",
            field=models.CharField(
                choices=[("FEMALE", "Female"), ("MALE", "Male"), ("OTHER", "Other"), ("UNKNOWN", "Unknown")],
                default="UNKNOWN",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="patient",
            name="address_line",
            field=models.CharField(blank=True, max_length=240),
        ),
        migrations.AddField(
            model_name="patient",
            name="emergency_contact",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="patient",
            name="consent_preferences",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="patient",
            name="is_active",
            field=models.BooleanField(db_index=True, default=True),
        ),
        migrations.AddField(
            model_name="medicalrecord",
            name="public_id",
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="medicalrecord",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="medical_records",
                to="care.organization",
            ),
        ),
        migrations.AddField(
            model_name="medicalrecord",
            name="hospital",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="medical_records",
                to="care.hospital",
            ),
        ),
        migrations.AddField(
            model_name="medicalrecord",
            name="department_ref",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="medical_records",
                to="care.department",
            ),
        ),
        migrations.AddField(
            model_name="medicalrecord",
            name="attending_provider",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="attending_medical_records",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="aierrlog",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="ai_error_logs",
                to="care.organization",
            ),
        ),
        migrations.AddField(
            model_name="aierrlog",
            name="hospital",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="ai_error_logs",
                to="care.hospital",
            ),
        ),
        migrations.AddField(
            model_name="anonymousfeedback",
            name="public_id",
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="anonymousfeedback",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="anonymous_feedback",
                to="care.organization",
            ),
        ),
        migrations.AddField(
            model_name="anonymousfeedback",
            name="hospital",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="anonymous_feedback",
                to="care.hospital",
            ),
        ),
        migrations.AddField(
            model_name="anonymousfeedback",
            name="department_ref",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="anonymous_feedback",
                to="care.department",
            ),
        ),
        migrations.AddField(
            model_name="anonymousfeedback",
            name="room",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="anonymous_feedback",
                to="care.room",
            ),
        ),
        migrations.RunPython(populate_existing_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="patient",
            name="public_id",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="medicalrecord",
            name="public_id",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="anonymousfeedback",
            name="public_id",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.CreateModel(
            name="AuditEvent",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("event_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("CREATE", "Create"),
                            ("READ", "Read"),
                            ("UPDATE", "Update"),
                            ("DELETE", "Delete"),
                            ("LOGIN", "Login"),
                            ("LOGOUT", "Logout"),
                            ("EXPORT", "Export"),
                            ("PRINT", "Print"),
                            ("BREAK_GLASS", "Break glass"),
                            ("AI_REVIEW", "AI review"),
                            ("DISCHARGE", "Discharge"),
                            ("FEEDBACK_SUBMITTED", "Feedback submitted"),
                        ],
                        db_index=True,
                        max_length=32,
                    ),
                ),
                ("resource_type", models.CharField(db_index=True, max_length=120)),
                ("resource_id", models.CharField(blank=True, db_index=True, max_length=120)),
                ("resource_public_id", models.UUIDField(blank=True, db_index=True, null=True)),
                ("request_id", models.CharField(blank=True, db_index=True, max_length=120)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True)),
                ("phi_accessed", models.BooleanField(db_index=True, default=False)),
                ("success", models.BooleanField(db_index=True, default=True)),
                (
                    "risk_level",
                    models.CharField(
                        choices=[("LOW", "Low"), ("MEDIUM", "Medium"), ("HIGH", "High"), ("CRITICAL", "Critical")],
                        db_index=True,
                        default="LOW",
                        max_length=20,
                    ),
                ),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "hospital",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="audit_events",
                        to="care.hospital",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="audit_events",
                        to="care.organization",
                    ),
                ),
                (
                    "patient",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_events",
                        to="care.patient",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["organization", "created_at"], name="care_audite_organiz_2f7d32_idx"),
                    models.Index(fields=["actor", "created_at"], name="care_audite_actor_i_b14ad2_idx"),
                    models.Index(fields=["patient", "created_at"], name="care_audite_patient_2f11c3_idx"),
                    models.Index(fields=["action", "risk_level", "created_at"], name="care_audite_action__4ef6a9_idx"),
                    models.Index(fields=["phi_accessed", "created_at"], name="care_audite_phi_acc_25f2f2_idx"),
                ],
            },
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["organization", "triage_status"], name="care_patien_organiz_1fa3d9_idx"),
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["hospital", "triage_status"], name="care_patien_hospita_2939d2_idx"),
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["medical_record_number", "organization"], name="care_patien_medical_685045_idx"),
        ),
        migrations.AddIndex(
            model_name="patient",
            index=models.Index(fields=["is_active", "updated_at"], name="care_patien_is_acti_27843c_idx"),
        ),
        migrations.AddIndex(
            model_name="medicalrecord",
            index=models.Index(fields=["organization", "created_at"], name="care_medica_organiz_58d54f_idx"),
        ),
        migrations.AddIndex(
            model_name="medicalrecord",
            index=models.Index(fields=["hospital", "created_at"], name="care_medica_hospita_23c918_idx"),
        ),
        migrations.AddIndex(
            model_name="aierrlog",
            index=models.Index(fields=["organization", "created_at"], name="care_aierrl_organiz_dfc543_idx"),
        ),
        migrations.AddIndex(
            model_name="aierrlog",
            index=models.Index(fields=["hospital", "created_at"], name="care_aierrl_hospita_a6e307_idx"),
        ),
        migrations.AddIndex(
            model_name="anonymousfeedback",
            index=models.Index(fields=["organization", "created_at"], name="care_anonym_organiz_c76c9b_idx"),
        ),
        migrations.AddIndex(
            model_name="anonymousfeedback",
            index=models.Index(fields=["hospital", "created_at"], name="care_anonym_hospita_68ade7_idx"),
        ),
    ]
