from django.apps import AppConfig


class CareConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "care"

    def ready(self) -> None:
        from . import signals  # noqa: F401
