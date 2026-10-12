# Generated for Phase 28 storefront customer accounts.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0015_phase27_order_operations"),
        ("accounts", "0004_customer_role"),
    ]

    operations = [
        migrations.CreateModel(
            name="StorefrontCustomerProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("phone", models.CharField(blank=True, max_length=20)),
                ("date_of_birth", models.DateField(blank=True, null=True)),
                ("gender", models.CharField(choices=[("UNSPECIFIED", "Not specified"), ("FEMALE", "Female"), ("MALE", "Male"), ("NON_BINARY", "Non-binary"), ("PREFER_NOT_TO_SAY", "Prefer not to say")], default="UNSPECIFIED", max_length=24)),
                ("email_updates", models.BooleanField(default=True)),
                ("sms_updates", models.BooleanField(default=False)),
                ("whatsapp_updates", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_profile", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="StorefrontAddress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("label", models.CharField(choices=[("HOME", "Home"), ("WORK", "Work"), ("OTHER", "Other")], default="HOME", max_length=12)),
                ("full_name", models.CharField(max_length=150)),
                ("phone", models.CharField(max_length=20)),
                ("address_line1", models.CharField(max_length=250)),
                ("address_line2", models.CharField(blank=True, max_length=250)),
                ("city", models.CharField(max_length=100)),
                ("state", models.CharField(max_length=100)),
                ("postal_code", models.CharField(max_length=20)),
                ("country", models.CharField(default="India", max_length=100)),
                ("is_default", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_addresses", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-is_default", "-updated_at"]},
        ),
        migrations.AddIndex(
            model_name="storefrontaddress",
            index=models.Index(fields=["user", "is_default"], name="crm_storefront_user_id_29a81e_idx"),
        ),
        migrations.AddConstraint(
            model_name="storefrontaddress",
            constraint=models.UniqueConstraint(condition=models.Q(("is_default", True)), fields=("user",), name="unique_default_storefront_address_per_user"),
        ),
    ]
