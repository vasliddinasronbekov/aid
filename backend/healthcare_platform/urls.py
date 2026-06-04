from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.csrf import ensure_csrf_cookie


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


@ensure_csrf_cookie
def csrf_cookie(_request):
    return JsonResponse({"status": "csrf_cookie_set"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", healthcheck),
    path("api/csrf/", csrf_cookie),
    path("api/", include("care.urls")),
]
