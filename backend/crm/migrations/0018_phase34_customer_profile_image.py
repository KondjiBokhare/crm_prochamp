# Customer 360 private profile image storage (Phase 34).
from django.db import migrations, models


def add_profile_image_column_if_missing(apps, schema_editor):
    Profile = apps.get_model("crm", "StorefrontCustomerProfile")
    table = Profile._meta.db_table
    with schema_editor.connection.cursor() as cursor:
        existing_columns = {column.name for column in schema_editor.connection.introspection.get_table_description(cursor, table)}
    field = models.ImageField(blank=True, null=True, upload_to="customer-profile-images/%Y/%m/")
    field.set_attributes_from_name("profile_image")
    field.model = Profile
    if field.column not in existing_columns:
        schema_editor.add_field(Profile, field)


class Migration(migrations.Migration):
    dependencies = [("crm", "0017_phase33_storefront_order_snapshots")]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunPython(add_profile_image_column_if_missing, migrations.RunPython.noop)],
            state_operations=[migrations.AddField(
                model_name="storefrontcustomerprofile",
                name="profile_image",
                field=models.ImageField(blank=True, null=True, upload_to="customer-profile-images/%Y/%m/"),
            )],
        ),
    ]
