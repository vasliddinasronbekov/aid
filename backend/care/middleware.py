import uuid

from .context import AuditContext, clear_audit_context, client_ip_from_request, set_audit_context


class AuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.request_id = request_id
        set_audit_context(
            AuditContext(
                request_id=request_id,
                ip_address=client_ip_from_request(request),
                user_agent=request.headers.get("User-Agent", ""),
                path=request.path,
                method=request.method,
            )
        )

        try:
            response = self.get_response(request)
            response["X-Request-ID"] = request_id
            return response
        finally:
            clear_audit_context()
