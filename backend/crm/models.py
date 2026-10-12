import uuid
from django.db import models
from django.conf import settings
from accounts.models import Organization


class Customer(models.Model):

    class LifecycleStage(models.TextChoices):
        VISITOR = "VISITOR", "Visitor"
        LEAD = "LEAD", "Lead"
        CUSTOMER = "CUSTOMER", "Customer"
        REPEAT = "REPEAT", "Repeat Customer"
        LOYAL = "LOYAL", "Loyal Customer"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="customers"
    )

    first_name = models.CharField(
        max_length=100
    )

    last_name = models.CharField(
        max_length=100,
        blank=True
    )

    email = models.EmailField()

    phone = models.CharField(
        max_length=20,
        blank=True
    )

    lifecycle_stage = models.CharField(
        max_length=20,
        choices=LifecycleStage.choices,
        default=LifecycleStage.LEAD
    )

    is_active = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        indexes = [
            models.Index(
                fields=["organization"]
            ),
            models.Index(
                fields=["email"]
            ),
            models.Index(
                fields=["lifecycle_stage"]
            ),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()

class Interaction(models.Model):

    class InteractionType(models.TextChoices):
        CALL = "CALL", "Call"
        EMAIL = "EMAIL", "Email"
        MEETING = "MEETING", "Meeting"
        WHATSAPP = "WHATSAPP", "WhatsApp"
        NOTE = "NOTE", "Note"
        FOLLOW_UP = "FOLLOW_UP", "Follow Up"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="interactions"
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="interactions"
    )

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_interactions"
    )

    interaction_type = models.CharField(
        max_length=20,
        choices=InteractionType.choices
    )

    subject = models.CharField(
        max_length=200
    )

    description = models.TextField(
        blank=True
    )

    interaction_date = models.DateTimeField()

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-interaction_date"]

        indexes = [
            models.Index(
                fields=["organization"]
            ),
            models.Index(
                fields=["customer"]
            ),
            models.Index(
                fields=["interaction_date"]
            ),
        ]

    def __str__(self):
        return f"{self.customer} - {self.interaction_type}"

class Order(models.Model):

    class OrderStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        PROCESSING = "PROCESSING", "Processing"
        SHIPPED = "SHIPPED", "Shipped"
        DELIVERED = "DELIVERED", "Delivered"
        CANCELLED = "CANCELLED", "Cancelled"
        REFUNDED = "REFUNDED", "Refunded"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="orders"
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="orders"
    )

    order_number = models.CharField(
        max_length=50
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING
    )

    order_date = models.DateTimeField()

    # Connect customer storefront purchases to both their authenticated account
    # and the CRM order directory. Older staff-entered orders may leave these blank.
    source_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="storefront_orders",
    )
    storefront_data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-order_date"]

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "order_number"],
                name="unique_order_number_per_organization"
            )
        ]

        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["customer"]),
            models.Index(fields=["order_date"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return self.order_number


class OrderShipment(models.Model):
    class Status(models.TextChoices):
        PREPARING = "PREPARING", "Preparing"
        LABEL_CREATED = "LABEL_CREATED", "Label created"
        IN_TRANSIT = "IN_TRANSIT", "In transit"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for delivery"
        DELIVERED = "DELIVERED", "Delivered"
        EXCEPTION = "EXCEPTION", "Delivery exception"
        RETURN_TO_SENDER = "RETURN_TO_SENDER", "Return to sender"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="order_shipments")
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="shipments")
    carrier = models.CharField(max_length=100)
    tracking_number = models.CharField(max_length=120)
    tracking_url = models.URLField(blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PREPARING)
    shipped_at = models.DateTimeField(blank=True, null=True)
    estimated_delivery = models.DateField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_order_shipments")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"], name="crm_ship_org_status_idx"),
            models.Index(fields=["order", "created_at"], name="crm_ship_order_created_idx"),
        ]

    def __str__(self):
        return f"{self.order.order_number} · {self.tracking_number}"


