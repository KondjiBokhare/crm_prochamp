import uuid
from datetime import datetime, timezone as datetime_timezone

# ============================================================
# Django imports
# ============================================================

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone

# ============================================================
# Django REST Framework imports
# ============================================================

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

# ============================================================
# Simple JWT imports
# ============================================================

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

# ============================================================
# Local application imports
# ============================================================

from .models import RefreshToken
from .permissions import IsAdmin
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

# ============================================================
# User model
# ============================================================

User = get_user_model()


# ============================================================
# Shared authentication response helpers
# ============================================================

def build_user_payload(user):
    """Return public user information for authentication responses."""
    return {
        "id": user.pk,
        "email": user.email,
        "role": user.role,
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
# Simple JWT authentication and audit logging
# ============================================================

class AuditedTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Record successful Simple JWT logins in the CRM audit log."""

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        try:
            from crm.models import AuditLog

            organization = getattr(user, "organization", None)

            if user.role == User.Role.CUSTOMER:
                from crm.storefront_utils import (
                    ensure_storefront_customer,
                )

                directory_customer = ensure_storefront_customer(user)

                organization = (
                    getattr(directory_customer, "organization", None)
                    or organization
                )

            now = timezone.now()

            if user.last_login != now:
                user.last_login = now
                user.save(update_fields=["last_login"])

            if organization:
                request = self.context.get("request")
                request_meta = (
                    getattr(request, "META", {})
                    if request
                    else {}
                )

                AuditLog.objects.create(
                    organization=organization,
                    user=user,
                    action=AuditLog.ActionType.LOGIN,
                    entity_type="User",
                    entity_id=str(user.pk),
                    description="Successful sign-in to the account.",
                    ip_address=request_meta.get("REMOTE_ADDR"),
                )

        except Exception:
            # Optional audit logging must not silently hide failures
            # in production. Replace with proper exception logging.
            pass

        return data


class AuditedTokenObtainPairView(TokenObtainPairView):
    """Simple JWT login endpoint with audit logging."""

    serializer_class = AuditedTokenObtainPairSerializer


# ============================================================
# Public registration
# ============================================================

class RegisterView(generics.CreateAPIView):
    """Register a customer through the single public endpoint."""

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


# ============================================================
# Authenticated user profile
# ============================================================

class MeView(generics.RetrieveAPIView):
    """Return the currently authenticated user's profile."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


# ============================================================
# Admin-only organization management
# ============================================================

class OrganizationCreateView(generics.CreateAPIView):
    """Create an organization using the Admin permission."""

    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsAdmin]


# ============================================================
# Admin-only staff and user management
# ============================================================

class StaffUserListCreateView(generics.ListCreateAPIView):
    """
    List user accounts and create staff accounts.

    Only Admins can access this endpoint.
    The list includes customers so Admins can identify accounts
    they want to promote to staff.
    """

    serializer_class = StaffUserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = User.objects.all().order_by("email")


class StaffUserDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update an account.

    PATCH can be used by an Admin to promote an existing customer
    or update a staff member's role and active status.
    """

    serializer_class = StaffUserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = User.objects.all()


# ============================================================
# Custom JWT authentication: login
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

    return Response(
        build_auth_response(
            user,
            access_token,
            refresh_token,
        ),
        status=status.HTTP_200_OK,
    )


# ============================================================
# Custom JWT authentication: refresh and rotation
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
# Custom JWT authentication: logout
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