# Customer 360 profile migration compatibility branch.
# Profile image storage is handled idempotently by the sibling migration.
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("crm", "0017_phase33_storefront_order_snapshots")]
    operations = []
