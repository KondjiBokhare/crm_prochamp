"""Shared organization/customer helpers for authenticated storefront APIs."""
from django.conf import settings
from django.core.cache import cache

from accounts.models import Organization
from .models import Category, Customer, CrmCustomerProfile

# Cache keys used by the public storefront read endpoints, one per organization.
STOREFRONT_CACHE_NAMES = (
    "categories",
    "products",
    "banners",
    "homepage-promotions",
    "settings",
)


def storefront_cache_key(name, organization_id, extra=""):
    """Build the cache key for a public storefront endpoint."""
    return f"storefront:{name}:{organization_id}:{extra}"


def invalidate_storefront_cache(organization_id):
    """Drop cached public storefront responses for one organization."""
    if organization_id is None:
        return
    cache.delete_many(
        [storefront_cache_key(name, organization_id) for name in STOREFRONT_CACHE_NAMES]
    )


def get_storefront_organization():
    """Resolve the single public storefront organization, matching public catalogue APIs."""
    configured = getattr(settings, "STOREFRONT_ORGANIZATION_ID", None)
    if configured not in (None, ""):
        try:
            organization = Organization.objects.filter(pk=int(configured)).first()
        except (TypeError, ValueError):
            organization = None
        if organization is not None:
            return organization
    organization_id = Category.objects.order_by("organization_id").values_list(
        "organization_id", flat=True
    ).first()
    if organization_id is None:
        return None
    return Organization.objects.filter(pk=organization_id).first()


def ensure_storefront_customer(user, organization=None):
    """Get/create the CRM directory row for this authenticated storefront account."""
    organization = organization or get_storefront_organization()
    if organization is None:
        return None
    if user.organization_id not in (None, organization.pk):
        return None
    if user.organization_id is None:
        user.organization = organization
        user.save(update_fields=["organization"])

    profile, _ = CrmCustomerProfile.objects.get_or_create(user=user)
    email = str(user.email or "").strip().lower()
    if not email:
        return None
    customer = Customer.objects.filter(
        organization=organization, email__iexact=email
    ).first()
    values = {
        "first_name": (user.first_name or "")[:100],
        "last_name": (user.last_name or "")[:100],
        "phone": (profile.phone or "")[:20],
        "is_active": bool(user.is_active),
    }
    if customer is None:
        customer = Customer.objects.create(
            organization=organization,
            email=user.email,
            lifecycle_stage=Customer.LifecycleStage.CUSTOMER,
            **values,
        )
    else:
        changed = []
        for field, value in values.items():
            # Account values are authoritative for account identity and phone.
            if getattr(customer, field) != value:
                setattr(customer, field, value)
                changed.append(field)
        if changed:
            customer.save(update_fields=[*changed, "updated_at"])
    return customer
