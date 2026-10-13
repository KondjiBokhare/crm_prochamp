from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()

STAFF_ROLE_CHOICES = [
    (value, label)
    for value, label in User.Role.choices
    if value != User.Role.CUSTOMER
]


def split_display_name(value):
    parts = " ".join(str(value or "").split()).split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


class StaffUserSerializer(serializers.ModelSerializer):
    """Admin-only serializer for managing non-customer Django accounts."""

    name = serializers.CharField(write_only=True, required=False, allow_blank=False, max_length=150)
    password = serializers.CharField(write_only=True, required=False, min_length=8, trim_whitespace=False)
    role = serializers.ChoiceField(choices=STAFF_ROLE_CHOICES, required=True)
    # Keep the native `is_active` field in responses for the frontend mapper,
    # while accepting the UI's `active` property on POST/PATCH requests.
    active = serializers.BooleanField(source="is_active", write_only=True, required=False)

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
        read_only_fields = ["id", "is_active", "date_joined", "first_name", "last_name"]

    def validate_password(self, value):
        try:
            validate_password(value, user=self.instance)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        if self.instance is None:
            if not attrs.get("name", "").strip():
                raise serializers.ValidationError({"name": "This field is required."})
            if not attrs.get("password"):
                raise serializers.ValidationError({"password": "This field is required."})
            return attrs

        current = self.instance
        next_role = attrs.get("role", current.role)
        next_active = attrs.get("is_active", current.is_active)

        # Prevent an administrator from locking themselves out through this API.
        if request and request.user.pk == current.pk and (
            not next_active or next_role != current.role
        ):
            raise serializers.ValidationError({
                "detail": "You cannot deactivate or change the role of your own signed-in account."
            })

        # Always retain at least one active Admin account.
        if current.role == User.Role.ADMIN and (
            next_role != User.Role.ADMIN or not next_active
        ):
            active_admins = User.objects.filter(role=User.Role.ADMIN, is_active=True).count()
            if active_admins <= 1:
                raise serializers.ValidationError({
                    "detail": "At least one active Admin account must remain."
                })

        return attrs

    def create(self, validated_data):
        name = validated_data.pop("name")
        password = validated_data.pop("password")
        first_name, last_name = split_display_name(name)
        validated_data["first_name"] = first_name
        validated_data["last_name"] = last_name
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        name = validated_data.pop("name", None)
        password = validated_data.pop("password", None)

        if name is not None:
            instance.first_name, instance.last_name = split_display_name(name)

        for attribute, value in validated_data.items():
            setattr(instance, attribute, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance
