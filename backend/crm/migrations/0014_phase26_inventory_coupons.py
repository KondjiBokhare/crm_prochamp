# Generated for Phase 26 inventory movement logging and discount coupons.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0013_phase25_cart_wishlist_product_reviews"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DiscountCoupon",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=32)),
                ("name", models.CharField(max_length=120)),
                ("discount_type", models.CharField(choices=[("PERCENT", "Percentage"), ("FIXED", "Fixed amount")], max_length=8)),
                ("value", models.DecimalField(decimal_places=2, max_digits=10)),
                ("min_order_value", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("max_discount", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("starts_at", models.DateTimeField(blank=True, null=True)),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("usage_limit", models.PositiveIntegerField(blank=True, null=True)),
                ("used_count", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_discount_coupons", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="discount_coupons", to="accounts.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="discountcoupon",
            constraint=models.UniqueConstraint(fields=("organization", "code"), name="crm_coupon_org_code_uniq"),
        ),
        migrations.AddIndex(
            model_name="discountcoupon",
            index=models.Index(fields=["organization", "is_active"], name="crm_coupon_org_active_idx"),
        ),
        migrations.AddIndex(
            model_name="discountcoupon",
            index=models.Index(fields=["starts_at", "ends_at"], name="crm_coupon_dates_idx"),
        ),
        migrations.CreateModel(
            name="StockMovement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("movement_type", models.CharField(choices=[("ADJUSTMENT", "Manual adjustment"), ("RESTOCK", "Restock"), ("DAMAGE", "Damaged / written off"), ("RETURN", "Returned stock"), ("COUNT_CORRECTION", "Stock count correction")], max_length=20)),
                ("quantity_delta", models.IntegerField(help_text="Signed stock change: positive adds stock, negative removes stock.")),
                ("stock_before", models.PositiveIntegerField()),
                ("stock_after", models.PositiveIntegerField()),
                ("reason", models.CharField(blank=True, max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="stock_movements", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="stock_movements", to="accounts.organization")),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="stock_movements", to="crm.product")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="stockmovement",
            index=models.Index(fields=["organization", "created_at"], name="crm_stock_org_created_idx"),
        ),
        migrations.AddIndex(
            model_name="stockmovement",
            index=models.Index(fields=["product", "created_at"], name="crm_stock_prod_created_idx"),
        ),
    ]
