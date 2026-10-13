from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.utils import timezone
from .permissions import IsAdmin
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    OrganizationSerializer,
    StorefrontCustomerRegisterSerializer,
)


class AuditedTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Record successful authentication so customer log history is available in CRM."""
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        try:
            from crm.models import AuditLog, Customer
            organization = getattr(user, "organization", None)
            if getattr(user, "role", None) == "CUSTOMER":
                from crm.storefront_utils import ensure_storefront_customer
                directory_customer = ensure_storefront_customer(user)
                organization = getattr(directory_customer, "organization", None) or organization
            now = timezone.now()
            if user.last_login != now:
                user.last_login = now
                user.save(update_fields=["last_login"])
            if organization:
                request = self.context.get("request")
                AuditLog.objects.create(
                    organization=organization,
                    user=user,
                    action=AuditLog.ActionType.LOGIN,
                    entity_type="User",
                    entity_id=str(user.pk),
                    description="Successful sign-in to the account.",
                    ip_address=(getattr(request, "META", {}) or {}).get("REMOTE_ADDR") if request else None,
                )
        except Exception:
            # Authentication must not fail because an optional audit entry cannot be written.
            pass
        return data


class AuditedTokenObtainPairView(TokenObtainPairView):
    serializer_class = AuditedTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

class OrganizationCreateView(generics.CreateAPIView):

    serializer_class = OrganizationSerializer
    permission_classes = [IsAdmin]



class StorefrontCustomerRegisterView(generics.CreateAPIView):
    """Create a least-privilege customer account for the public storefront."""
    serializer_class = StorefrontCustomerRegisterSerializer
    permission_classes = [AllowAny]
