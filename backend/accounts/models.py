
# ============================================================
# Django imports
# ============================================================

from django.conf import settings

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone

class UserManager(BaseUserManager):
    """Manage creation of email-based users and superusers."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")

        email = email.strip().lower()

        user = self.model(
            email=email,
            **extra_fields,
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", "ADMIN")

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        if extra_fields.get("is_active") is not True:
            raise ValueError("Superuser must have is_active=True")

        return self.create_user(
            email=email,
            password=password,
            **extra_fields,
        )


# ============================================================
# Organization model
# ============================================================

class Organization(models.Model):
    """Represent an organization or tenant in the CRM."""

    name = models.CharField(
        max_length=150,
        unique=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"

    def __str__(self):
        return self.name


# ============================================================
# User model
# ============================================================

class User(AbstractUser):
    """Custom user authenticated using a unique email address."""

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        CUSTOMER = "CUSTOMER", "Customer"
        SALES = "SALES", "Sales"
        MARKETING = "MARKETING", "Marketing"
        SUPPORT = "SUPPORT", "Support"
        OPERATIONS = "OPERATIONS", "Operations"
        MANAGEMENT = "MANAGEMENT", "Management"
        ANALYST = "ANALYST", "Analyst"

    # Remove username-based authentication.
    username = None

    email = models.EmailField(unique=True)

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
    )

    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        related_name="users",
        null=True,
        blank=True,
    )

    crm_permissions = models.JSONField(
    default=list,
    blank=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ["email"]
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.email


# ============================================================
# Refresh token model
# ============================================================

class RefreshToken(models.Model):
    """Store refresh-token identifiers and their revocation state."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="refresh_tokens",
    )

    jti = models.UUIDField(unique=True)
    expires_at = models.DateTimeField()

    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "revoked_at"],
                name="refresh_user_revoked_idx",
            ),
            models.Index(
                fields=["expires_at"],
                name="refresh_expires_idx",
            ),
        ]

    @property
    def is_revoked(self):
        return self.revoked_at is not None

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()

    @property
    def is_valid(self):
        return not self.is_revoked and not self.is_expired

    def __str__(self):
        return f"Refresh token for user {self.user_id}"
