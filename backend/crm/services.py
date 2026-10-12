
from django.db.models import Count

from .models import AuditLog, Customer, Order
from .models import AuditLog



def update_customer_lifecycle(customer):
    """
    Update a customer's lifecycle stage based on eligible orders.
    Cancelled and refunded orders are excluded.
    """
    eligible_order_count = Order.objects.filter(
        organization=customer.organization,
        customer=customer,
    ).exclude(
        status__in=["CANCELLED", "REFUNDED"]
    ).count()

    if eligible_order_count >= 5:
        new_stage = Customer.LifecycleStage.LOYAL
    elif eligible_order_count >= 2:
        new_stage = Customer.LifecycleStage.REPEAT
    elif eligible_order_count >= 1:
        new_stage = Customer.LifecycleStage.CUSTOMER
    else:
        new_stage = Customer.LifecycleStage.LEAD

    if customer.lifecycle_stage != new_stage:
        customer.lifecycle_stage = new_stage
        customer.save(update_fields=["lifecycle_stage", "updated_at"])

    return customer

def create_audit_log(
    organization,
    user,
    action,
    entity_type,
    entity_id="",
    description="",
    ip_address=None,
):
    return AuditLog.objects.create(
        organization=organization,
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else "",
        description=description,
        ip_address=ip_address,
    )