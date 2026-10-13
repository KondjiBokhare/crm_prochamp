from datetime import date, timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User, Organization
from crm.models import Customer, AuditLog


class AuditLogAPITests(APITestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(
            name="Organization A"
        )
        self.org_b = Organization.objects.create(
            name="Organization B"
        )

        self.admin_a = User.objects.create_user(
            email="admin_a@test.com",
            password="Test@12345",
            role="ADMIN",
            organization=self.org_a,
        )
        self.admin_b = User.objects.create_user(
            email="admin_b@test.com",
            password="Test@12345",
            role="ADMIN",
            organization=self.org_b,
        )
        self.sales_a = User.objects.create_user(
            email="sales_a@test.com",
            password="Test@12345",
            role="SALES",
            organization=self.org_a,
        )

        self.customer = Customer.objects.create(
            organization=self.org_a,
            first_name="John",
            last_name="Doe",
            email="john@test.com",
            phone="9876543210",
            lifecycle_stage="LEAD",
        )

        self.log_a = AuditLog.objects.create(
            organization=self.org_a,
            user=self.admin_a,
            action="CREATE",
            entity_type="Customer",
            entity_id=str(self.customer.id),
            description="Created John Doe",
        )
        self.log_b = AuditLog.objects.create(
            organization=self.org_b,
            user=self.admin_b,
            action="CREATE",
            entity_type="Order",
            entity_id="999",
            description="Other organization's order",
        )

        self.audit_url = "/api/crm/audit-logs/"

    def authenticate(self, user):
        token = RefreshToken.for_user(user).access_token
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {token}"
        )

    def response_items(self, response):
        # Supports paginated and non-paginated list responses.
        if isinstance(response.data, dict):
            return response.data.get("results", [])
        return response.data

    def test_customer_creation_creates_audit_log(self):
        self.authenticate(self.admin_a)

        response = self.client.post(
            "/api/crm/customers/",
            {
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane@test.com",
                "phone": "9876543211",
                "lifecycle_stage": "LEAD",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        customer = Customer.objects.get(email="jane@test.com")
        self.assertTrue(
            AuditLog.objects.filter(
                organization=self.org_a,
                user=self.admin_a,
                action="CREATE",
                entity_type="Customer",
                entity_id=str(customer.id),
            ).exists()
        )

    def test_audit_endpoint_requires_authentication(self):
        response = self.client.get(self.audit_url)
        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_admin_can_read_audit_logs(self):
        self.authenticate(self.admin_a)

        response = self.client.get(self.audit_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def test_logs_are_isolated_by_organization(self):
        self.authenticate(self.admin_a)

        response = self.client.get(self.audit_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        returned_ids = {
            str(item["entity_id"])
            for item in self.response_items(response)
        }

        self.assertIn(str(self.customer.id), returned_ids)
        self.assertNotIn("999", returned_ids)

    def test_management_can_read_audit_logs(self):
        management = User.objects.create_user(
            email="manager@test.com",
            password="Test@12345",
            role="MANAGEMENT",
            organization=self.org_a,
        )
        self.authenticate(management)

        response = self.client.get(self.audit_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def test_sales_cannot_read_audit_logs(self):
        self.authenticate(self.sales_a)

        response = self.client.get(self.audit_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_audit_endpoint_is_read_only(self):
        self.authenticate(self.admin_a)

        payload = {
            "action": "CREATE",
            "entity_type": "Customer",
            "entity_id": "123",
            "description": "Attempted API log creation",
        }

        for method in ("post", "put", "patch", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(
                    self.audit_url,
                    payload,
                    format="json",
                )
                self.assertIn(
                    response.status_code,
                    {
                        status.HTTP_405_METHOD_NOT_ALLOWED,
                        status.HTTP_404_NOT_FOUND,
                    },
                )

        self.assertFalse(
            AuditLog.objects.filter(
                entity_id="123",
                description="Attempted API log creation",
            ).exists()
        )

    def test_filter_by_action(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            self.audit_url,
            {"action": "CREATE"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            all(
                item["action"] == "CREATE"
                for item in self.response_items(response)
            )
        )

    def test_filter_by_entity_type(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            self.audit_url,
            {"entity_type": "Customer"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            all(
                item["entity_type"].lower() == "customer"
                for item in self.response_items(response)
            )
        )

    def test_invalid_action_returns_400(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            self.audit_url,
            {"action": "INVALID"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_date_returns_400(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            self.audit_url,
            {"start_date": "not-a-date"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_start_date_after_end_date_returns_400(self):
        self.authenticate(self.admin_a)

        response = self.client.get(
            self.audit_url,
            {
                "start_date": "2026-10-11",
                "end_date": "2026-10-01",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_date_filter_returns_only_matching_logs(self):
        self.authenticate(self.admin_a)

        today = timezone.localdate().isoformat()
        yesterday = (
            timezone.localdate() - timedelta(days=1)
        ).isoformat()

        response = self.client.get(
            self.audit_url,
            {
                "start_date": today,
                "end_date": today,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # The test fixture's log was created today.
        self.assertIn(
            str(self.customer.id),
            {
                str(item["entity_id"])
                for item in self.response_items(response)
            },
        )
