# Generated for Phase 21 product catalogue, categories and support tickets.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0008_auditlog"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Category",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=60)),
                ("icon_key", models.CharField(default="package", max_length=32)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="product_categories", to="accounts.organization")),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Product",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("sku", models.CharField(max_length=64)),
                ("brand", models.CharField(max_length=120)),
                ("subcategory", models.CharField(blank=True, max_length=120)),
                ("price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("mrp", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("stock", models.PositiveIntegerField(default=0)),
                ("status", models.CharField(choices=[("Active", "Active"), ("Draft", "Draft"), ("Inactive", "Inactive")], default="Draft", max_length=12)),
                ("images", models.JSONField(blank=True, default=list)),
                ("short_description", models.TextField(blank=True)),
                ("specs", models.TextField(blank=True)),
                ("highlights", models.JSONField(blank=True, default=list)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("specifications", models.JSONField(blank=True, default=list)),
                ("badge", models.CharField(blank=True, max_length=80)),
                ("rating", models.DecimalField(decimal_places=2, default=0, max_digits=3)),
                ("reviews", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("category", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="products", to="crm.category")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="catalog_products", to="accounts.organization")),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="SupportTicket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ticket_code", models.CharField(blank=True, max_length=32, unique=True)),
                ("customer_name", models.CharField(max_length=120)),
                ("customer_email", models.EmailField(max_length=254)),
                ("subject", models.CharField(max_length=160)),
                ("category", models.CharField(default="Other", max_length=40)),
                ("order_id", models.CharField(blank=True, max_length=60)),
                ("description", models.TextField()),
                ("priority", models.CharField(choices=[("Low", "Low"), ("Medium", "Medium"), ("High", "High"), ("Urgent", "Urgent")], default="Medium", max_length=12)),
                ("status", models.CharField(choices=[("Open", "Open"), ("In Progress", "In Progress"), ("Waiting on Customer", "Waiting on Customer"), ("Resolved", "Resolved"), ("Closed", "Closed")], default="Open", max_length=24)),
                ("assigned_to", models.CharField(default="Unassigned", max_length=120)),
                ("status_history", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_support_tickets", to=settings.AUTH_USER_MODEL)),
                ("customer", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="support_tickets", to="crm.customer")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="support_tickets", to="accounts.organization")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="SupportTicketMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("author_name", models.CharField(max_length=120)),
                ("text", models.TextField(max_length=2000)),
                ("is_internal", models.BooleanField(default=False)),
                ("is_initial_request", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="support_ticket_messages", to=settings.AUTH_USER_MODEL)),
                ("ticket", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="crm.supportticket")),
            ],
            options={"ordering": ["created_at"]},
        ),
        migrations.AddConstraint(
            model_name="category",
            constraint=models.UniqueConstraint(fields=("organization", "name"), name="unique_category_name_per_organization"),
        ),
        migrations.AddConstraint(
            model_name="product",
            constraint=models.UniqueConstraint(fields=("organization", "sku"), name="unique_product_sku_per_organization"),
        ),
        migrations.AddIndex(
            model_name="category",
            index=models.Index(fields=["organization", "is_active"], name="crm_categ_org_active_idx"),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["organization", "status"], name="crm_prod_org_status_idx"),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["category", "status"], name="crm_prod_cat_status_idx"),
        ),
        migrations.AddIndex(
            model_name="supportticket",
            index=models.Index(fields=["organization", "status"], name="crm_ticket_org_status_idx"),
        ),
        migrations.AddIndex(
            model_name="supportticket",
            index=models.Index(fields=["organization", "priority"], name="crm_ticket_org_priority_idx"),
        ),
        migrations.AddIndex(
            model_name="supportticket",
            index=models.Index(fields=["customer_email"], name="crm_ticket_customer_email_idx"),
        ),
        migrations.AddIndex(
            model_name="supportticketmessage",
            index=models.Index(fields=["ticket", "is_internal", "created_at"], name="crm_ticket_msg_thread_idx"),
        ),
    ]
