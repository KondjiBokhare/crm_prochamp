
from datetime import timedelta
from types import SimpleNamespace

import jwt

from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase, override_settings

from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from accounts.models import Organization, RefreshToken
from accounts.token_service import (
    TokenError,
    create_access_token,
    create_refresh_token,
    create_token,
    decode_token,
)

User = get_user_model()



class RegisterTest(APITestCase):

    def test_register_user(self):
        organization = Organization.objects.create(
            name="Test Storefront",
        )

        data = {
            "email": "test@example.com",
            "password": "StrongPassword!927",
        }

        with override_settings(
            STOREFRONT_ORGANIZATION_ID=organization.pk,
        ):
            response = self.client.post(
                "/api/auth/register/",
                data,
                format="json",
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        user = User.objects.get(email="test@example.com")
        self.assertEqual(user.role, User.Role.CUSTOMER)
        self.assertEqual(user.organization_id, organization.pk)


class LoginTest(APITestCase):

    def setUp(self):
        User.objects.create_user(
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

class CustomJWTTokenTests(SimpleTestCase):

    def setUp(self):
        # A lightweight user object is sufficient for token tests.
        self.user = SimpleNamespace(pk=123)

    def test_create_and_decode_access_token(self):
        token = create_access_token(self.user)
        payload = decode_token(token, expected_type="access")

        self.assertEqual(payload["sub"], "123")
        self.assertEqual(payload["type"], "access")
        self.assertTrue(payload["jti"])

    def test_create_and_decode_refresh_token(self):
        token = create_refresh_token(self.user)
        payload = decode_token(token, expected_type="refresh")

        self.assertEqual(payload["sub"], "123")
        self.assertEqual(payload["type"], "refresh")

    def test_refresh_token_rejected_as_access_token(self):
        token = create_refresh_token(self.user)

        with self.assertRaises(TokenError):
            decode_token(token, expected_type="access")

    def test_access_token_rejected_as_refresh_token(self):
        token = create_access_token(self.user)

        with self.assertRaises(TokenError):
            decode_token(token, expected_type="refresh")

    def test_expired_token_is_rejected(self):
        token = create_token(
            user=self.user,
            token_type="access",
            lifetime=timedelta(seconds=-10),
        )

        with self.assertRaises(TokenError):
            decode_token(token, expected_type="access")


    def test_token_signed_with_wrong_secret_is_rejected(self):
        token = jwt.encode(
            {
                "sub": "123",
                "type": "access",
                "iat": 1,
                "exp": 4102444800,
                "jti": "test-token",
            },
            b"incorrect-test-secret-32-bytes!!",
            algorithm="HS256",
        )

        with self.assertRaises(TokenError):
            decode_token(token, expected_type="access")

class CustomJWTLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            email="jwt-lifecycle@example.com",
            password="StrongTest@123",
            role="SALES",
        )

    def login(self):
        return self.client.post(
            "/api/auth/login/",
            {
                "email": "jwt-lifecycle@example.com",
                "password": "StrongTest@123",
            },
            format="json",
        )

    def test_login_persists_refresh_token(self):
        response = self.login()

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(
            RefreshToken.objects.filter(user=self.user).count(),
            1,
        )

    def test_refresh_rotates_old_token(self):
        login_response = self.login()
        old_refresh = login_response.data["refresh"]

        response = self.client.post(
            "/api/auth/refresh/",
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.data["refresh"], old_refresh)

        old_payload = decode_token(
            old_refresh,
            expected_type="refresh",
        )
        old_record = RefreshToken.objects.get(
            jti=old_payload["jti"],
        )
        self.assertTrue(old_record.is_revoked)

    def test_revoked_refresh_token_cannot_be_reused(self):
        login_response = self.login()
        old_refresh = login_response.data["refresh"]

        first_refresh = self.client.post(
            "/api/auth/refresh/",
            {"refresh": old_refresh},
            format="json",
        )
        self.assertEqual(first_refresh.status_code, 200)

        replay_response = self.client.post(
            "/api/auth/refresh/",
            {"refresh": old_refresh},
            format="json",
        )
        self.assertEqual(replay_response.status_code, 401)

    def test_logout_revokes_refresh_token(self):
        login_response = self.login()
        refresh = login_response.data["refresh"]

        response = self.client.post(
            "/api/auth/logout/",
            {"refresh": refresh},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        payload = decode_token(refresh, expected_type="refresh")
        record = RefreshToken.objects.get(jti=payload["jti"])
        self.assertTrue(record.is_revoked)

    def test_inactive_user_cannot_login(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        response = self.login()

        self.assertEqual(response.status_code, 401)