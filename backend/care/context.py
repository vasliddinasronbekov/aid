from contextvars import ContextVar
from dataclasses import dataclass

from django.http import HttpRequest


@dataclass(frozen=True)
class AuditContext:
    request_id: str = ""
    ip_address: str | None = None
    user_agent: str = ""
    path: str = ""
    method: str = ""


_audit_context: ContextVar[AuditContext | None] = ContextVar("audit_context", default=None)


def set_audit_context(context: AuditContext) -> None:
    _audit_context.set(context)


def get_audit_context() -> AuditContext | None:
    return _audit_context.get()


def clear_audit_context() -> None:
    _audit_context.set(None)


def client_ip_from_request(request: HttpRequest) -> str | None:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.META.get("REMOTE_ADDR")
