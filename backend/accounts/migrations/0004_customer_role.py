from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_organization_alter_user_email_alter_user_role_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("ADMIN", "Admin"),
                    ("CUSTOMER", "Customer"),
                    ("SALES", "Sales"),
                    ("MARKETING", "Marketing"),
                    ("SUPPORT", "Support"),
                    ("OPERATIONS", "Operations"),
                    ("MANAGEMENT", "Management"),
                ],
                default="SALES",
                max_length=20,
            ),
        ),
    ]
