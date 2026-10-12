from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()


class RegisterTest(APITestCase):

    def test_register_user(self):
        data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "Test@12345",
        }

        response = self.client.post(
            "/api/auth/register/",
            data,
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED
        )


class LoginTest(APITestCase):

    def setUp(self):
        User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="Test@12345",
        )

    def test_login_user(self):
        data = {
            "email": "test@example.com",
            "password": "Test@12345",
        }

        response = self.client.post(
            "/api/auth/login/",
            data,
            format="json"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK
        )