class OrderReturnRequest(models.Model):
    class Reason(models.TextChoices):
        DAMAGED = "DAMAGED", "Damaged"
        DEFECTIVE = "DEFECTIVE", "Defective"
        WRONG_ITEM = "WRONG_ITEM", "Wrong item"
        NOT_AS_DESCRIBED = "NOT_AS_DESCRIBED", "Not as described"
        CHANGE_OF_MIND = "CHANGE_OF_MIND", "Change of mind"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        ITEM_RECEIVED = "ITEM_RECEIVED", "Item received"
        REFUND_PENDING = "REFUND_PENDING", "Refund pending"
        CLOSED = "CLOSED", "Closed"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="order_return_requests")
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="return_requests")
    reason = models.CharField(max_length=24, choices=Reason.choices, default=Reason.OTHER)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.REQUESTED)
    resolution_note = models.TextField(blank=True)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_order_returns")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_order_returns")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"], name="crm_return_org_status_idx"),
            models.Index(fields=["order", "created_at"], name="crm_return_order_created_idx"),
        ]

    def __str__(self):
        return f"Return #{self.pk or 'new'} for {self.order.order_number}"


class OrderActivityEvent(models.Model):
    class EventType(models.TextChoices):
        NOTE = "NOTE", "Internal note"
        CUSTOMER_CONTACT = "CUSTOMER_CONTACT", "Customer contact"
        SHIPMENT = "SHIPMENT", "Shipment update"
        RETURN = "RETURN", "Return update"
        STATUS = "STATUS", "Order status"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="order_activity_events")
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="activity_events")
    event_type = models.CharField(max_length=24, choices=EventType.choices, default=EventType.NOTE)
    message = models.CharField(max_length=2000)
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_order_activity_events")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"], name="crm_orderact_org_created_idx"),
            models.Index(fields=["order", "created_at"], name="crm_orderact_order_created_idx"),
        ]

    def __str__(self):
        return f"{self.order.order_number}: {self.message[:60]}"


class Segment(models.Model):

    class SegmentType(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        DYNAMIC = "DYNAMIC", "Dynamic"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="segments"
    )

    rules = models.JSONField(default=dict, blank=True)

    name = models.CharField(
        max_length=150
    )

    description = models.TextField(
        blank=True
    )

    segment_type = models.CharField(
        max_length=20,
        choices=SegmentType.choices,
        default=SegmentType.MANUAL
    )

    is_active = models.BooleanField(
        default=True
    )

    customers = models.ManyToManyField(
        Customer,
        blank=True,
        related_name="segments"
    )

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_segments"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-created_at"]

        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["segment_type"]),
            models.Index(fields=["is_active"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_segment_name_per_organization"
            )
        ]

    def __str__(self):
        return self.name
    

class Campaign(models.Model):

    class CampaignType(models.TextChoices):
        EMAIL = "EMAIL", "Email"
        SMS = "SMS", "SMS"
        WHATSAPP = "WHATSAPP", "WhatsApp"
        PUSH = "PUSH", "Push Notification"

    class CampaignStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SCHEDULED = "SCHEDULED", "Scheduled"
        RUNNING = "RUNNING", "Running"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="campaigns"
    )

    name = models.CharField(
        max_length=150
    )

    description = models.TextField(
        blank=True
    )

    campaign_type = models.CharField(
        max_length=20,
        choices=CampaignType.choices
    )

    status = models.CharField(
        max_length=20,
        choices=CampaignStatus.choices,
        default=CampaignStatus.DRAFT
    )

    segment = models.ForeignKey(
        Segment,
        on_delete=models.CASCADE,
        related_name="campaigns"
    )

    subject = models.CharField(
        max_length=200,
        blank=True
    )

    message = models.TextField()

    scheduled_at = models.DateTimeField(
        null=True,
        blank=True
    )

    started_at = models.DateTimeField(
        null=True,
        blank=True
    )

    completed_at = models.DateTimeField(
        null=True,
        blank=True
    )

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_campaigns"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-created_at"]

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_campaign_name_per_organization"
            )
        ]

        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["status"]),
            models.Index(fields=["campaign_type"]),
            models.Index(fields=["scheduled_at"]),
        ]

    def __str__(self):
        return self.name

