import uuid
from datetime import datetime, timezone as datetime_timezone
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Organization, RefreshToken
from .permissions import (
    ACCOUNT_ROLE_ACCESS,
    IsSuperAdmin,
    IsSuperAdminOrOrganizationAdmin,
)
from .serializers import (
    OrganizationSerializer,
    RegisterSerializer,
    StaffUserSerializer,
    UserSerializer,
)
from .token_service import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
)

User = get_user_model()


def build_user_payload(user):
    """Return public user information for authentication responses."""
    return {
        "id": user.pk,
        "email": user.email,
        "role": user.role,
        "is_super_admin": user.is_superuser,
        "effective_role": "SUPER_ADMIN" if user.is_superuser else user.role,
    }


def build_auth_response(user, access_token, refresh_token):
    """Build a consistent login or refresh response."""
    return {
        "access": access_token,
        "refresh": refresh_token,
        "user": build_user_payload(user),
    }


def persist_refresh_token(user, raw_token):
    """Persist a validated refresh token identifier and expiry."""
    payload = decode_token(
        raw_token,
        expected_type="refresh",
    )

    RefreshToken.objects.create(
        user=user,
        jti=uuid.UUID(payload["jti"]),
        expires_at=datetime.fromtimestamp(
            payload["exp"],
            tz=datetime_timezone.utc,
        ),
    )

    return payload


def parse_refresh_token(raw_token):
    """Return the subject and JTI of a validated refresh token."""
    payload = decode_token(
        raw_token,
        expected_type="refresh",
    )

    return payload["sub"], uuid.UUID(payload["jti"])


def record_successful_login(user, request):
    """Update login metadata and write an audit event for custom JWT logins."""
    try:
        from crm.models import AuditLog

        organization = getattr(user, "organization", None)
        if user.role == User.Role.CUSTOMER:
            from crm.storefront_utils import ensure_storefront_customer

            directory_customer = ensure_storefront_customer(user)
            organization = getattr(directory_customer, "organization", None) or organization

        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        if organization:
            AuditLog.objects.create(
                organization=organization,
                user=user,
                action=AuditLog.ActionType.LOGIN,
                entity_type="User",
                entity_id=str(user.pk),
                description="Successful sign-in to the account.",
                ip_address=request.META.get("REMOTE_ADDR"),
            )
    except Exception:
        # An optional CRM audit record must not prevent authentication.
        pass


def record_tenant_management_audit(request, organization, action, entity_type, entity_id, description):
    """Record superadmin organization and organization-admin changes."""
    from crm.models import AuditLog

    AuditLog.objects.create(
        organization=organization,
        user=request.user,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        description=description,
        ip_address=request.META.get("REMOTE_ADDR"),
    )


class RegisterView(generics.CreateAPIView):
    """Register a customer through the single public endpoint."""
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

class MeView(generics.RetrieveAPIView):
    """Return the currently authenticated user's profile."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class RoleAccessView(APIView):
    """Return the clear accounts-API access contract for every role."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "current_role": request.user.role,
                "is_super_admin": request.user.is_superuser,
                "effective_role": (
                    "SUPER_ADMIN"
                    if request.user.is_superuser
                    else request.user.role
                ),
                "roles": ACCOUNT_ROLE_ACCESS,
            }
        )


class OrganizationCreateView(generics.ListCreateAPIView):
    """Create an organization. This is a superadmin-only operation."""

    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = Organization.objects.all()

    def perform_create(self, serializer):
        organization = serializer.save()
        record_tenant_management_audit(
            self.request,
            organization,
            "CREATE",
            "Organization",
            organization.pk,
            f"Created organization '{organization.name}'.",
        )

class StaffUserListCreateView(generics.ListCreateAPIView):
    """
    List user accounts and create staff accounts.

    Superadmins can list and create accounts globally. Organization Admins
    can list only users belonging to their own organization; staff creation
    remains a superadmin-only operation.
    """

    serializer_class = StaffUserSerializer
    queryset = User.objects.filter(is_superuser=False).order_by("email")

    def get_permissions(self):
        permission_types = (
            [IsAuthenticated, IsSuperAdmin]
            if self.request.method == "POST"
            else [IsAuthenticated, IsSuperAdminOrOrganizationAdmin]
        )
        return [permission() for permission in permission_types]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_superuser:
            return queryset
        return queryset.filter(organization_id=self.request.user.organization_id)

    def perform_create(self, serializer):
        user = serializer.save()
        if user.organization_id:
            record_tenant_management_audit(
                self.request,
                user.organization,
                "CREATE",
                "OrganizationAdmin" if user.role == User.Role.ADMIN else "User",
                user.pk,
                f"Created {user.role.lower()} account '{user.email}'.",
            )


class StaffUserDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update an account.

    Superadmins can update any non-superadmin account. Organization Admins
    can update users in their own organization, but cannot change their own
    role or move a user to another organization.
    """

    serializer_class = StaffUserSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOrOrganizationAdmin]
    queryset = User.objects.filter(is_superuser=False)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_superuser:
            return queryset
        return queryset.filter(organization_id=self.request.user.organization_id)

    def perform_update(self, serializer):
        if (
            not self.request.user.is_superuser
            and "organization" in serializer.validated_data
        ):
            raise PermissionDenied(
                "Organization Admins cannot change a user's organization."
            )

        user = serializer.save()
        if user.organization_id:
            record_tenant_management_audit(
                self.request,
                user.organization,
                "UPDATE",
                "OrganizationAdmin" if user.role == User.Role.ADMIN else "User",
                user.pk,
                f"Updated {user.role.lower()} account '{user.email}'.",
            )

# Custom JWT authentication: login

@api_view(["POST"])
@permission_classes([AllowAny])
def custom_login(request):
    """
    Authenticate using email and password.

    Generate access and refresh tokens and persist the refresh token.
    """
    email = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "")

    if not email or not password:
        return Response(
            {"detail": "Email and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(
        request,
        email=email,
        password=password,
    )

    if user is None:
        return Response(
            {"detail": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {"detail": "This account is inactive."},
            status=status.HTTP_403_FORBIDDEN,
        )

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)

    persist_refresh_token(user, refresh_token)
    record_successful_login(user, request)

    return Response(
        build_auth_response(
            user,
            access_token,
            refresh_token,
        ),
        status=status.HTTP_200_OK,
    )

@api_view(["POST"])
@permission_classes([AllowAny])
def custom_refresh(request):
    """Validate and rotate a refresh token."""
    raw_token = request.data.get("refresh")

    if not isinstance(raw_token, str) or not raw_token:
        return Response(
            {"detail": "Refresh token is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user_id, token_jti = parse_refresh_token(raw_token)

    except (TokenError, KeyError, TypeError, ValueError):
        return Response(
            {"detail": "Invalid or expired refresh token."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    with transaction.atomic():
        try:
            stored_token = (
                RefreshToken.objects
                .select_for_update()
                .get(
                    user_id=user_id,
                    jti=token_jti,
                    revoked_at__isnull=True,
                    expires_at__gt=timezone.now(),
                )
            )

        except (RefreshToken.DoesNotExist, ValueError):
            return Response(
                {
                    "detail": (
                        "Refresh token is invalid, expired, or revoked."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = stored_token.user

        if not user.is_active:
            return Response(
                {"detail": "This account is inactive."},
                status=status.HTTP_403_FORBIDDEN,
            )

        stored_token.revoked_at = timezone.now()
        stored_token.save(update_fields=["revoked_at"])

        new_access_token = create_access_token(user)
        new_refresh_token = create_refresh_token(user)

        persist_refresh_token(user, new_refresh_token)

    return Response(
        build_auth_response(
            user,
            new_access_token,
            new_refresh_token,
        ),
        status=status.HTTP_200_OK,
    )

@api_view(["POST"])
@permission_classes([AllowAny])
def custom_logout(request):
    """Revoke a refresh token to prevent future reuse."""
    raw_token = request.data.get("refresh")

    if not isinstance(raw_token, str) or not raw_token:
        return Response(
            {"detail": "Refresh token is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user_id, token_jti = parse_refresh_token(raw_token)

    except (TokenError, KeyError, TypeError, ValueError):
        return Response(
            {"detail": "Invalid or expired refresh token."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    with transaction.atomic():
        updated = RefreshToken.objects.filter(
            user_id=user_id,
            jti=token_jti,
            revoked_at__isnull=True,
        ).update(
            revoked_at=timezone.now(),
        )

    if updated == 0:
        return Response(
            {
                "detail": (
                    "Refresh token is already revoked or unknown."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {"detail": "Logout successful."},
        status=status.HTTP_200_OK,
    )
