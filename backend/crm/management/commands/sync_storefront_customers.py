"""Backfill CRM customer rows for storefront accounts registered before Phase 31."""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from accounts.models import Organization, User
from crm.models import Category, Customer, StorefrontCustomerProfile


class Command(BaseCommand):
    help = "Sync existing storefront customer accounts into the organization-scoped CRM customer directory."

    def handle(self, *args, **options):
        configured_org_id = getattr(settings, "STOREFRONT_ORGANIZATION_ID", None)
        if configured_org_id:
            try:
                organization = Organization.objects.filter(pk=int(configured_org_id)).first()
            except (TypeError, ValueError):
                organization = None
        else:
            category_org_id = Category.objects.order_by("organization_id").values_list(
                "organization_id", flat=True
            ).first()
            organization = Organization.objects.filter(pk=category_org_id).first() if category_org_id else None

        if organization is None:
            raise CommandError(
                "No storefront organization could be resolved. Configure STOREFRONT_ORGANIZATION_ID "
                "or create a category for the storefront organization first."
            )

        profiles = StorefrontCustomerProfile.objects.select_related("user").filter(
            user__role=User.Role.CUSTOMER
        ).order_by("user_id")
        created_count = 0
        already_present_count = 0
        skipped_count = 0

        for profile in profiles.iterator():
            user = profile.user
            if user.organization_id not in (None, organization.pk):
                skipped_count += 1
                self.stderr.write(
                    f"Skipped {user.email}: account belongs to organization {user.organization_id}, "
                    f"not storefront organization {organization.pk}."
                )
                continue

            if user.organization_id is None:
                user.organization = organization
                user.save(update_fields=["organization"])

            existing = Customer.objects.filter(
                organization=organization, email__iexact=user.email
            ).first()
            if existing:
                # Backfill only empty overlapping fields; do not overwrite changes
                # a CRM staff member may already have made to an existing record.
                changed_fields = []
                if not existing.first_name and user.first_name:
                    existing.first_name = user.first_name[:100]
                    changed_fields.append("first_name")
                if not existing.last_name and user.last_name:
                    existing.last_name = user.last_name[:100]
                    changed_fields.append("last_name")
                if not existing.phone and profile.phone:
                    existing.phone = profile.phone[:20]
                    changed_fields.append("phone")
                if changed_fields:
                    existing.save(update_fields=[*changed_fields, "updated_at"])
                already_present_count += 1
                continue

            Customer.objects.create(
                organization=organization,
                first_name=(user.first_name or "")[:100],
                last_name=(user.last_name or "")[:100],
                email=user.email,
                phone=(profile.phone or "")[:20],
                lifecycle_stage=Customer.LifecycleStage.CUSTOMER,
                is_active=user.is_active,
            )
            created_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Storefront customer sync complete for organization {organization.pk}: "
            f"created={created_count}, already_present={already_present_count}, skipped={skipped_count}."
        ))

        staff_roles = [
            User.Role.ADMIN, User.Role.SALES, User.Role.MARKETING,
            User.Role.SUPPORT, User.Role.OPERATIONS, User.Role.MANAGEMENT,
        ]
        staff_not_in_store_org = User.objects.filter(
            role__in=staff_roles,
            is_active=True,
        ).filter(Q(organization__isnull=True) | ~Q(organization=organization)).count()
        if staff_not_in_store_org:
            self.stdout.write(self.style.WARNING(
                f"Warning: {staff_not_in_store_org} active CRM staff account(s) are not assigned to "
                f"storefront organization {organization.pk}. The CRM Customers API is organization-scoped; "
                "the staff account used in the CRM must belong to this organization to see these records."
            ))