class CampaignResponse(models.Model):

    class ResponseStatus(models.TextChoices):
        SENT = "SENT", "Sent"
        DELIVERED = "DELIVERED", "Delivered"
        OPENED = "OPENED", "Opened"
        CLICKED = "CLICKED", "Clicked"
        CONVERTED = "CONVERTED", "Converted"
        FAILED = "FAILED", "Failed"
        UNSUBSCRIBED = "UNSUBSCRIBED", "Unsubscribed"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="campaign_responses"
    )

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="responses"
    )

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="campaign_responses"
    )

    status = models.CharField(
        max_length=20,
        choices=ResponseStatus.choices,
        default=ResponseStatus.SENT
    )

    response_date = models.DateTimeField(
        auto_now=True
    )

    metadata = models.JSONField(
        default=dict,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ["-response_date"]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "campaign",
                    "customer",
                    "status",
                ],
                name="unique_campaign_customer_response_status"
            )
        ]

        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["campaign"]),
            models.Index(fields=["customer"]),
            models.Index(fields=["status"]),
            models.Index(fields=["response_date"]),
        ]

    def __str__(self):
        return (
            f"{self.campaign.name} - "
            f"{self.customer} - "
            f"{self.status}"
        )
    
class AuditLog(models.Model):

    class ActionType(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="audit_logs"
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs"
    )

    action = models.CharField(
        max_length=10,
        choices=ActionType.choices
    )

    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=100, blank=True)

    description = models.TextField(blank=True)

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["action"]),
        ]

    def __str__(self):
        return f"{self.action} {self.entity_type} by {self.user}"

# ---------------------------------------------------------------------------
# Phase 21 — Product catalogue, categories and support tickets
# ---------------------------------------------------------------------------

class Category(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="product_categories",
    )
    name = models.CharField(max_length=60)
    icon_key = models.CharField(max_length=32, default="package")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_category_name_per_organization",
            )
        ]
        indexes = [models.Index(fields=["organization", "is_active"], name="crm_categ_org_active_idx")]

    def __str__(self):
        return self.name


class Product(models.Model):
    class ProductStatus(models.TextChoices):
        ACTIVE = "Active", "Active"
        DRAFT = "Draft", "Draft"
        INACTIVE = "Inactive", "Inactive"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="catalog_products",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=64)
    brand = models.CharField(max_length=120)
    subcategory = models.CharField(max_length=120, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    mrp = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    stock = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=12, choices=ProductStatus.choices, default=ProductStatus.DRAFT)
    images = models.JSONField(default=list, blank=True)
    short_description = models.TextField(blank=True)
    specs = models.TextField(blank=True)
    highlights = models.JSONField(default=list, blank=True)
    tags = models.JSONField(default=list, blank=True)
    specifications = models.JSONField(default=list, blank=True)
    badge = models.CharField(max_length=80, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    reviews = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sku"],
                name="unique_product_sku_per_organization",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="crm_prod_org_status_idx"),
            models.Index(fields=["category", "status"], name="crm_prod_cat_status_idx"),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"


class SupportTicket(models.Model):
    class TicketStatus(models.TextChoices):
        OPEN = "Open", "Open"
        IN_PROGRESS = "In Progress", "In Progress"
        WAITING = "Waiting on Customer", "Waiting on Customer"
        RESOLVED = "Resolved", "Resolved"
        CLOSED = "Closed", "Closed"

    class TicketPriority(models.TextChoices):
        LOW = "Low", "Low"
        MEDIUM = "Medium", "Medium"
        HIGH = "High", "High"
        URGENT = "Urgent", "Urgent"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="support_tickets",
    )
    ticket_code = models.CharField(max_length=32, unique=True, blank=True)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_tickets",
    )
    customer_name = models.CharField(max_length=120)
    customer_email = models.EmailField()
    subject = models.CharField(max_length=160)
    category = models.CharField(max_length=40, default="Other")
    order_id = models.CharField(max_length=60, blank=True)
    description = models.TextField()
    priority = models.CharField(max_length=12, choices=TicketPriority.choices, default=TicketPriority.MEDIUM)
    status = models.CharField(max_length=24, choices=TicketStatus.choices, default=TicketStatus.OPEN)
    assigned_to = models.CharField(max_length=120, default="Unassigned")
    status_history = models.JSONField(default=list, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_support_tickets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["organization", "status"], name="crm_ticket_org_status_idx"),
            models.Index(fields=["organization", "priority"], name="crm_ticket_org_priority_idx"),
            models.Index(fields=["customer_email"], name="crm_ticket_customer_email_idx"),
        ]

    def save(self, *args, **kwargs):
        # Assign the unique code before the insert, avoiding simultaneous empty-code conflicts.
        if not self.ticket_code:
            self.ticket_code = f"TG-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ticket_code or self.pk}: {self.subject}"


