# Generated for Phase 24 pseudonymous storefront behaviour-event persistence.
import decimal
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0011_phase23_storefront_communications_notifications"),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomerBehaviorEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_id", models.CharField(max_length=100)),
                ("visitor_id", models.CharField(max_length=100)),
                ("session_id", models.CharField(max_length=100)),
                ("event_type", models.CharField(choices=[("product_view", "Product view"), ("search", "Search"), ("add_to_cart", "Add to cart"), ("wishlist_add", "Wishlist add"), ("wishlist_remove", "Wishlist remove"), ("checkout_started", "Checkout started"), ("purchase", "Demo purchase")], max_length=32)),
                ("path", models.CharField(blank=True, max_length=200)),
                ("previous_viewed_product_id", models.CharField(blank=True, max_length=80)),
                ("previous_viewed_product_name", models.CharField(blank=True, max_length=160)),
                ("product_id", models.CharField(blank=True, max_length=80)),
                ("product_name", models.CharField(blank=True, max_length=200)),
                ("product_category", models.CharField(blank=True, max_length=80)),
                ("product_brand", models.CharField(blank=True, max_length=80)),
                ("unit_price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("query", models.CharField(blank=True, max_length=120)),
                ("search_category", models.CharField(blank=True, max_length=80)),
                ("result_count", models.PositiveIntegerField(default=0)),
                ("matched_product_ids", models.JSONField(blank=True, default=list)),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("item_count", models.PositiveIntegerField(blank=True, null=True)),
                ("order_id", models.CharField(blank=True, max_length=80)),
                ("line_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("order_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_behavior_events", to="accounts.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="customerbehaviorevent",
            constraint=models.UniqueConstraint(fields=("organization", "event_id"), name="crm_beh_org_event_uniq"),
        ),
        migrations.AddIndex(
            model_name="customerbehaviorevent",
            index=models.Index(fields=["organization", "event_type", "created_at"], name="crm_beh_org_type_created_idx"),
        ),
        migrations.AddIndex(
            model_name="customerbehaviorevent",
            index=models.Index(fields=["organization", "visitor_id", "session_id"], name="crm_beh_org_visitor_idx"),
        ),
    ]
