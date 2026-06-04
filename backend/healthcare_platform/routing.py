from django.urls import path

from care.consumers import NotificationConsumer


websocket_urlpatterns = [
    path("ws/notifications/<str:audience>/", NotificationConsumer.as_asgi()),
    path("ws/notifications/<str:audience>/<str:scope_id>/", NotificationConsumer.as_asgi()),
]
