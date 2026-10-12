from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("crm", "0016_phase28_customer_account"),
    ]

    operations = [
        migrations.RenameIndex(
            model_name="storefrontaddress",
            old_name="crm_storefront_user_id_29a81e_idx",
            new_name="crm_store_user_idx",
        ),
        migrations.CreateModel(
            name="StorefrontOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("shipping_address", models.JSONField(default=dict)),
                ("payment_method", models.CharField(default="UPI", max_length=32)),
                ("payment_status", models.CharField(choices=[("NOT_PROCESSED", "Not processed")], default="NOT_PROCESSED", max_length=24)),
                ("item_subtotal", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("product_subtotal", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("product_discount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("coupon_discount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("delivery_fee", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("coupon_code", models.CharField(blank=True, max_length=32)),
                ("inventory_released", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("crm_order", models.OneToOneField(on_delete=django.db.models.deletion.PROTECT, related_name="storefront_checkout", to="crm.order")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_orders", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="storefrontorder",
            index=models.Index(fields=["user", "created_at"], name="crm_sf_order_user_date_idx"),
        ),
        migrations.CreateModel(
            name="StorefrontOrderItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("product_name", models.CharField(max_length=200)),
                ("product_sku", models.CharField(blank=True, max_length=64)),
                ("image_url", models.CharField(blank=True, max_length=2000)),
                ("short_description", models.TextField(blank=True)),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("list_price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("quantity", models.PositiveIntegerField()),
                ("line_total", models.DecimalField(decimal_places=2, max_digits=12)),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="crm.storefrontorder")),
                ("product", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="storefront_order_items", to="crm.product")),
            ],
            options={"ordering": ["id"]},
        ),
    ]
