from django.contrib import admin

from .models import (
    Customer,
    Interaction,
    Order,
    Segment,
    Campaign,
    CampaignResponse,
    AuditLog,
    Category,
    Product,
    SupportTicket,
    SupportTicketMessage,
    Lead,
    Banner,
    HomepagePromotionSettings,
)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "first_name",
        "last_name",
        "email",
        "phone",
        "organization",
        "lifecycle_stage",
        "is_active",
        "created_at",
    )

    list_filter = (
        "organization",
        "lifecycle_stage",
        "is_active",
    )

    search_fields = (
        "first_name",
        "last_name",
        "email",
        "phone",
    )

    ordering = (
        "-created_at",
    )

@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "customer",
        "interaction_type",
        "subject",
        "created_by",
        "organization",
        "interaction_date",
        "created_at",
    )

    list_filter = (
        "interaction_type",
        "organization",
        "interaction_date",
    )

    search_fields = (
        "subject",
        "description",
        "customer__first_name",
        "customer__last_name",
        "customer__email",
    )

    ordering = (
        "-interaction_date",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "order_number",
        "customer",
        "amount",
        "status",
        "organization",
        "order_date",
        "created_at",
    )

    list_filter = (
        "status",
        "organization",
        "order_date",
    )

    search_fields = (
        "order_number",
        "customer__first_name",
        "customer__last_name",
        "customer__email",
    )

    ordering = (
        "-order_date",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

@admin.register(Segment)
class SegmentAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "name",
        "segment_type",
        "organization",
        "created_by",
        "is_active",
        "created_at",
    )

    list_filter = (
        "segment_type",
        "organization",
        "is_active",
    )

    search_fields = (
        "name",
        "description",
        "organization__name",
    )

    ordering = (
        "-created_at",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    filter_horizontal = (
        "customers",
    )

@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "name",
        "campaign_type",
        "status",
        "segment",
        "organization",
        "created_by",
        "scheduled_at",
        "created_at",
    )

    list_filter = (
        "campaign_type",
        "status",
        "organization",
        "scheduled_at",
    )

    search_fields = (
        "name",
        "description",
        "subject",
        "message",
        "segment__name",
    )

    ordering = (
        "-created_at",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "started_at",
        "completed_at",
    )

@admin.register(CampaignResponse)
class CampaignResponseAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "campaign",
        "customer",
        "status",
        "organization",
        "response_date",
        "created_at",
    )

    list_filter = (
        "status",
        "organization",
        "response_date",
    )

    search_fields = (
        "campaign__name",
        "customer__first_name",
        "customer__last_name",
        "customer__email",
    )

    ordering = (
        "-response_date",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
        "response_date",
    )
    
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "organization",
        "user",
        "action",
        "entity_type",
        "entity_id",
        "created_at",
    )

    list_filter = (
        "organization",
        "action",
        "entity_type",
        "created_at",
    )

    search_fields = (
        "entity_type",
        "entity_id",
        "description",
        "user__email",
    )

    readonly_fields = (
        "organization",
        "user",
        "action",
        "entity_type",
        "entity_id",
        "description",
        "ip_address",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "organization", "is_active", "created_at")
    list_filter = ("organization", "is_active")
    search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "sku", "category", "price", "stock", "status", "organization")
    list_filter = ("organization", "status", "category")
    search_fields = ("name", "sku", "brand")


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("ticket_code", "subject", "customer_email", "status", "priority", "assigned_to", "organization", "updated_at")
    list_filter = ("organization", "status", "priority", "category")
    search_fields = ("ticket_code", "subject", "customer_name", "customer_email", "order_id")
    readonly_fields = ("ticket_code", "created_at", "updated_at")


@admin.register(SupportTicketMessage)
class SupportTicketMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "author_name", "is_internal", "created_at")
    list_filter = ("is_internal", "created_at")
    search_fields = ("ticket__ticket_code", "author_name", "text")
    readonly_fields = ("created_at",)


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("lead_code", "name", "email", "status", "source", "assigned_to", "organization", "created_at")
    list_filter = ("organization", "status", "source")
    search_fields = ("lead_code", "name", "email", "phone", "company")
    readonly_fields = ("lead_code", "converted_customer", "converted_at", "created_at", "updated_at")


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "placement", "status", "start_date", "end_date", "impressions", "clicks", "organization")
    list_filter = ("organization", "placement", "status")
    search_fields = ("name", "title", "eyebrow")
    readonly_fields = ("impressions", "clicks", "created_at", "updated_at")


@admin.register(HomepagePromotionSettings)
class HomepagePromotionSettingsAdmin(admin.ModelAdmin):
    list_display = ("organization", "enabled", "selection_mode", "updated_by", "updated_at")
    list_filter = ("enabled", "selection_mode")
    readonly_fields = ("created_at", "updated_at")


# Phase 23 administration views
from .models import StorefrontSettings, CommunicationTemplate, CommunicationLog, Notification


