# Generated for Phase 22 leads, banner management and homepage promotions.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0009_phase21_catalog_support"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Lead",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("lead_code", models.CharField(blank=True, max_length=24, unique=True)),
                ("name", models.CharField(max_length=120)),
                ("email", models.EmailField(max_length=180)),
                ("phone", models.CharField(blank=True, max_length=32)),
                ("company", models.CharField(blank=True, default="Independent", max_length=120)),
                ("city", models.CharField(blank=True, max_length=80)),
                ("source", models.CharField(choices=[("Website", "Website"), ("Product Enquiry", "Product Enquiry"), ("Campaign", "Campaign"), ("Referral", "Referral"), ("Social Media", "Social Media"), ("Phone", "Phone"), ("Email", "Email"), ("Event", "Event"), ("Other", "Other")], default="Website", max_length=40)),
                ("status", models.CharField(choices=[("New", "New"), ("Contacted", "Contacted"), ("Qualified", "Qualified"), ("Proposal", "Proposal"), ("Converted", "Converted"), ("Lost", "Lost")], default="New", max_length=16)),
                ("assigned_to", models.CharField(default="Unassigned", max_length=120)),
                ("score", models.PositiveSmallIntegerField(default=50)),
                ("estimated_value", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("next_follow_up_at", models.DateField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                ("follow_ups", models.JSONField(blank=True, default=list)),
                ("status_history", models.JSONField(blank=True, default=list)),
                ("converted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("converted_customer", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="converted_leads", to="crm.customer")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_crm_leads", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="crm_leads", to="accounts.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Banner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("eyebrow", models.CharField(blank=True, max_length=70)),
                ("title", models.CharField(max_length=100)),
                ("subtitle", models.CharField(blank=True, max_length=220)),
                ("button_text", models.CharField(blank=True, default="Shop Now", max_length=35)),
                ("target_url", models.CharField(default="/products", max_length=500)),
                ("image_url", models.URLField(blank=True, max_length=1000)),
                ("placement", models.CharField(choices=[("HERO", "Homepage hero"), ("PROMO", "Homepage promo tile")], default="HERO", max_length=8)),
                ("background_color", models.CharField(default="#061a3c", max_length=7)),
                ("text_color", models.CharField(default="#ffffff", max_length=7)),
                ("status", models.CharField(choices=[("Draft", "Draft"), ("Active", "Active"), ("Paused", "Paused")], default="Draft", max_length=8)),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                ("impressions", models.PositiveBigIntegerField(default=0)),
                ("clicks", models.PositiveBigIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_storefront_banners", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="storefront_banners", to="accounts.organization")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="HomepagePromotionSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("enabled", models.BooleanField(default=True)),
                ("selection_mode", models.CharField(choices=[("AUTO", "Automatic"), ("MANUAL", "Manual")], default="AUTO", max_length=6)),
                ("featured_product_ids", models.JSONField(blank=True, default=list)),
                ("section_title", models.CharField(default="Featured products", max_length=100)),
                ("subtitle", models.CharField(blank=True, default="Picked by our marketing team for your setup.", max_length=180)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("organization", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="homepage_promotion_settings", to="accounts.organization")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="updated_homepage_promotion_settings", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Homepage promotion settings", "verbose_name_plural": "Homepage promotion settings"},
        ),
        migrations.AddIndex(model_name="lead", index=models.Index(fields=["organization", "status"], name="crm_lead_org_status_idx")),
        migrations.AddIndex(model_name="lead", index=models.Index(fields=["organization", "source"], name="crm_lead_org_source_idx")),
        migrations.AddIndex(model_name="lead", index=models.Index(fields=["email"], name="crm_lead_email_idx")),
        migrations.AddIndex(model_name="banner", index=models.Index(fields=["organization", "placement", "status"], name="crm_banner_org_place_idx")),
        migrations.AddIndex(model_name="banner", index=models.Index(fields=["start_date", "end_date"], name="crm_banner_dates_idx")),
    ]
