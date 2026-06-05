from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


@ensure_csrf_cookie
def csrf_cookie(request):
    return JsonResponse({"status": "csrf_cookie_set", "csrfToken": get_token(request)})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", healthcheck),
    path("api/csrf/", csrf_cookie),
    path("api/", include("care.urls")),
]
