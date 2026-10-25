"""CRM routes, grouped by functional area.

`urlpatterns` is included at `/api/crm/`; `storefront_urlpatterns` is included
at `/api/storefront/account/` by the project URL configuration.
"""

from django.urls import path

from . import views


# Tenant CRM: customer records, interactions, orders, campaigns, reporting.
urlpatterns = [
    path("customers/", views.CustomerListCreateView.as_view(), name="customer-list-create"),
    path("customers/<int:pk>/", views.CustomerDetailView.as_view(), name="customer-detail"),
    path("customers/<int:customer_id>/profile-overview/", views.CustomerProfileOverviewView.as_view(), name="customer-profile-overview"),
    path("customers/<int:customer_id>/profile-image/", views.CustomerProfileImageView.as_view(), name="customer-profile-image"),
    path("interactions/", views.InteractionListCreateView.as_view(), name="interaction-list-create"),
    path("interactions/<int:pk>/", views.InteractionDetailView.as_view(), name="interaction-detail"),
    path("orders/", views.OrderListCreateView.as_view(), name="order-list-create"),
    path("orders/<str:order_number>/", views.OrderDetailView.as_view(), name="order-detail"),
    path("shipments/", views.OrderShipmentListCreateView.as_view(), name="order-shipment-list-create"),
    path("shipments/<int:pk>/", views.OrderShipmentDetailView.as_view(), name="order-shipment-detail"),
    path("returns/", views.OrderReturnRequestListCreateView.as_view(), name="order-return-list-create"),
    path("returns/<int:pk>/status/", views.OrderReturnRequestStatusView.as_view(), name="order-return-status"),
    path("order-activity/", views.OrderActivityListCreateView.as_view(), name="order-activity-list-create"),
    path("segments/", views.SegmentListCreateView.as_view(), name="segment-list-create"),
    path("segments/<int:pk>/", views.SegmentDetailView.as_view(), name="segment-detail"),
    path("segments/<int:pk>/preview/", views.SegmentPreviewView.as_view(), name="segment-preview"),
    path("campaigns/", views.CampaignListCreateView.as_view(), name="campaign-list-create"),
    path("campaigns/<int:pk>/", views.CampaignDetailView.as_view(), name="campaign-detail"),
    path("campaign-responses/", views.CampaignResponseListCreateView.as_view(), name="campaign-response-list-create"),
    path("campaign-responses/<int:pk>/", views.CampaignResponseDetailView.as_view(), name="campaign-response-detail"),
    path("analytics/", views.AnalyticsView.as_view(), name="analytics"),
    path("audit-logs/", views.AuditLogListView.as_view(), name="audit-log-list"),

    # Catalogue and inventory. GET product routes are public; writes are Management-only.
    path("categories/", views.CategoryListCreateView.as_view(), name="category-list-create"),
    path("categories/<int:pk>/status/", views.CategoryStatusView.as_view(), name="category-status"),
    path("products/", views.ProductListCreateView.as_view(), name="product-list-create"),
    path("products/<int:pk>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("products/<int:pk>/status/", views.ProductStatusView.as_view(), name="product-status"),
    path("inventory/movements/", views.InventoryMovementsView.as_view(), name="inventory-movements"),
    path("coupons/", views.DiscountCouponListCreateView.as_view(), name="discount-coupon-list-create"),
    path("coupons/<int:pk>/", views.DiscountCouponDetailView.as_view(), name="discount-coupon-detail"),
    path("abandoned-carts/", views.AbandonedCartListView.as_view(), name="abandoned-cart-list"),
    path("product-reviews/", views.CRMProductReviewListView.as_view(), name="product-review-list"),
    path("product-reviews/<int:pk>/status/", views.CRMProductReviewStatusView.as_view(), name="product-review-status"),

    # Support, lead management, marketing, communications, and notifications.
    path("support-tickets/", views.SupportTicketListCreateView.as_view(), name="support-ticket-list-create"),
    path("support-tickets/<str:ticket_id>/", views.SupportTicketDetailView.as_view(), name="support-ticket-detail"),
    path("support-tickets/<str:ticket_id>/messages/", views.SupportTicketMessagesView.as_view(), name="support-ticket-messages"),
    path("leads/", views.LeadListCreateView.as_view(), name="lead-list-create"),
    path("leads/<str:lead_id>/", views.LeadDetailView.as_view(), name="lead-detail"),
    path("leads/<str:lead_id>/follow-ups/", views.LeadFollowUpView.as_view(), name="lead-follow-ups"),
    path("leads/<str:lead_id>/convert/", views.LeadConvertView.as_view(), name="lead-convert"),
    path("banners/", views.BannerListCreateView.as_view(), name="banner-list-create"),
    path("banners/<int:pk>/", views.BannerDetailView.as_view(), name="banner-detail"),
    path("banners/<int:pk>/status/", views.BannerStatusView.as_view(), name="banner-status"),
    path("homepage-promotions/", views.HomepagePromotionSettingsView.as_view(), name="homepage-promotion-settings"),
    path("storefront-settings/", views.CrmSettingsView.as_view(), name="storefront-settings"),
    path("communication-templates/", views.CommunicationTemplateListCreateView.as_view(), name="communication-template-list-create"),
    path("communication-templates/<int:pk>/", views.CommunicationTemplateDetailView.as_view(), name="communication-template-detail"),
    path("communications/history/", views.CommunicationHistoryListView.as_view(), name="communication-history"),
    path("communications/dispatch/", views.CommunicationDispatchView.as_view(), name="communication-dispatch"),
    path("notifications/", views.NotificationListCreateView.as_view(), name="notification-list-create"),
    path("notifications/read-all/", views.NotificationReadAllView.as_view(), name="notification-read-all"),
    path("notifications/<int:pk>/read/", views.NotificationReadView.as_view(), name="notification-read"),
    path("behavior-analytics/", views.CustomerBehaviorAnalyticsView.as_view(), name="behavior-analytics"),

]


# Public storefront APIs.  These are included at `/api/storefront/`.
storefront_public_urlpatterns = [
    path("cart/", views.CrmCartView.as_view(), name="storefront-cart"),
    path("coupons/validate/", views.CrmCouponValidationView.as_view(), name="storefront-coupon-validate"),
    path("wishlist/", views.CrmWishlistView.as_view(), name="storefront-wishlist"),
    path("products/<int:product_id>/reviews/", views.CrmProductReviewsView.as_view(), name="storefront-product-reviews"),
    path("products/", views.CrmProductListView.as_view(), name="storefront-products"),
    path("categories/", views.CrmCategoryListView.as_view(), name="storefront-categories"),
    path("banners/", views.CrmBannerListView.as_view(), name="storefront-banners"),
    path("banners/<int:pk>/<str:metric>/", views.CrmBannerMetricView.as_view(), name="storefront-banner-metric"),
    path("homepage-promotions/", views.CrmHomepagePromotionSettingsView.as_view(), name="storefront-homepage-promotions"),
    path("settings/", views.CrmPublicSettingsView.as_view(), name="storefront-settings-public"),
    path("behavior-events/", views.CrmBehaviorEventView.as_view(), name="storefront-behavior-event"),
    path("recommendations/", views.CrmRecommendationsView.as_view(), name="storefront-recommendations"),
]


# Signed-in customer account APIs.  These are included at
# `/api/storefront/account/`.
storefront_account_urlpatterns = [
    path("summary/", views.StorefrontCustomerSummaryView.as_view(), name="storefront-customer-summary", ),
    path("profile/", views.StorefrontCustomerProfileView.as_view(), name="storefront-customer-profile"),

    path("profile-image/", views.StorefrontCustomerProfileImageView.as_view(), name="storefront-customer-profile-image"),
    path("addresses/", views.StorefrontAddressListCreateView.as_view(), name="storefront-customer-address-list-create"),
    path("addresses/<int:pk>/", views.StorefrontAddressDetailView.as_view(), name="storefront-customer-address-detail"),
    path("payment-methods/", views.StorefrontSavedPaymentMethodListCreateView.as_view(), name="storefront-customer-payment-method-list-create"),
    path("payment-methods/<int:pk>/", views.StorefrontSavedPaymentMethodDetailView.as_view(), name="storefront-customer-payment-method-detail"),
    path("orders/", views.StorefrontOrderListCreateView.as_view(), name="storefront-customer-order-list-create"),
    path("orders/import-legacy/", views.StorefrontLegacyOrderImportView.as_view(), name="storefront-customer-order-legacy-import"),
    path("orders/<str:order_number>/", views.StorefrontOrderDetailView.as_view(), name="storefront-customer-order-detail"),
    path("support-tickets/", views.StorefrontSupportTicketListCreateView.as_view(), name="storefront-customer-support-list-create"),
    path("support-tickets/import-legacy/", views.StorefrontLegacySupportTicketImportView.as_view(), name="storefront-customer-support-legacy-import"),
    path("support-tickets/<str:ticket_code>/", views.StorefrontSupportTicketDetailView.as_view(), name="storefront-customer-support-detail"),
    path("support-tickets/<str:ticket_code>/messages/", views.StorefrontSupportTicketDetailView.as_view(), name="storefront-customer-support-messages"),
]

# Compatibility name for callers that previously imported this module's
# storefront URL list directly.
storefront_urlpatterns = storefront_account_urlpatterns
