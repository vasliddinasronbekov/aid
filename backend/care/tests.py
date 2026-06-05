from uuid import uuid4

from rest_framework import status
from rest_framework.test import APITestCase

from .models import AnonymousFeedback


class AnonymousFeedbackTests(APITestCase):
    def test_public_feedback_doctor_routes_do_not_require_authentication(self):
        for path in ("/api/feedback-doctors/", "/api/feedback/public-doctors/"):
            with self.subTest(path=path):
                response = self.client.get(path)

                self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
                self.assertEqual(response.data, [])

    def test_doctor_feedback_accepts_phone_number_without_otp(self):
        payload = {
            "target_type": "DOCTOR",
            "target_doctor_label": "Gradi",
            "department": "Doctor feedback",
            "room_qr_id": "doctor-gradi",
            "anonymous_session_id": str(uuid4()),
            "phone_number": "+998934043024",
            "category": "PRAISE",
            "severity": "LOW",
            "language": "uz-Latn",
            "rating": 5,
            "comment": "Best Doctor",
        }

        response = self.client.post("/api/feedback/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        feedback = AnonymousFeedback.objects.get()
        self.assertEqual(feedback.target_type, AnonymousFeedback.TargetType.DOCTOR)
        self.assertEqual(feedback.target_doctor_label, "Gradi")
        self.assertEqual(feedback.contact_phone_number, "+998934043024")
        self.assertFalse(feedback.phone_verified)
        self.assertIsNone(feedback.phone_verification)
