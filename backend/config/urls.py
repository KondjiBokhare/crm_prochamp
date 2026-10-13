from django.contrib import admin
from django.urls import include, path
from crm.views import (StorefrontCartView, StorefrontWishlistView, StorefrontProductReviewsView, StorefrontProductListView, StorefrontCategoryListView, StorefrontBannerListView, StorefrontBannerMetricView, StorefrontHomepagePromotionSettingsView, StorefrontPublicSettingsView, StorefrontBehaviorEventView, StorefrontRecommendationsView, Phase26StorefrontCouponValidationView)

urlpatterns = [
    path("api/storefront/cart/", StorefrontCartView.as_view(), name="storefront-cart"),
    path("api/storefront/coupons/validate/", Phase26StorefrontCouponValidationView.as_view(), name="storefront-coupon-validate"),
    path("api/storefront/wishlist/", StorefrontWishlistView.as_view(), name="storefront-wishlist"),
    path("api/storefront/products/<int:product_id>/reviews/", StorefrontProductReviewsView.as_view(), name="storefront-product-reviews"),
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/storefront/account/", include("crm.storefront_account_urls")),
    path("api/crm/", include("crm.urls")),
    path("api/storefront/products/", StorefrontProductListView.as_view(), name="storefront-products"),
    path("api/storefront/categories/", StorefrontCategoryListView.as_view(), name="storefront-categories"),
    path("api/storefront/banners/", StorefrontBannerListView.as_view(), name="storefront-banners"),
    path("api/storefront/banners/<int:pk>/<str:metric>/", StorefrontBannerMetricView.as_view(), name="storefront-banner-metric"),
    path("api/storefront/homepage-promotions/", StorefrontHomepagePromotionSettingsView.as_view(), name="storefront-homepage-promotions"),
    path("api/storefront/settings/", StorefrontPublicSettingsView.as_view(), name="storefront-settings-public"),
    path("api/storefront/behavior-events/", StorefrontBehaviorEventView.as_view(), name="storefront-behavior-event"),
    path("api/storefront/recommendations/", StorefrontRecommendationsView.as_view(), name="storefront-recommendations"),
]
