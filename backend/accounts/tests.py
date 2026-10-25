
from datetime import timedelta
from types import SimpleNamespace

import jwt

from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase, override_settings

from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from accounts.models import Organization, RefreshToken
from accounts.permissions import ACCOUNT_ROLE_ACCESS, IsAdmin, IsSales
from accounts.token_service import (
    TokenError,
    create_access_token,
    create_refresh_token,
    create_token,
    decode_token,
)
from crm.models import AuditLog

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


class AccountRoleAccessTests(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Test organization")
        self.superadmin = User.objects.create_superuser(
            email="superadmin@example.com",
            password="StrongTest@123",
        )
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="StrongTest@123",
            role=User.Role.ADMIN,
            organization=self.organization,
        )
        self.sales = User.objects.create_user(
            email="sales@example.com",
            password="StrongTest@123",
            role=User.Role.SALES,
        )

    def test_role_access_endpoint_returns_the_documented_matrix(self):
        self.client.force_authenticate(self.sales)

        response = self.client.get("/api/auth/role-access/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["current_role"], User.Role.SALES)
        self.assertFalse(response.data["is_super_admin"])
        self.assertEqual(response.data["roles"], ACCOUNT_ROLE_ACCESS)

    def test_organization_admin_can_list_only_its_own_users(self):
        other_organization = Organization.objects.create(name="Other organization")
        own_user = User.objects.create_user(
            email="own-user@example.com",
            password="StrongTest@123",
            role=User.Role.SALES,
            organization=self.organization,
        )
        other_user = User.objects.create_user(
            email="other-user@example.com",
            password="StrongTest@123",
            role=User.Role.SALES,
            organization=other_organization,
        )

        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/auth/staff/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {record["id"] for record in response.data},
            {self.admin.pk, own_user.pk},
        )
        self.assertNotIn(other_user.pk, {record["id"] for record in response.data})

        self.client.force_authenticate(self.sales)
        response = self.client.get("/api/auth/staff/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.superadmin)
        response = self.client.get("/api/auth/staff/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_organization_admin_can_change_role_only_within_own_organization(self):
        own_user = User.objects.create_user(
            email="role-change@example.com",
            password="StrongTest@123",
            role=User.Role.SALES,
            organization=self.organization,
        )
        other_organization = Organization.objects.create(name="Other organization")
        other_user = User.objects.create_user(
            email="other-role-change@example.com",
            password="StrongTest@123",
            role=User.Role.SALES,
            organization=other_organization,
        )

        self.client.force_authenticate(self.admin)
        allowed = self.client.patch(
            f"/api/auth/staff/{own_user.pk}/",
            {"role": User.Role.MARKETING},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK, allowed.data)
        own_user.refresh_from_db()
        self.assertEqual(own_user.role, User.Role.MARKETING)

        cross_organization = self.client.patch(
            f"/api/auth/staff/{other_user.pk}/",
            {"role": User.Role.MARKETING},
            format="json",
        )
        self.assertEqual(cross_organization.status_code, status.HTTP_404_NOT_FOUND)

    def test_organization_admin_cannot_change_own_role_or_reassign_user(self):
        own_user = User.objects.create_user(
            email="cannot-reassign@example.com",
            password="StrongTest@123",
            role=User.Role.SALES,
            organization=self.organization,
        )
        other_organization = Organization.objects.create(name="Other organization")

        self.client.force_authenticate(self.admin)
        own_role = self.client.patch(
            f"/api/auth/staff/{self.admin.pk}/",
            {"role": User.Role.MANAGEMENT},
            format="json",
        )
        self.assertEqual(own_role.status_code, status.HTTP_400_BAD_REQUEST)

        reassignment = self.client.patch(
            f"/api/auth/staff/{own_user.pk}/",
            {
                "role": User.Role.MARKETING,
                "organization": other_organization.pk,
            },
            format="json",
        )
        self.assertEqual(reassignment.status_code, status.HTTP_403_FORBIDDEN)
        own_user.refresh_from_db()
        self.assertEqual(own_user.organization, self.organization)

    def test_only_superadmin_can_create_an_organization(self):
        self.client.force_authenticate(self.admin)
        denied = self.client.post(
            "/api/auth/organizations/",
            {"name": "Denied organization"},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.superadmin)
        allowed = self.client.post(
            "/api/auth/organizations/",
            {"name": "Allowed organization"},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            AuditLog.objects.filter(
                organization_id=allowed.data["id"],
                user=self.superadmin,
                entity_type="Organization",
                action=AuditLog.ActionType.CREATE,
            ).exists()
        )

    def test_superadmin_can_create_an_organization_admin(self):
        self.client.force_authenticate(self.superadmin)

        response = self.client.post(
            "/api/auth/staff/",
            {
                "name": "Organization Administrator",
                "email": "org-admin@example.com",
                "password": "StrongTest@123",
                "role": User.Role.ADMIN,
                "organization": self.organization.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        organization_admin = User.objects.get(email="org-admin@example.com")
        self.assertFalse(organization_admin.is_superuser)
        self.assertEqual(organization_admin.organization, self.organization)
        self.assertTrue(
            AuditLog.objects.filter(
                organization=self.organization,
                user=self.superadmin,
                entity_type="OrganizationAdmin",
                entity_id=str(organization_admin.pk),
                action=AuditLog.ActionType.CREATE,
            ).exists()
        )

    def test_single_role_permissions_do_not_grant_another_role(self):
        request = type("Request", (), {"user": self.sales})()
        superadmin_request = type("Request", (), {"user": self.superadmin})()

        self.assertTrue(IsSales().has_permission(request, None))
        self.assertFalse(IsAdmin().has_permission(request, None))
        self.assertTrue(IsAdmin().has_permission(superadmin_request, None))

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

    def test_access_token_authenticates_an_accounts_endpoint(self):
        login_response = self.login()
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}",
        )

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.user.email)

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
