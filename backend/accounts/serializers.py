from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Organization


User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):

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


class RegisterSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True,
        min_length=8
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

        read_only_fields = [
            "id",
        ]

    def create(self, validated_data):

        password = validated_data.pop("password")

        user = User.objects.create_user(
            password=password,
            role=User.Role.SALES,
            **validated_data
        )

        return user


class UserSerializer(serializers.ModelSerializer):

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
            "date_joined",
        ]

class StorefrontCustomerRegisterSerializer(serializers.ModelSerializer):
    """Public storefront registration. The client cannot choose a privileged role."""
    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["id", "email", "password", "first_name", "last_name", "role"]
        read_only_fields = ["id", "role"]

    def validate_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value)
        return value

    def create(self, validated_data):
        from django.db import transaction
        from crm.models import StorefrontCustomerProfile
        from crm.storefront_utils import ensure_storefront_customer, get_storefront_organization

        password = validated_data.pop("password")
        organization = get_storefront_organization()
        if organization is None:
            raise serializers.ValidationError({
                "detail": "The storefront CRM organization is not configured. Configure STOREFRONT_ORGANIZATION_ID or create a product category first."
            })
        with transaction.atomic():
            user = User.objects.create_user(
                password=password,
                role="CUSTOMER",
                is_active=True,
                organization=organization,
                **validated_data,
            )
            StorefrontCustomerProfile.objects.create(user=user)
            # Keep new registrations visible in the CRM customer directory immediately.
            ensure_storefront_customer(user, organization)
            return user
