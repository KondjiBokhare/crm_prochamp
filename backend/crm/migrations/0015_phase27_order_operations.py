# Generated for Phase 27 shipment, returns and order activity APIs.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0014_phase26_inventory_coupons"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="OrderShipment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("carrier", models.CharField(max_length=100)),
                ("tracking_number", models.CharField(max_length=120)),
                ("tracking_url", models.URLField(blank=True)),
                ("status", models.CharField(choices=[("PREPARING", "Preparing"), ("LABEL_CREATED", "Label created"), ("IN_TRANSIT", "In transit"), ("OUT_FOR_DELIVERY", "Out for delivery"), ("DELIVERED", "Delivered"), ("EXCEPTION", "Delivery exception"), ("RETURN_TO_SENDER", "Return to sender")], default="PREPARING", max_length=24)),
                ("shipped_at", models.DateTimeField(blank=True, null=True)),
                ("estimated_delivery", models.DateField(blank=True, null=True)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_order_shipments", to=settings.AUTH_USER_MODEL)),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="shipments", to="crm.order")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="order_shipments", to="accounts.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(model_name="ordershipment", index=models.Index(fields=["organization", "status"], name="crm_ship_org_status_idx")),
        migrations.AddIndex(model_name="ordershipment", index=models.Index(fields=["order", "created_at"], name="crm_ship_order_created_idx")),
        migrations.CreateModel(
            name="OrderReturnRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("reason", models.CharField(choices=[("DAMAGED", "Damaged"), ("DEFECTIVE", "Defective"), ("WRONG_ITEM", "Wrong item"), ("NOT_AS_DESCRIBED", "Not as described"), ("CHANGE_OF_MIND", "Change of mind"), ("OTHER", "Other")], default="OTHER", max_length=24)),
                ("description", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("REQUESTED", "Requested"), ("APPROVED", "Approved"), ("REJECTED", "Rejected"), ("ITEM_RECEIVED", "Item received"), ("REFUND_PENDING", "Refund pending"), ("CLOSED", "Closed")], default="REQUESTED", max_length=20)),
                ("resolution_note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="return_requests", to="crm.order")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="order_return_requests", to="accounts.organization")),
                ("requested_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_order_returns", to=settings.AUTH_USER_MODEL)),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_order_returns", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(model_name="orderreturnrequest", index=models.Index(fields=["organization", "status"], name="crm_return_org_status_idx")),
        migrations.AddIndex(model_name="orderreturnrequest", index=models.Index(fields=["order", "created_at"], name="crm_return_order_created_idx")),
        migrations.CreateModel(
            name="OrderActivityEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(choices=[("NOTE", "Internal note"), ("CUSTOMER_CONTACT", "Customer contact"), ("SHIPMENT", "Shipment update"), ("RETURN", "Return update"), ("STATUS", "Order status")], default="NOTE", max_length=24)),
                ("message", models.CharField(max_length=2000)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="activity_events", to="crm.order")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="order_activity_events", to="accounts.organization")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_order_activity_events", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(model_name="orderactivityevent", index=models.Index(fields=["organization", "created_at"], name="crm_orderact_org_created_idx")),
        migrations.AddIndex(model_name="orderactivityevent", index=models.Index(fields=["order", "created_at"], name="crm_orderact_order_created_idx")),
    ]