class SupportTicketMessage(models.Model):
    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_ticket_messages",
    )
    author_name = models.CharField(max_length=120)
    text = models.TextField(max_length=2000)
    is_internal = models.BooleanField(default=False)
    is_initial_request = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["ticket", "is_internal", "created_at"], name="crm_ticket_msg_thread_idx")]

    def __str__(self):
        return f"Message for {self.ticket.ticket_code} by {self.author_name}"

# ---------------------------------------------------------------------------
# Phase 22 — Leads, banners and homepage promotion settings
# ---------------------------------------------------------------------------

class Lead(models.Model):
    class LeadStatus(models.TextChoices):
        NEW = "New", "New"
        CONTACTED = "Contacted", "Contacted"
        QUALIFIED = "Qualified", "Qualified"
        PROPOSAL = "Proposal", "Proposal"
        CONVERTED = "Converted", "Converted"
        LOST = "Lost", "Lost"

    class LeadSource(models.TextChoices):
        WEBSITE = "Website", "Website"
        PRODUCT_ENQUIRY = "Product Enquiry", "Product Enquiry"
        CAMPAIGN = "Campaign", "Campaign"
        REFERRAL = "Referral", "Referral"
        SOCIAL_MEDIA = "Social Media", "Social Media"
        PHONE = "Phone", "Phone"
        EMAIL = "Email", "Email"
        EVENT = "Event", "Event"
        OTHER = "Other", "Other"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="crm_leads"
    )
    lead_code = models.CharField(max_length=24, unique=True, blank=True)
    name = models.CharField(max_length=120)
    email = models.EmailField(max_length=180)
    phone = models.CharField(max_length=32, blank=True)
    company = models.CharField(max_length=120, blank=True, default="Independent")
    city = models.CharField(max_length=80, blank=True)
    source = models.CharField(max_length=40, choices=LeadSource.choices, default=LeadSource.WEBSITE)
    status = models.CharField(max_length=16, choices=LeadStatus.choices, default=LeadStatus.NEW)
    assigned_to = models.CharField(max_length=120, default="Unassigned")
    score = models.PositiveSmallIntegerField(default=50)
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    next_follow_up_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    follow_ups = models.JSONField(default=list, blank=True)
    status_history = models.JSONField(default=list, blank=True)
    converted_customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="converted_leads"
    )
    converted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_crm_leads"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "status"], name="crm_lead_org_status_idx"),
            models.Index(fields=["organization", "source"], name="crm_lead_org_source_idx"),
            models.Index(fields=["email"], name="crm_lead_email_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self.lead_code:
            self.lead_code = f"LEAD-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.lead_code}: {self.name}"


class Banner(models.Model):
    class Placement(models.TextChoices):
        HERO = "HERO", "Homepage hero"
        PROMO = "PROMO", "Homepage promo tile"

    class BannerStatus(models.TextChoices):
        DRAFT = "Draft", "Draft"
        ACTIVE = "Active", "Active"
        PAUSED = "Paused", "Paused"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="storefront_banners"
    )
    name = models.CharField(max_length=100)
    eyebrow = models.CharField(max_length=70, blank=True)
    title = models.CharField(max_length=100)
    subtitle = models.CharField(max_length=220, blank=True)
    button_text = models.CharField(max_length=35, default="Shop Now", blank=True)
    target_url = models.CharField(max_length=500, default="/products")
    image_url = models.URLField(max_length=1000, blank=True)
    placement = models.CharField(max_length=8, choices=Placement.choices, default=Placement.HERO)
    background_color = models.CharField(max_length=7, default="#061a3c")
    text_color = models.CharField(max_length=7, default="#ffffff")
    status = models.CharField(max_length=8, choices=BannerStatus.choices, default=BannerStatus.DRAFT)
    start_date = models.DateField()
    end_date = models.DateField()
    impressions = models.PositiveBigIntegerField(default=0)
    clicks = models.PositiveBigIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_storefront_banners"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "placement", "status"], name="crm_banner_org_place_idx"),
            models.Index(fields=["start_date", "end_date"], name="crm_banner_dates_idx"),
        ]

    def __str__(self):
        return self.name