@admin.register(StorefrontSettings)
class StorefrontSettingsAdmin(admin.ModelAdmin):
    list_display = ("organization", "updated_by", "updated_at")
    search_fields = ("organization__name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(CommunicationTemplate)
class CommunicationTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "channel", "category", "status", "organization", "updated_at")
    list_filter = ("organization", "channel", "category", "status")
    search_fields = ("name", "subject", "body")
    readonly_fields = ("created_at", "updated_at")


@admin.register(CommunicationLog)
class CommunicationLogAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "channel", "audience", "status", "recipient_count", "organization", "created_at")
    list_filter = ("organization", "channel", "status")
    search_fields = ("subject", "body", "actor")
    readonly_fields = ("created_at", "sent_at")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "notification_type", "audience", "organization", "created_at")
    list_filter = ("organization", "notification_type", "audience")
    search_fields = ("title", "message", "source")
    readonly_fields = ("created_at",)


# Phase 24 — anonymized storefront behaviour event audit
from .models import CustomerBehaviorEvent

@admin.register(CustomerBehaviorEvent)
class CustomerBehaviorEventAdmin(admin.ModelAdmin):
    list_display = ("created_at", "organization", "event_type", "product_name", "query", "visitor_id")
    list_filter = ("organization", "event_type", "created_at")
    search_fields = ("event_id", "product_name", "query", "visitor_id")
    readonly_fields = tuple(field.name for field in CustomerBehaviorEvent._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# Phase 25 storefront commerce data
from .models import StorefrontCart, StorefrontCartItem, StorefrontWishlistItem, ProductReview

@admin.register(StorefrontCart)
class StorefrontCartAdmin(admin.ModelAdmin):
    list_display = ("id", "organization", "visitor_id", "updated_at")
    list_filter = ("organization", "updated_at")
    search_fields = ("visitor_id",)
    readonly_fields = ("created_at", "updated_at")

@admin.register(StorefrontCartItem)
class StorefrontCartItemAdmin(admin.ModelAdmin):
    list_display = ("cart", "product", "quantity", "updated_at")
    search_fields = ("product__name", "cart__visitor_id")
    readonly_fields = ("created_at", "updated_at")

@admin.register(StorefrontWishlistItem)
class StorefrontWishlistItemAdmin(admin.ModelAdmin):
    list_display = ("organization", "visitor_id", "product", "created_at")
    list_filter = ("organization", "created_at")
    search_fields = ("visitor_id", "product__name")
    readonly_fields = ("created_at",)

@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ("product", "reviewer_name", "rating", "status", "verified_purchase", "created_at", "organization")
    list_filter = ("organization", "status", "rating", "created_at")
    search_fields = ("product__name", "reviewer_name", "title", "comment")
    readonly_fields = ("visitor_id", "verified_purchase", "created_at", "updated_at")


# Phase 26 inventory and discounts
from .models import StockMovement, DiscountCoupon

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "movement_type", "quantity_delta", "stock_before", "stock_after", "actor", "created_at", "organization")
    list_filter = ("organization", "movement_type", "created_at")
    search_fields = ("product__name", "product__sku", "reason", "actor__email")
    readonly_fields = ("organization", "product", "actor", "movement_type", "quantity_delta", "stock_before", "stock_after", "reason", "created_at")

@admin.register(DiscountCoupon)
class DiscountCouponAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "discount_type", "value", "is_active", "used_count", "usage_limit", "organization")
    list_filter = ("organization", "discount_type", "is_active")
    search_fields = ("code", "name")
    readonly_fields = ("used_count", "created_by", "created_at", "updated_at")


# Phase 27 order operations
from .models import OrderShipment, OrderReturnRequest, OrderActivityEvent

@admin.register(OrderShipment)
class OrderShipmentAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "carrier", "tracking_number", "status", "estimated_delivery", "organization", "created_at")
    list_filter = ("organization", "status", "carrier")
    search_fields = ("order__order_number", "tracking_number", "carrier")
    readonly_fields = ("created_by", "shipped_at", "delivered_at", "created_at", "updated_at")

@admin.register(OrderReturnRequest)
class OrderReturnRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "reason", "status", "requested_by", "reviewed_by", "organization", "created_at")
    list_filter = ("organization", "status", "reason")
    search_fields = ("order__order_number", "description", "resolution_note")
    readonly_fields = ("requested_by", "reviewed_by", "created_at", "updated_at")

@admin.register(OrderActivityEvent)
class OrderActivityEventAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "event_type", "created_by", "organization", "created_at")
    list_filter = ("organization", "event_type", "created_at")
    search_fields = ("order__order_number", "message", "created_by__email")
    readonly_fields = tuple(field.name for field in OrderActivityEvent._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


from .models import StorefrontCustomerProfile, StorefrontAddress

@admin.register(StorefrontCustomerProfile)
class StorefrontCustomerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "gender", "updated_at")
    search_fields = ("user__email", "user__first_name", "user__last_name", "phone")

@admin.register(StorefrontAddress)
class StorefrontAddressAdmin(admin.ModelAdmin):
    list_display = ("full_name", "user", "city", "state", "postal_code", "is_default")
    search_fields = ("user__email", "full_name", "city", "postal_code")
    list_filter = ("country", "state", "is_default")
