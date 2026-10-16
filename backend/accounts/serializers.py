from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers
from .models import Organization
User = get_user_model()

STAFF_ROLE_CHOICES = [
    (value, label)
    for value, label in User.Role.choices
    if value != User.Role.CUSTOMER
]

def split_display_name(value):
    """Split a full name into first name and last name."""
    parts = " ".join(str(value or "").split()).split(" ", 1)

    return parts[0], parts[1] if len(parts) > 1 else ""

# Organization serializer
class OrganizationSerializer(serializers.ModelSerializer):
    """Serialize organization details for CRM API responses."""

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


# Public customer registration serializer

class RegisterSerializer(serializers.ModelSerializer):
    """
    Register a customer through the single public registration API.

    The client cannot assign its own role or organization.
    """

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "first_name",
            "last_name",
        ]
        read_only_fields = ["id"]

    
    def validate_email(self, value):
        value = User.objects.normalize_email(value.strip().lower())

        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )

        return value


    def validate_password(self, value):
        """Apply Django's configured password validators."""
        validate_password(value)
        return value

    def create(self, validated_data):
        """Create the customer and related CRM records atomically."""
        from crm.models import StorefrontCustomerProfile
        from crm.storefront_utils import (
            ensure_storefront_customer,
            get_storefront_organization,
        )

        password = validated_data.pop("password")
        organization = get_storefront_organization()

        if organization is None:
            raise serializers.ValidationError({
                "detail": (
                    "The storefront CRM organization is not configured. "
                    "Configure STOREFRONT_ORGANIZATION_ID or create a "
                    "product category first."
                )
            })

        with transaction.atomic():
            user = User.objects.create_user(
                password=password,
                role=User.Role.CUSTOMER,
                is_active=True,
                organization=organization,
                **validated_data,
            )

            StorefrontCustomerProfile.objects.create(user=user)

            ensure_storefront_customer(user, organization)

        return user


# Authenticated user profile serializer
class UserSerializer(serializers.ModelSerializer):
    """Serialize read-only user profile information."""

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "role",
            "is_active",
            "date_joined",
            "first_name",
            "last_name",
        ]
        read_only_fields = [
            "id",
            "email",
            "role",
            "is_active",
            "date_joined",
            "first_name",
            "last_name",
        ]


# Admin staff and user management serializer
class StaffUserSerializer(serializers.ModelSerializer):
    """
    Admin-only serializer for creating and managing CRM accounts.

    Admins can create staff accounts and change existing users'
    roles, including promoting customers to staff.

    API views using this serializer must enforce Admin permissions.
    """

    name = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        max_length=150,
    )

    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8,
        trim_whitespace=False,
    )

    # All roles are supported when updating existing users.
    # Customer creation through this staff endpoint is prohibited.
    role = serializers.ChoiceField(
        choices=User.Role.choices,
        required=True,
    )

    # Accept the frontend's `active` field while storing `is_active`.
    active = serializers.BooleanField(
        source="is_active",
        write_only=True,
        required=False,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "role",
            "is_active",
            "active",
            "date_joined",
            "first_name",
            "last_name",
            "password",
        ]
        read_only_fields = [
            "id",
            "is_active",
            "date_joined",
            "first_name",
            "last_name",
        ]

    def validate_email(self, value):
        """Normalize email and reject duplicate accounts."""
        value = User.objects.normalize_email(value = value.strip().lower())

        existing_users = User.objects.filter(email__iexact=value)

        if self.instance is not None:
            existing_users = existing_users.exclude(
                pk=self.instance.pk
            )

        if existing_users.exists():
            raise serializers.ValidationError(
                "A user with this email address already exists."
            )

        return value

    def validate_password(self, value):
        """Apply Django's configured password validators."""
        try:
            validate_password(value, user=self.instance)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                list(exc.messages)
            ) from exc

        return value

    def validate(self, attrs):
        """Validate staff creation and protect administrator accounts."""
        request = self.context.get("request")

        # --------------------------------------------------------
        # Creating a new staff account
        # --------------------------------------------------------

        if self.instance is None:
            if not attrs.get("name", "").strip():
                raise serializers.ValidationError({
                    "name": "This field is required."
                })

            if not attrs.get("password"):
                raise serializers.ValidationError({
                    "password": "This field is required."
                })

            if attrs.get("role") == User.Role.CUSTOMER:
                raise serializers.ValidationError({
                    "role": (
                        "Customer accounts must be created through "
                        "the public registration endpoint."
                    )
                })

            return attrs

        # --------------------------------------------------------
        # Updating an existing account
        # --------------------------------------------------------

        current = self.instance
        next_role = attrs.get("role", current.role)
        next_active = attrs.get("is_active", current.is_active)

        # Prevent an administrator from locking themselves out.
        if request and request.user.pk == current.pk:
            if (
                not next_active
                or next_role != current.role
            ):
                raise serializers.ValidationError({
                    "detail": (
                        "You cannot deactivate or change the role "
                        "of your own signed-in account."
                    )
                })

        # Preserve at least one active Admin account.
        if (
            current.role == User.Role.ADMIN
            and (
                next_role != User.Role.ADMIN
                or not next_active
            )
        ):
            active_admins = User.objects.filter(
                role=User.Role.ADMIN,
                is_active=True,
            ).count()

            if active_admins <= 1:
                raise serializers.ValidationError({
                    "detail": (
                        "At least one active Admin account must remain."
                    )
                })

        return attrs

    def create(self, validated_data):
        """Create a staff account with a hashed password."""
        name = validated_data.pop("name")
        password = validated_data.pop("password")

        first_name, last_name = split_display_name(name)

        validated_data["first_name"] = first_name
        validated_data["last_name"] = last_name

        return User.objects.create_user(
            password=password,
            **validated_data,
        )

    def update(self, instance, validated_data):
        """
        Update an account, including role changes and password changes.

        A registered CUSTOMER can be promoted by an authorized Admin.
        """
        name = validated_data.pop("name", None)
        password = validated_data.pop("password", None)

        if name is not None:
            instance.first_name, instance.last_name = (
                split_display_name(name)
            )

        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)

        if password:
            instance.set_password(password)

        instance.save()

        return instance