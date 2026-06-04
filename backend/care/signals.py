from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from .models import MedicalRecord
from .services import broadcast_active_call_alert


@receiver(post_save, sender=MedicalRecord)
def dispatch_active_call_on_high_risk_discharge(
    sender,
    instance: MedicalRecord,
    raw: bool,
    **_kwargs,
) -> None:
    if raw:
        return
    if instance.discharge_status != MedicalRecord.DischargeStatus.DISCHARGED:
        return
    if instance.active_call_alert_sent_at:
        return
    if not instance.patient.has_severe_chronic_risk:
        return

    def notify_and_mark_sent() -> None:
        broadcast_active_call_alert(instance)
        MedicalRecord.objects.filter(pk=instance.pk, active_call_alert_sent_at__isnull=True).update(
            active_call_alert_sent_at=timezone.now()
        )

    transaction.on_commit(notify_and_mark_sent)
