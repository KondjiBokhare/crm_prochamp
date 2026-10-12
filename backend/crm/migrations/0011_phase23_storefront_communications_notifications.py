# Generated for Phase 23 persisted storefront settings, communications and notifications.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0010_phase22_leads_banners_promotions"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="StorefrontSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("data", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("organization", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_settings", to="accounts.organization")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="updated_storefront_settings", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="CommunicationTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("channel", models.CharField(choices=[("In-app", "In-app"), ("Email", "Email"), ("SMS", "SMS")], default="In-app", max_length=10)),
                ("subject", models.CharField(blank=True, max_length=160)),
                ("body", models.TextField(max_length=3000)),
                ("category", models.CharField(default="General", max_length=30)),
                ("status", models.CharField(choices=[("Active", "Active"), ("Draft", "Draft"), ("Archived", "Archived")], default="Draft", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_communication_templates", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="communication_templates", to="accounts.organization")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="updated_communication_templates", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.AddConstraint(
            model_name="communicationtemplate",
            constraint=models.UniqueConstraint(fields=("organization", "name"), name="crm_comms_tpl_org_name_uniq"),
        ),
        migrations.CreateModel(
            name="CommunicationLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject", models.CharField(max_length=160)),
                ("body", models.TextField(max_length=3000)),
                ("channel", models.CharField(choices=[("In-app", "In-app"), ("Email", "Email"), ("SMS", "SMS")], max_length=10)),
                ("audience", models.CharField(default="All customers", max_length=160)),
                ("audience_key", models.CharField(default="all", max_length=100)),
                ("recipient_count", models.PositiveIntegerField(default=0)),
                ("notification_type", models.CharField(default="general", max_length=20)),
                ("status", models.CharField(default="Recorded (not sent)", max_length=50)),
                ("scheduled_at", models.DateTimeField(blank=True, null=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("actor", models.CharField(blank=True, max_length=254)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_communication_logs", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="communication_logs", to="accounts.organization")),
                ("template", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="logs", to="crm.communicationtemplate")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="communicationlog",
            index=models.Index(fields=["organization", "created_at"], name="crm_commlog_org_created_idx"),
        ),
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("message", models.TextField(max_length=2000)),
                ("notification_type", models.CharField(default="general", max_length=30)),
                ("audience", models.CharField(default="crm", max_length=20)),
                ("recipient_email", models.EmailField(blank=True, max_length=254)),
                ("recipient_emails", models.JSONField(blank=True, default=list)),
                ("recipient_role", models.CharField(blank=True, max_length=30)),
                ("recipient_roles", models.JSONField(blank=True, default=list)),
                ("link", models.CharField(blank=True, max_length=500)),
                ("source", models.CharField(default="system", max_length=80)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_crm_notifications", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="crm_notifications", to="accounts.organization")),
                ("read_by", models.ManyToManyField(blank=True, related_name="read_crm_notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["organization", "created_at"], name="crm_notif_org_created_idx"),
        ),
    ]
