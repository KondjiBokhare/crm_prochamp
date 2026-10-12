# Persist storefront order snapshots so account orders and CRM orders use one database record.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0016_phase28_customer_account"),
        ("accounts", "0004_customer_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="source_user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="storefront_orders",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="storefront_data",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
