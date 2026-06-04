import json
from typing import Any

from channels.generic.websocket import AsyncWebsocketConsumer


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self) -> None:
        self.audience = self.scope["url_route"]["kwargs"].get("audience", "")
        self.scope_id = self.scope["url_route"]["kwargs"].get("scope_id", "")
        self.groups_to_join = self._groups_for_connection(self.audience, self.scope_id)

        if not self.groups_to_join:
            await self.close(code=4403)
            return

        for group_name in self.groups_to_join:
            await self.channel_layer.group_add(group_name, self.channel_name)

        await self.accept()
        await self.send_json(
            {
                "type": "connection_status",
                "payload": {
                    "status": "connected",
                    "groups": self.groups_to_join,
                },
            }
        )

    async def disconnect(self, _close_code: int) -> None:
        for group_name in getattr(self, "groups_to_join", []):
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def receive(self, text_data: str | None = None, bytes_data: bytes | None = None) -> None:
        if not text_data:
            return

        try:
            message = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send_json({"type": "error", "payload": {"message": "Invalid JSON payload"}})
            return

        message_type = message.get("type")
        if message_type == "ping":
            await self.send_json({"type": "pong", "payload": message.get("payload", {})})

    async def active_call_alert(self, event: dict[str, Any]) -> None:
        await self.send_json({"type": "active_call_alert", "payload": event.get("payload", {})})

    async def critical_ai_error(self, event: dict[str, Any]) -> None:
        await self.send_json({"type": "critical_ai_error", "payload": event.get("payload", {})})

    async def feedback_submitted(self, event: dict[str, Any]) -> None:
        await self.send_json({"type": "feedback_submitted", "payload": event.get("payload", {})})

    async def send_json(self, content: dict[str, Any]) -> None:
        await self.send(text_data=json.dumps(content, default=str))

    @staticmethod
    def _groups_for_connection(audience: str, scope_id: str) -> list[str]:
        if audience in {"head_physician", "head_physicians", "admin"}:
            return ["head_physicians"]
        if audience in {"regional_doctor", "regional_doctors"} and scope_id:
            return [f"regional_doctors_{scope_id}"]
        return []
