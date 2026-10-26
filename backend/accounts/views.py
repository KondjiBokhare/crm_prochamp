import uuid
from datetime import datetime, timezone as datetime_timezone

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Organization, RefreshToken
from .permissions import (
    ACCOUNT_ROLE_ACCESS,
    IsOrganizationAdmin,
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


# ============================================================
# AUTHENTICATION HELPERS
# ============================================================

def build_user_payload(user):
    """Return public user information for authentication responses."""
    return {
        "id": user.pk,
        "email": user.email,
        "role": user.role,
        "is_super_admin": user.is_superuser,
        "effective_role": (
            "SUPER_ADMIN" if user.is_superuser else user.role
        ),
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


# ============================================================
# AUDIT LOGGING
# ============================================================

def record_successful_login(user, request):
    """Update login metadata and record an optional CRM audit event."""
    try:
        from crm.models import AuditLog

        organization = getattr(user, "organization", None)

        if user.role == User.Role.CUSTOMER:
            from crm.storefront_utils import ensure_storefront_customer

            directory_customer = ensure_storefront_customer(user)

            organization = (
                getattr(directory_customer, "organization", None)
                or organization
            )

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
        # Optional audit logging must not prevent authentication.
        pass


def record_tenant_management_audit(
    request,
    organization,
    action,
    entity_type,
    entity_id,
    description,
):
    """Record organization-management or staff-permission changes."""
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


# ============================================================
# REGISTRATION AND CURRENT USER
# ============================================================

class RegisterView(generics.CreateAPIView):
    """Register a customer through the public endpoint."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveAPIView):
    """Return the currently authenticated user's profile."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class RoleAccessView(APIView):
    """Return the access contract for the available account roles."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        return Response(
            {
                "current_role": user.role,
                "is_super_admin": user.is_superuser,
                "effective_role": (
                    "SUPER_ADMIN" if user.is_superuser else user.role
                ),
                "roles": ACCOUNT_ROLE_ACCESS,
            }
        )


# ============================================================
# ORGANIZATION MANAGEMENT
# ============================================================

class OrganizationCreateView(generics.ListCreateAPIView):
    """
    List and create organizations.

    Only Super Admins can access this endpoint.
    """

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


# ============================================================
# STAFF LISTING AND CREATION
# ============================================================

class StaffUserListCreateView(generics.ListCreateAPIView):
    """
    List staff accounts and create staff accounts.

    Super Admin:
        - Can list staff across all organizations.
        - Can create staff accounts.

    Organization Admin:
        - Can list staff only within their own organization.
        - Cannot create staff accounts.
    """

    serializer_class = StaffUserSerializer

    queryset = (
        User.objects
        .filter(is_superuser=False)
        .exclude(role=User.Role.CUSTOMER)
        .order_by("email")
    )

    def get_permissions(self):
        if self.request.method == "POST":
            permission_classes = [
                IsAuthenticated,
                IsSuperAdmin,
            ]
        else:
            permission_classes = [
                IsAuthenticated,
                IsSuperAdminOrOrganizationAdmin,
            ]

        return [
            permission_class()
            for permission_class in permission_classes
        ]

    def get_queryset(self):
        queryset = super().get_queryset()
        actor = self.request.user

        # Super Admin can see all non-customer staff accounts.
        if actor.is_superuser:
            return queryset

        # Organization Admin can only see their organization's staff.
        if (
            actor.role == User.Role.ADMIN
            and actor.organization_id is not None
        ):
            return queryset.filter(
                organization_id=actor.organization_id
            )

        return queryset.none()

    def perform_create(self, serializer):
        # POST permission checks ensure only Super Admin reaches here.
        user = serializer.save()

        if user.organization_id:
            entity_type = (
                "OrganizationAdmin"
                if user.role == User.Role.ADMIN
                else "User"
            )

            record_tenant_management_audit(
                self.request,
                user.organization,
                "CREATE",
                entity_type,
                user.pk,
                f"Created {user.role.lower()} account '{user.email}'.",
            )


# ============================================================
# STAFF DETAILS AND PERMISSION ASSIGNMENT
# ============================================================

class StaffUserDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve staff accounts and update staff permissions.

    Super Admin:
        - Can view all non-superadmin staff accounts.
        - Cannot edit staff through this endpoint.
        - Creates staff through StaffUserListCreateView instead.

    Organization Admin:
        - Can view staff from their own organization.
        - Can change only the CRM permissions of other staff.
        - Cannot change staff roles, names, emails, passwords,
          active status, or organization.
        - Cannot change their own permissions.
        - Cannot access staff from another organization.

    Other roles:
        - Cannot access this endpoint.
    """

    serializer_class = StaffUserSerializer

    # Only GET and PATCH are supported for this endpoint.
    http_method_names = [
        "get",
        "patch",
        "head",
        "options",
    ]

    queryset = (
        User.objects
        .filter(is_superuser=False)
        .exclude(role=User.Role.CUSTOMER)
    )

    def get_permissions(self):
        # Staff records may be viewed by Super Admins and
        # authorized Organization Admins.
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            permission_classes = [
                IsAuthenticated,
                IsSuperAdminOrOrganizationAdmin,
            ]

        # Only Organization Admins may submit permission updates.
        # perform_update further restricts the fields they can edit.
        else:
            permission_classes = [
                IsAuthenticated,
                IsOrganizationAdmin,
            ]

        return [
            permission_class()
            for permission_class in permission_classes
        ]

    def get_queryset(self):
        queryset = super().get_queryset()
        actor = self.request.user

        # Super Admin can retrieve any non-superadmin staff record.
        if actor.is_superuser:
            return queryset

        # Organization Admin can retrieve records from their own org.
        if (
            actor.role == User.Role.ADMIN
            and actor.organization_id is not None
        ):
            return queryset.filter(
                organization_id=actor.organization_id
            )

        # Other users receive no records.
        return queryset.none()

    def perform_update(self, serializer):
            actor = self.request.user

            if actor.is_superuser:
                raise PermissionDenied(
                    "Super Admin cannot update staff through this endpoint."
                )

            changed_fields = set(serializer.validated_data.keys())

            # Organization reassignment is explicitly forbidden.
            # Return 403 Forbidden for this operation.
            if "organization" in changed_fields:
                raise PermissionDenied(
                    "Organization Admins cannot change a user's organization."
                )

            # Organization Admins can update permissions only.
            if changed_fields != {"crm_permissions"}:
                raise ValidationError({
                    "detail": (
                        "Organization Admins can only update "
                        "staff CRM permissions."
                    )
                })

            # Organization Admins cannot change their own permissions.
            if serializer.instance.pk == actor.pk:
                raise ValidationError({
                    "detail": "You cannot change your own permissions."
                })

            user = serializer.save()

            if user.organization_id:
                record_tenant_management_audit(
                    self.request,
                    user.organization,
                    "UPDATE",
                    "User",
                    user.pk,
                    f"Updated CRM permissions for '{user.email}'.",
                )


# ============================================================
# CUSTOM JWT LOGIN
# ============================================================

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


# ============================================================
# CUSTOM JWT REFRESH
# ============================================================

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

        # Revoke the old token so it cannot be reused.
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


# ============================================================
# CUSTOM JWT LOGOUT
# ============================================================

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