class HomepagePromotionSettings(models.Model):
    class SelectionMode(models.TextChoices):
        AUTO = "AUTO", "Automatic"
        MANUAL = "MANUAL", "Manual"

    organization = models.OneToOneField(
        Organization, on_delete=models.CASCADE, related_name="homepage_promotion_settings"
    )
    enabled = models.BooleanField(default=True)
    selection_mode = models.CharField(max_length=6, choices=SelectionMode.choices, default=SelectionMode.AUTO)
    featured_product_ids = models.JSONField(default=list, blank=True)
    section_title = models.CharField(max_length=100, default="Featured products")
    subtitle = models.CharField(max_length=180, default="Picked by our marketing team for your setup.", blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="updated_homepage_promotion_settings"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Homepage promotion settings"
        verbose_name_plural = "Homepage promotion settings"

    def __str__(self):
        return f"Homepage promotions — {self.organization.name}"


# ---------------------------------------------------------------------------
# Phase 23 — persisted storefront settings, communications and notifications
# ---------------------------------------------------------------------------

class StorefrontSettings(models.Model):
    """Organization-scoped JSON settings used by the public store and CRM editor."""
    organization = models.OneToOneField(
        Organization, on_delete=models.CASCADE, related_name="storefront_settings"
    )
    data = models.JSONField(default=dict, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="updated_storefront_settings"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Storefront settings — {self.organization.name}"


class CommunicationTemplate(models.Model):
    class Channel(models.TextChoices):
        IN_APP = "In-app", "In-app"
        EMAIL = "Email", "Email"
        SMS = "SMS", "SMS"

    class TemplateStatus(models.TextChoices):
        ACTIVE = "Active", "Active"
        DRAFT = "Draft", "Draft"
        ARCHIVED = "Archived", "Archived"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="communication_templates"
    )
    name = models.CharField(max_length=100)
    channel = models.CharField(max_length=10, choices=Channel.choices, default=Channel.IN_APP)
    subject = models.CharField(max_length=160, blank=True)
    body = models.TextField(max_length=3000)
    category = models.CharField(max_length=30, default="General")
    status = models.CharField(max_length=10, choices=TemplateStatus.choices, default=TemplateStatus.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_communication_templates"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="updated_communication_templates"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [models.UniqueConstraint(fields=["organization", "name"], name="crm_comms_tpl_org_name_uniq")]

    def __str__(self):
        return self.name


class CommunicationLog(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="communication_logs"
    )
    subject = models.CharField(max_length=160)
    body = models.TextField(max_length=3000)
    channel = models.CharField(max_length=10, choices=CommunicationTemplate.Channel.choices)
    audience = models.CharField(max_length=160, default="All customers")
    audience_key = models.CharField(max_length=100, default="all")
    recipient_count = models.PositiveIntegerField(default=0)
    notification_type = models.CharField(max_length=20, default="general")
    status = models.CharField(max_length=50, default="Recorded (not sent)")
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    actor = models.CharField(max_length=254, blank=True)
    template = models.ForeignKey(
        CommunicationTemplate, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="logs"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_communication_logs"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "created_at"], name="crm_commlog_org_created_idx")]

    def __str__(self):
        return f"{self.channel}: {self.subject}"


class Notification(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="crm_notifications"
    )
    title = models.CharField(max_length=180)
    message = models.TextField(max_length=2000)
    notification_type = models.CharField(max_length=30, default="general")
    audience = models.CharField(max_length=20, default="crm")
    recipient_email = models.EmailField(blank=True)
    recipient_emails = models.JSONField(default=list, blank=True)
    recipient_role = models.CharField(max_length=30, blank=True)
    recipient_roles = models.JSONField(default=list, blank=True)
    link = models.CharField(max_length=500, blank=True)
    source = models.CharField(max_length=80, default="system")
    metadata = models.JSONField(default=dict, blank=True)
    read_by = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="read_crm_notifications"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_crm_notifications"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "created_at"], name="crm_notif_org_created_idx")]

    def __str__(self):
        return self.title


# ---------------------------------------------------------------------------
# Phase 24 — pseudonymous storefront behaviour events
# ---------------------------------------------------------------------------

class CustomerBehaviorEvent(models.Model):
    """Pseudonymous product/search journey event; deliberately stores no PII."""

    class EventType(models.TextChoices):
        PRODUCT_VIEW = "product_view", "Product view"
        SEARCH = "search", "Search"
        ADD_TO_CART = "add_to_cart", "Add to cart"
        WISHLIST_ADD = "wishlist_add", "Wishlist add"
        WISHLIST_REMOVE = "wishlist_remove", "Wishlist remove"
        CHECKOUT_STARTED = "checkout_started", "Checkout started"
        PURCHASE = "purchase", "Demo purchase"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="storefront_behavior_events"
    )
    event_id = models.CharField(max_length=100)
    visitor_id = models.CharField(max_length=100)
    session_id = models.CharField(max_length=100)
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    path = models.CharField(max_length=200, blank=True)
    previous_viewed_product_id = models.CharField(max_length=80, blank=True)
    previous_viewed_product_name = models.CharField(max_length=160, blank=True)
    product_id = models.CharField(max_length=80, blank=True)
    product_name = models.CharField(max_length=200, blank=True)
    product_category = models.CharField(max_length=80, blank=True)
    product_brand = models.CharField(max_length=80, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    query = models.CharField(max_length=120, blank=True)
    search_category = models.CharField(max_length=80, blank=True)
    result_count = models.PositiveIntegerField(default=0)
    matched_product_ids = models.JSONField(default=list, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    item_count = models.PositiveIntegerField(null=True, blank=True)
    order_id = models.CharField(max_length=80, blank=True)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    order_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "event_id"],
                name="crm_beh_org_event_uniq",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "event_type", "created_at"], name="crm_beh_org_type_created_idx"),
            models.Index(fields=["organization", "visitor_id", "session_id"], name="crm_beh_org_visitor_idx"),
        ]

    def __str__(self):
        return f"{self.event_type} · {self.event_id}"


