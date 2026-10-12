from django.urls import path
from .customer_profile_views import StorefrontCustomerProfileImageView
from .storefront_account_views import (
    StorefrontAddressDetailView,
    StorefrontAddressListCreateView,
    StorefrontCustomerProfileView,
    StorefrontSavedPaymentMethodListCreateView,
    StorefrontSavedPaymentMethodDetailView,
    StorefrontOrderListCreateView,
    StorefrontOrderDetailView,
    StorefrontLegacyOrderImportView,
    StorefrontSupportTicketListCreateView,
    StorefrontSupportTicketDetailView,
    StorefrontLegacySupportTicketImportView,
)

urlpatterns = [
    path("profile/", StorefrontCustomerProfileView.as_view(), name="storefront-customer-profile"),
    path("profile-image/", StorefrontCustomerProfileImageView.as_view(), name="storefront-customer-profile-image"),
    path("addresses/", StorefrontAddressListCreateView.as_view(), name="storefront-customer-address-list-create"),
    path("addresses/<int:pk>/", StorefrontAddressDetailView.as_view(), name="storefront-customer-address-detail"),
    path("payment-methods/", StorefrontSavedPaymentMethodListCreateView.as_view(), name="storefront-customer-payment-method-list-create"),
    path("payment-methods/<int:pk>/", StorefrontSavedPaymentMethodDetailView.as_view(), name="storefront-customer-payment-method-detail"),
    path("orders/", StorefrontOrderListCreateView.as_view(), name="storefront-customer-order-list-create"),
    path("orders/import-legacy/", StorefrontLegacyOrderImportView.as_view(), name="storefront-customer-order-legacy-import"),
    path("orders/<str:order_number>/", StorefrontOrderDetailView.as_view(), name="storefront-customer-order-detail"),
    path("support-tickets/", StorefrontSupportTicketListCreateView.as_view(), name="storefront-customer-support-list-create"),
    path("support-tickets/import-legacy/", StorefrontLegacySupportTicketImportView.as_view(), name="storefront-customer-support-legacy-import"),
    path("support-tickets/<str:ticket_code>/", StorefrontSupportTicketDetailView.as_view(), name="storefront-customer-support-detail"),
    path("support-tickets/<str:ticket_code>/messages/", StorefrontSupportTicketDetailView.as_view(), name="storefront-customer-support-messages"),
]
