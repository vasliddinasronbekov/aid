# Initial clinical CRM schema.

import django.core.validators
import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Patient",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("patient_identifier", models.CharField(default=uuid.uuid4, max_length=64, unique=True)),
                ("first_name", models.CharField(max_length=120)),
                ("last_name", models.CharField(max_length=120)),
                ("date_of_birth", models.DateField(blank=True, null=True)),
                ("phone_number", models.CharField(blank=True, max_length=32)),
                ("region_code", models.CharField(db_index=True, max_length=64)),
                ("district", models.CharField(blank=True, max_length=120)),
                ("department", models.CharField(blank=True, max_length=120)),
                (
                    "triage_status",
                    models.CharField(
                        choices=[("RED", "Red"), ("YELLOW", "Yellow"), ("GREEN", "Green")],
                        db_index=True,
                        default="GREEN",
                        max_length=10,
                    ),
                ),
                ("chronic_biomarkers", models.JSONField(blank=True, default=dict)),
                ("last_marker_sync_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["triage_status", "last_name", "first_name"],
                "indexes": [
                    models.Index(fields=["region_code", "triage_status"], name="care_patien_region__e3f173_idx"),
                    models.Index(fields=["department", "triage_status"], name="care_patien_departm_2090d1_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="AnonymousFeedback",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("department", models.CharField(db_index=True, max_length=120)),
                ("room_qr_id", models.CharField(db_index=True, max_length=120)),
                ("anonymous_session_id", models.CharField(default=uuid.uuid4, max_length=128, unique=True)),
                (
                    "rating",
                    models.PositiveSmallIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(5),
                        ]
                    ),
                ),
                ("comment", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["department", "room_qr_id"], name="care_anonym_departm_121402_idx"),
                    models.Index(fields=["rating", "created_at"], name="care_anonym_rating_78b624_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="MedicalRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("doctor_id", models.CharField(db_index=True, max_length=120)),
                ("diagnosis", models.TextField()),
                ("prescriptions", models.TextField(blank=True)),
                ("clinical_notes", models.TextField(blank=True)),
                (
                    "ai_review_status",
                    models.CharField(
                        choices=[
                            ("PENDING", "Pending"),
                            ("CLEAR", "Clear"),
                            ("NEEDS_REVIEW", "Needs review"),
                            ("CRITICAL", "Critical"),
                        ],
                        db_index=True,
                        default="PENDING",
                        max_length=20,
                    ),
                ),
                ("imaging_safety_metadata", models.JSONField(blank=True, default=dict)),
                (
                    "record_type",
                    models.CharField(
                        choices=[
                            ("CONSULTATION", "Consultation"),
                            ("IMAGING", "Imaging"),
                            ("DISCHARGE", "Discharge"),
                            ("FOLLOW_UP", "Follow up"),
                        ],
                        db_index=True,
                        default="CONSULTATION",
                        max_length=20,
                    ),
                ),
                (
                    "discharge_status",
                    models.CharField(
                        choices=[("ACTIVE", "Active"), ("DISCHARGED", "Discharged")],
                        db_index=True,
                        default="ACTIVE",
                        max_length=20,
                    ),
                ),
                ("active_call_alert_sent_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="medical_records",
                        to="care.patient",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["doctor_id", "created_at"], name="care_medica_doctor__b74d67_idx"),
                    models.Index(fields=["ai_review_status", "created_at"], name="care_medica_ai_revi_2e4ded_idx"),
                    models.Index(fields=["discharge_status", "created_at"], name="care_medica_dischar_b05dd2_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="AIErrLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "error_type",
                    models.CharField(
                        choices=[
                            ("ENTRY_OMISSION", "Entry omission"),
                            ("PRESCRIPTION_MISMATCH", "Prescription mismatch"),
                            ("ETHICAL_DEVIATION", "Ethical deviation"),
                            ("IMAGING_SAFETY", "Imaging safety"),
                            ("DIGITAL_TWIN_RISK", "Digital twin risk"),
                        ],
                        db_index=True,
                        max_length=40,
                    ),
                ),
                (
                    "severity",
                    models.CharField(
                        choices=[
                            ("LOW", "Low"),
                            ("MEDIUM", "Medium"),
                            ("HIGH", "High"),
                            ("CRITICAL", "Critical"),
                        ],
                        default="MEDIUM",
                        max_length=20,
                    ),
                ),
                ("rca_description", models.TextField()),
                ("protocol_reference", models.CharField(blank=True, max_length=160)),
                ("reviewed_by_admin", models.BooleanField(db_index=True, default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "medical_record",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ai_error_logs",
                        to="care.medicalrecord",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["error_type", "severity"], name="care_aierrl_error_t_6b0520_idx"),
                    models.Index(fields=["reviewed_by_admin", "created_at"], name="care_aierrl_reviewe_1a4f73_idx"),
                ],
            },
        ),
    ]