# ---------------------------------------------------------------------------
# Phase 25 — storefront cart, wishlist, and moderated product reviews
# ---------------------------------------------------------------------------

class StorefrontCart(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="storefront_carts"
    )
    visitor_id = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "visitor_id"],
                name="crm_cart_org_visitor_uniq",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "updated_at"], name="crm_cart_org_updated_idx"),
        ]

    def __str__(self):
        return f"Cart {self.visitor_id[:12]} · {self.organization_id}"


class StorefrontCartItem(models.Model):
    cart = models.ForeignKey(StorefrontCart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="storefront_cart_items")
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "product"],
                name="crm_cart_item_product_uniq",
            )
        ]

    def __str__(self):
        return f"{self.quantity} × {self.product.name}"


class StorefrontWishlistItem(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="storefront_wishlist_items"
    )
    visitor_id = models.CharField(max_length=100)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="storefront_wishlist_items")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "visitor_id", "product"],
                name="crm_wish_org_visit_prod_uniq",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "visitor_id"], name="crm_wish_org_visitor_idx"),
        ]

    def __str__(self):
        return f"Wishlist {self.visitor_id[:12]} · {self.product.name}"


class ProductReview(models.Model):
    class ReviewStatus(models.TextChoices):
        PENDING = "PENDING", "Pending moderation"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="product_reviews"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="customer_reviews")
    visitor_id = models.CharField(max_length=100)
    reviewer_name = models.CharField(max_length=100)
    rating = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=120)
    comment = models.TextField(max_length=2000)
    status = models.CharField(max_length=12, choices=ReviewStatus.choices, default=ReviewStatus.PENDING)
    # No customer-authentication or order-verification flow exists yet, so public reviews are never marked verified.
    verified_purchase = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "product", "visitor_id"],
                name="crm_review_org_prod_visit_uniq",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "status", "created_at"], name="crm_review_org_status_idx"),
            models.Index(fields=["product", "status"], name="crm_review_product_status_idx"),
        ]

    def __str__(self):
        return f"{self.product.name} · {self.rating}/5 · {self.status}"


