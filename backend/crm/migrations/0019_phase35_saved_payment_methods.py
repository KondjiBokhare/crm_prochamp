# Store safe, customer-managed display metadata for saved payment methods.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0018_phase34_customer_360_profile"),
        ("crm", "0018_phase34_customer_profile_image"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StorefrontSavedPaymentMethod",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("method_type", models.CharField(choices=[("CARD", "Card"), ("UPI", "UPI")], max_length=8)),
                ("label", models.CharField(max_length=100)),
                ("provider", models.CharField(blank=True, max_length=80)),
                ("upi_id", models.CharField(blank=True, max_length=150)),
                ("last_four", models.CharField(blank=True, max_length=4)),
                ("is_default", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="saved_payment_methods", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-is_default", "-updated_at"],
                "indexes": [models.Index(fields=["user", "is_default"], name="crm_paymethod_user_idx")],
                "constraints": [models.UniqueConstraint(fields=("user",), condition=models.Q(is_default=True), name="uniq_user_default_paymethod")],
            },
        ),
    ]
