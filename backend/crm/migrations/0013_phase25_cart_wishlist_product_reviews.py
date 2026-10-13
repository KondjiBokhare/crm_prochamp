# Generated for Phase 25 storefront cart, wishlist, and moderated product reviews.
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("crm", "0012_phase24_behavior_events")]

    operations = [
        migrations.CreateModel(
            name="StorefrontCart",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("visitor_id", models.CharField(max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_carts", to="accounts.organization")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.AddConstraint(
            model_name="storefrontcart",
            constraint=models.UniqueConstraint(fields=("organization", "visitor_id"), name="crm_cart_org_visitor_uniq"),
        ),
        migrations.AddIndex(
            model_name="storefrontcart",
            index=models.Index(fields=["organization", "updated_at"], name="crm_cart_org_updated_idx"),
        ),
        migrations.CreateModel(
            name="ProductReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("visitor_id", models.CharField(max_length=100)),
                ("reviewer_name", models.CharField(max_length=100)),
                ("rating", models.PositiveSmallIntegerField()),
                ("title", models.CharField(max_length=120)),
                ("comment", models.TextField(max_length=2000)),
                ("status", models.CharField(choices=[("PENDING", "Pending moderation"), ("APPROVED", "Approved"), ("REJECTED", "Rejected")], default="PENDING", max_length=12)),
                ("verified_purchase", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="product_reviews", to="accounts.organization")),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="customer_reviews", to="crm.product")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="productreview",
            constraint=models.UniqueConstraint(fields=("organization", "product", "visitor_id"), name="crm_review_org_prod_visit_uniq"),
        ),
        migrations.AddIndex(
            model_name="productreview",
            index=models.Index(fields=["organization", "status", "created_at"], name="crm_review_org_status_idx"),
        ),
        migrations.AddIndex(
            model_name="productreview",
            index=models.Index(fields=["product", "status"], name="crm_review_product_status_idx"),
        ),
        migrations.CreateModel(
            name="StorefrontWishlistItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("visitor_id", models.CharField(max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_wishlist_items", to="accounts.organization")),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_wishlist_items", to="crm.product")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="storefrontwishlistitem",
            constraint=models.UniqueConstraint(fields=("organization", "visitor_id", "product"), name="crm_wish_org_visit_prod_uniq"),
        ),
        migrations.AddIndex(
            model_name="storefrontwishlistitem",
            index=models.Index(fields=["organization", "visitor_id"], name="crm_wish_org_visitor_idx"),
        ),
        migrations.CreateModel(
            name="StorefrontCartItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("cart", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="items", to="crm.storefrontcart")),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_cart_items", to="crm.product")),
            ],
            options={"ordering": ["created_at"]},
        ),
        migrations.AddConstraint(
            model_name="storefrontcartitem",
            constraint=models.UniqueConstraint(fields=("cart", "product"), name="crm_cart_item_product_uniq"),
        ),
    ]