class StockMovement(models.Model):
    """Organization-scoped audit record for an explicit inventory adjustment."""

    class MovementType(models.TextChoices):
        ADJUSTMENT = "ADJUSTMENT", "Manual adjustment"
        RESTOCK = "RESTOCK", "Restock"
        DAMAGE = "DAMAGE", "Damaged / written off"
        RETURN = "RETURN", "Returned stock"
        COUNT_CORRECTION = "COUNT_CORRECTION", "Stock count correction"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="stock_movements"
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="stock_movements"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="stock_movements",
    )
    movement_type = models.CharField(max_length=20, choices=MovementType.choices)
    quantity_delta = models.IntegerField(help_text="Signed stock change: positive adds stock, negative removes stock.")
    stock_before = models.PositiveIntegerField()
    stock_after = models.PositiveIntegerField()
    reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"], name="crm_stock_org_created_idx"),
            models.Index(fields=["product", "created_at"], name="crm_stock_prod_created_idx"),
        ]

    def __str__(self):
        return f"{self.product.sku}: {self.quantity_delta:+d}"


class DiscountCoupon(models.Model):
    class DiscountType(models.TextChoices):
        PERCENT = "PERCENT", "Percentage"
        FIXED = "FIXED", "Fixed amount"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="discount_coupons"
    )
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=120)
    discount_type = models.CharField(max_length=8, choices=DiscountType.choices)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    min_order_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_discount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_discount_coupons",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"], name="crm_coupon_org_code_uniq"
            )
        ]
        indexes = [
            models.Index(fields=["organization", "is_active"], name="crm_coupon_org_active_idx"),
            models.Index(fields=["starts_at", "ends_at"], name="crm_coupon_dates_idx"),
        ]

    def __str__(self):
        return f"{self.code} ({self.name})"


class StorefrontCustomerProfile(models.Model):
    class Gender(models.TextChoices):
        UNSPECIFIED = "UNSPECIFIED", "Not specified"
        FEMALE = "FEMALE", "Female"
        MALE = "MALE", "Male"
        NON_BINARY = "NON_BINARY", "Non-binary"
        PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY", "Prefer not to say"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="storefront_profile"
    )
    profile_image = models.ImageField(upload_to="customer-profile-images/%Y/%m/", blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=24, choices=Gender.choices, default=Gender.UNSPECIFIED)
    email_updates = models.BooleanField(default=True)
    sms_updates = models.BooleanField(default=False)
    whatsapp_updates = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Storefront profile: {self.user.email}"


class StorefrontAddress(models.Model):
    class Label(models.TextChoices):
        HOME = "HOME", "Home"
        WORK = "WORK", "Work"
        OTHER = "OTHER", "Other"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="storefront_addresses"
    )
    label = models.CharField(max_length=12, choices=Label.choices, default=Label.HOME)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    address_line1 = models.CharField(max_length=250)
    address_line2 = models.CharField(max_length=250, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default="India")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_default", "-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user"], condition=models.Q(is_default=True), name="unique_default_storefront_address_per_user"
            ),
        ]
        indexes = [models.Index(fields=["user", "is_default"], name="crm_store_user_idx")]

    def __str__(self):
        return f"{self.full_name} - {self.city}"


class StorefrontSavedPaymentMethod(models.Model):
    """Customer-managed, non-chargeable payment display metadata.

    This table intentionally never stores full card numbers, CVV, bank passwords,
    provider payment tokens, or credentials that could authorize a charge.
    """
    class MethodType(models.TextChoices):
        CARD = "CARD", "Card"
        UPI = "UPI", "UPI"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_payment_methods",
    )
    method_type = models.CharField(max_length=8, choices=MethodType.choices)
    label = models.CharField(max_length=100)
    provider = models.CharField(max_length=80, blank=True)
    upi_id = models.CharField(max_length=150, blank=True)
    last_four = models.CharField(max_length=4, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_default", "-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user"], condition=models.Q(is_default=True),
                name="uniq_user_default_paymethod",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "is_default"], name="crm_paymethod_user_idx"),
        ]

    def __str__(self):
        return f"{self.label} ({self.method_type})"
