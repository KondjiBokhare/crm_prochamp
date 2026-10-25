from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated

from .models import AuditLog, Customer, CrmAddress, CrmCustomerProfile, CrmSavedPaymentMethod
from .storefront_utils import ensure_storefront_customer, get_storefront_organization

User = get_user_model()


def _audit_storefront_action(request, action, entity_type, entity_id, description, organization=None):
    """Write a minimal customer activity record without logging raw personal data."""
    if organization is None:
        organization = getattr(request.user, "organization", None)
    if organization is None:
        directory_customer = Customer.objects.filter(email__iexact=getattr(request.user, "email", "")).select_related("organization").first()
        organization = directory_customer.organization if directory_customer else None
    if organization is None:
        organization = get_storefront_organization()
    if organization is None:
        return
    AuditLog.objects.create(
        organization=organization,
        user=request.user if getattr(request.user, "is_authenticated", False) else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id or ""),
        description=description[:2000],
        ip_address=getattr(getattr(request, "META", {}), "get", lambda *_: None)("REMOTE_ADDR"),
    )


class IsStorefrontCustomer(IsAuthenticated):
    """Only real storefront customer accounts may access their account APIs."""

    def has_permission(self, request, view):
        return bool(
            super().has_permission(request, view)
            and getattr(request.user, "role", None) == "CUSTOMER"
            and getattr(request.user, "is_active", False)
        )


class StorefrontCustomerProfileSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="user.first_name", max_length=150)
    last_name = serializers.CharField(source="user.last_name", max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = CrmCustomerProfile
        fields = [
            "id", "first_name", "last_name", "email", "phone", "date_of_birth",
            "gender", "email_updates", "sms_updates", "whatsapp_updates",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "email", "created_at", "updated_at"]

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        with transaction.atomic():
            user_changed = False
            for field, value in user_data.items():
                setattr(instance.user, field, value)
                user_changed = True
            if user_changed:
                instance.user.save()

            profile = super().update(instance, validated_data)

            # The CRM directory is a separate table. Sync identity/phone fields and
            # create the directory row if this older account did not have one yet.
            directory_customer = ensure_storefront_customer(profile.user)
            request = self.context.get("request")
            if request:
                _audit_storefront_action(
                    request, "UPDATE", "StorefrontCustomerProfile", profile.pk,
                    "Customer saved personal details or communication preferences.",
                    organization=getattr(directory_customer, "organization", None),
                )
            return profile


class StorefrontAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrmAddress
        fields = [
            "id", "label", "full_name", "phone", "address_line1", "address_line2",
            "city", "state", "postal_code", "country", "is_default", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError("A signed-in customer account is required.")
        postal_code = str(attrs.get("postal_code", getattr(self.instance, "postal_code", ""))).strip()
        if len(postal_code) < 3:
            raise serializers.ValidationError({"postal_code": "Enter a valid postal or ZIP code."})
        return attrs


class StorefrontCustomerProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = StorefrontCustomerProfileSerializer
    permission_classes = [IsStorefrontCustomer]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        profile, _ = CrmCustomerProfile.objects.get_or_create(user=self.request.user)
        return profile


class StorefrontAddressListCreateView(generics.ListCreateAPIView):
    serializer_class = StorefrontAddressSerializer
    permission_classes = [IsStorefrontCustomer]

    def get_queryset(self):
        return CrmAddress.objects.filter(user=self.request.user).order_by("-is_default", "-updated_at")

    @transaction.atomic
    def perform_create(self, serializer):
        make_default = bool(serializer.validated_data.get("is_default")) or not self.get_queryset().exists()
        if make_default:
            self.get_queryset().update(is_default=False)
        address = serializer.save(user=self.request.user, is_default=make_default)
        _audit_storefront_action(
            self.request, "CREATE", "StorefrontAddress", address.pk,
            f"Customer saved a {address.get_label_display().lower()} address.",
        )


class StorefrontAddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StorefrontAddressSerializer
    permission_classes = [IsStorefrontCustomer]

    def get_queryset(self):
        return CrmAddress.objects.filter(user=self.request.user)

    @transaction.atomic
    def perform_update(self, serializer):
        make_default = bool(serializer.validated_data.get("is_default", serializer.instance.is_default))
        if make_default:
            self.get_queryset().exclude(pk=serializer.instance.pk).update(is_default=False)
        address = serializer.save(is_default=make_default)
        _audit_storefront_action(
            self.request, "UPDATE", "StorefrontAddress", address.pk,
            f"Customer updated a saved {address.get_label_display().lower()} address.",
        )

    def perform_destroy(self, instance):
        _audit_storefront_action(
            self.request, "DELETE", "StorefrontAddress", instance.pk,
            f"Customer removed a saved {instance.get_label_display().lower()} address.",
        )
        was_default = instance.is_default
        user = instance.user
        instance.delete()
        if was_default:
            next_address = CrmAddress.objects.filter(user=user).first()
            if next_address:
                next_address.is_default = True
                next_address.save(update_fields=["is_default", "updated_at"])


class StorefrontSavedPaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrmSavedPaymentMethod
        fields = [
            "id", "method_type", "label", "provider", "upi_id", "last_four",
            "is_default", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        instance = self.instance
        method_type = attrs.get("method_type", getattr(instance, "method_type", None))
        upi_id = str(attrs.get("upi_id", getattr(instance, "upi_id", "")) or "").strip()
        last_four = str(attrs.get("last_four", getattr(instance, "last_four", "")) or "").strip()
        if method_type == CrmSavedPaymentMethod.MethodType.CARD:
            if not (len(last_four) == 4 and last_four.isdigit()):
                raise serializers.ValidationError({"last_four": "For safety, save only the card's last four digits."})
            if upi_id:
                raise serializers.ValidationError({"upi_id": "Do not enter a UPI ID for a card."})
        elif method_type == CrmSavedPaymentMethod.MethodType.UPI:
            import re
            if not re.fullmatch(r"[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,60}", upi_id):
                raise serializers.ValidationError({"upi_id": "Enter a valid UPI ID, such as name@provider."})
            if last_four:
                raise serializers.ValidationError({"last_four": "Card last-four digits do not apply to UPI."})
        else:
            raise serializers.ValidationError({"method_type": "Choose Card or UPI."})
        attrs["upi_id"] = upi_id if method_type == CrmSavedPaymentMethod.MethodType.UPI else ""
        attrs["last_four"] = last_four if method_type == CrmSavedPaymentMethod.MethodType.CARD else ""
        label = str(attrs.get("label", getattr(instance, "label", "")) or "").strip()
        if not label:
            raise serializers.ValidationError({"label": "Provide a display name for this payment method."})
        attrs["label"] = label[:100]
        attrs["provider"] = str(attrs.get("provider", getattr(instance, "provider", "")) or "").strip()[:80]
        return attrs


class StorefrontSavedPaymentMethodListCreateView(generics.ListCreateAPIView):
    serializer_class = StorefrontSavedPaymentMethodSerializer
    permission_classes = [IsStorefrontCustomer]

    def get_queryset(self):
        return CrmSavedPaymentMethod.objects.filter(user=self.request.user).order_by("-is_default", "-updated_at")

    @transaction.atomic
    def perform_create(self, serializer):
        current = self.get_queryset()
        make_default = bool(serializer.validated_data.get("is_default")) or not current.exists()
        if make_default:
            current.update(is_default=False)
        method = serializer.save(user=self.request.user, is_default=make_default)
        _audit_storefront_action(
            self.request, "CREATE", "CrmSavedPaymentMethod", method.pk,
            f"Customer saved payment method metadata ({method.method_type}).",
        )


class StorefrontSavedPaymentMethodDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = StorefrontSavedPaymentMethodSerializer
    permission_classes = [IsStorefrontCustomer]
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return CrmSavedPaymentMethod.objects.filter(user=self.request.user)

    @transaction.atomic
    def perform_update(self, serializer):
        current = serializer.instance
        make_default = bool(serializer.validated_data.get("is_default", current.is_default))
        if make_default:
            self.get_queryset().exclude(pk=current.pk).update(is_default=False)
        method = serializer.save(is_default=make_default)
        _audit_storefront_action(
            self.request, "UPDATE", "CrmSavedPaymentMethod", method.pk,
            f"Customer updated saved payment method metadata ({method.method_type}).",
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        was_default = instance.is_default
        user = instance.user
        _audit_storefront_action(
            self.request, "DELETE", "CrmSavedPaymentMethod", instance.pk,
            f"Customer removed saved payment method metadata ({instance.method_type}).",
        )
        instance.delete()
        if was_default:
            next_method = CrmSavedPaymentMethod.objects.filter(user=user).first()
            if next_method:
                next_method.is_default = True
                next_method.save(update_fields=["is_default", "updated_at"])

# ---------------------------------------------------------------------------
# Shared storefront orders and customer support tickets
# ---------------------------------------------------------------------------
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import re
import uuid

from django.db.models import Avg, Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .models import (
    CrmWishlistItem,
    DiscountCoupon,
    Order,
    Product,
    ProductReview,
    SupportTicket,
    SupportTicketMessage,
)
from .serializers import OrderSerializer, SupportTicketSerializer, SupportTicketMessageSerializer
from .storefront_utils import ensure_storefront_customer, get_storefront_organization

_MONEY_QUANT = Decimal("0.01")

def _money(value):
    return Decimal(str(value)).quantize(_MONEY_QUANT, rounding=ROUND_HALF_UP)


def _storefront_customer_context(request):
    organization = get_storefront_organization()
    if organization is None:
        raise ValidationError({"detail": "The storefront organization is not configured. Set STOREFRONT_ORGANIZATION_ID or create an active catalogue category."})
    if request.user.organization_id not in (None, organization.pk):
        raise PermissionDenied("This customer account belongs to a different organization than the public storefront.")
    customer = ensure_storefront_customer(request.user, organization)
    if customer is None:
        raise PermissionDenied("The customer account could not be linked to the storefront CRM organization.")
    return organization, customer


class StorefrontCustomerSummaryView(APIView):
    permission_classes = [IsStorefrontCustomer]

    def get(self, request):
        organization, customer = _storefront_customer_context(request)

        # Orders belonging to the currently signed-in customer.
        orders = (
            Order.objects.filter(organization=organization)
            .filter(
                Q(source_user=request.user) | Q(customer=customer)
            )
            .distinct()
        )

        total_orders = orders.count()

        # Membership is based on delivered orders, not unpaid demo orders.
        delivered_orders = orders.filter(
            status=Order.OrderStatus.DELIVERED
        ).count()

        # Starter membership rules:
        # 0 delivered = New Member
        # 1-2 = Bronze, 3-4 = Silver,
        # 5-9 = Gold, 10+ = Platinum
        if delivered_orders >= 10:
            member_tier = "Platinum"
        elif delivered_orders >= 5:
            member_tier = "Gold"
        elif delivered_orders >= 3:
            member_tier = "Silver"
        elif delivered_orders >= 1:
            member_tier = "Bronze"
        else:
            member_tier = "New Member"

        # Wishlist and submitted reviews currently use a browser visitor ID.
        visitor_id = str(
            request.query_params.get("visitor_id") or ""
        ).strip()

        if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", visitor_id):
            visitor_id = ""

        wishlist_items = 0
        average_rating = None
        review_count = 0

        if visitor_id:
            wishlist_items = CrmWishlistItem.objects.filter(
                organization=organization,
                visitor_id=visitor_id,
                product__status="Active",
                product__category__is_active=True,
            ).count()

            review_stats = ProductReview.objects.filter(
                organization=organization,
                visitor_id=visitor_id,
            ).aggregate(
                average=Avg("rating"),
                count=Count("id"),
            )

            average = review_stats["average"]
            average_rating = (
                round(float(average), 1)
                if average is not None
                else None
            )
            review_count = int(review_stats["count"] or 0)

        return Response({
            "totalOrders": total_orders,
            "wishlistItems": wishlist_items,
            "averageRating": average_rating,
            "reviewCount": review_count,
            "memberTier": member_tier,
        })


def _storefront_order_payload(order):
    return OrderSerializer(order).data


def _storefront_ticket_payload(ticket):
    data = dict(SupportTicketSerializer(ticket).data)
    # Never expose staff-only internal notes in a customer-facing endpoint.
    data["messages"] = SupportTicketMessageSerializer(
        ticket.messages.filter(is_internal=False).order_by("created_at"), many=True
    ).data
    data["internalNotes"] = []
    return data


def _legacy_order_details(raw):
    """Sanitize a browser-local demo order snapshot for one-time migration only."""
    raw_items = raw.get("items") if isinstance(raw.get("items"), list) else []
    items = []
    for item in raw_items[:100]:
        if not isinstance(item, dict):
            continue
        try:
            price = max(Decimal("0"), _money(item.get("price", 0)))
            mrp = max(price, _money(item.get("mrp", price)))
            quantity = int(item.get("quantity", 1))
        except (ValueError, TypeError, ArithmeticError):
            continue
        if quantity < 1 or quantity > 100:
            continue
        images = item.get("images") if isinstance(item.get("images"), list) else []
        items.append({
            "id": item.get("id"),
            "sku": str(item.get("sku") or "")[:64],
            "name": str(item.get("name") or "Product")[:200],
            "specs": str(item.get("specs") or item.get("shortDescription") or "")[:1000],
            "shortDescription": str(item.get("shortDescription") or item.get("specs") or "")[:1000],
            "image": str(item.get("image") or (images[0] if images else ""))[:2000],
            "images": [str(image)[:2000] for image in images[:5]],
            "price": float(price),
            "mrp": float(mrp),
            "quantity": quantity,
        })
    address_raw = raw.get("address") if isinstance(raw.get("address"), dict) else {}
    address = {
        key: str(address_raw.get(key) or "")[:250]
        for key in ("name", "phone", "line", "line2", "city", "state", "postal_code", "country", "type")
    }
    total = _money(raw.get("total", 0))
    if total < 0 or total > Decimal("9999999999.99"):
        raise ValidationError({"orders": "Legacy order total is outside the accepted range."})
    subtotal = _money(raw.get("subtotal", total))
    discount = _money(raw.get("discount", 0))
    coupon_discount = _money(raw.get("couponDiscount", 0))
    delivery = _money(raw.get("delivery", 0))
    return {
        "items": items,
        "address": address,
        "paymentMethod": str(raw.get("paymentMethod") or "Unknown")[:40],
        "paymentStatus": "Demo only — no payment processed",
        "subtotal": float(subtotal),
        "discount": float(discount),
        "couponDiscount": float(coupon_discount),
        "couponCode": str(raw.get("couponCode") or "")[:32],
        "delivery": float(delivery),
        "total": float(total),
        "demoOnly": True,
        "legacyImported": True,
        "source": "legacy-browser-demo",
    }, total


class StorefrontOrderListCreateView(APIView):
    permission_classes = [IsStorefrontCustomer]

    def get_queryset(self):
        organization, customer = _storefront_customer_context(self.request)
        return Order.objects.filter(organization=organization).filter(
            Q(source_user=self.request.user) | Q(customer=customer)
        ).select_related("customer").order_by("-order_date", "-id").distinct()

    def get(self, request):
        orders = self.get_queryset()
        return Response([_storefront_order_payload(order) for order in orders])

    @transaction.atomic
    def post(self, request):
        organization, customer = _storefront_customer_context(request)
        raw_items = request.data.get("items")
        if not isinstance(raw_items, list) or not raw_items or len(raw_items) > 50:
            raise ValidationError({"items": "Add between 1 and 50 products to the cart."})

        address_raw = request.data.get("address")
        if not isinstance(address_raw, dict):
            raise ValidationError({"address": "A delivery address is required."})
        address = {key: str(address_raw.get(key) or "").strip()[:250] for key in ("name", "phone", "line", "city", "type", "state", "postal_code", "country")}
        if not address["name"] or not address["phone"] or not address["line"] or not address["city"]:
            raise ValidationError({"address": "Name, phone, address line and city are required."})

        seen = set()
        items = []
        list_subtotal = Decimal("0.00")
        item_payable = Decimal("0.00")
        for row in raw_items:
            if not isinstance(row, dict):
                raise ValidationError({"items": "Each cart entry must be an object."})
            try:
                product_id = int(row.get("id", row.get("product_id")))
                quantity = int(row.get("quantity", 1))
            except (TypeError, ValueError):
                raise ValidationError({"items": "Every cart item needs a valid product ID and quantity."})
            if product_id in seen:
                raise ValidationError({"items": "A product appears more than once in the cart."})
            seen.add(product_id)
            if quantity < 1 or quantity > 100:
                raise ValidationError({"items": "Product quantity must be from 1 to 100."})
            product = Product.objects.select_for_update().filter(
                pk=product_id,
                organization=organization,
                status=Product.ProductStatus.ACTIVE,
                category__is_active=True,
                category__organization=organization,
            ).first()
            if product is None:
                raise ValidationError({"items": f"Product {product_id} is no longer available. Refresh your cart."})
            if product.stock < quantity:
                raise ValidationError({"items": f"Only {product.stock} unit(s) of {product.name} are currently available."})
            price = _money(product.price)
            mrp = max(price, _money(product.mrp if product.mrp is not None else price))
            list_subtotal += mrp * quantity
            item_payable += price * quantity
            images = product.images if isinstance(product.images, list) else []
            items.append({
                "id": product.pk,
                "sku": product.sku,
                "name": product.name,
                "specs": product.specs or product.short_description,
                "shortDescription": product.short_description or product.specs,
                "image": images[0] if images else "",
                "images": images[:5],
                "price": float(price),
                "mrp": float(mrp),
                "quantity": quantity,
            })
        list_subtotal = _money(list_subtotal)
        item_payable = _money(item_payable)
        discount = max(Decimal("0.00"), _money(list_subtotal - item_payable))
        delivery = Decimal("0.00") if item_payable >= Decimal("500.00") else Decimal("99.00")

        coupon_code = str(request.data.get("coupon_code") or "").strip().upper()
        coupon_discount = Decimal("0.00")
        coupon = None
        if coupon_code:
            coupon = DiscountCoupon.objects.select_for_update().filter(
                organization=organization, code__iexact=coupon_code
            ).first()
            now = timezone.now()
            if coupon is None or not coupon.is_active:
                raise ValidationError({"coupon_code": "This coupon is unavailable or inactive."})
            if coupon.starts_at and now < coupon.starts_at:
                raise ValidationError({"coupon_code": "This coupon is not active yet."})
            if coupon.ends_at and now > coupon.ends_at:
                raise ValidationError({"coupon_code": "This coupon has expired."})
            if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
                raise ValidationError({"coupon_code": "This coupon has reached its usage limit."})
            if item_payable < coupon.min_order_value:
                raise ValidationError({"coupon_code": f"This coupon needs a minimum cart value of ₹{coupon.min_order_value}."})
            raw_discount = item_payable * coupon.value / Decimal("100") if coupon.discount_type == DiscountCoupon.DiscountType.PERCENT else coupon.value
            if coupon.discount_type == DiscountCoupon.DiscountType.PERCENT and coupon.max_discount is not None:
                raw_discount = min(raw_discount, coupon.max_discount)
            coupon_discount = min(item_payable, _money(raw_discount))

        total = max(Decimal("0.00"), _money(item_payable + delivery - coupon_discount))
        payment_method = str(request.data.get("payment_method") or "Unknown").strip()[:40]
        payment_status = "Pay on delivery" if payment_method.lower() == "cash on delivery" else "Not processed — demo checkout"
        now = timezone.now()
        order_number = f"TG-{now:%y%m%d}-{uuid.uuid4().hex[:7].upper()}"
        details = {
            "items": items,
            "address": address,
            "paymentMethod": payment_method,
            "paymentStatus": payment_status,
            "subtotal": float(list_subtotal),
            "discount": float(discount),
            "couponDiscount": float(coupon_discount),
            "couponCode": coupon.code if coupon else "",
            "delivery": float(delivery),
            "total": float(total),
            "demoOnly": False,
            "legacyImported": False,
            "source": "storefront-api",
        }
        order = Order.objects.create(
            organization=organization,
            customer=customer,
            source_user=request.user,
            order_number=order_number,
            amount=total,
            status=Order.OrderStatus.PROCESSING,
            order_date=now,
            crm_data=details,
        )
        if coupon is not None:
            coupon.used_count += 1
            coupon.save(update_fields=["used_count", "updated_at"])
        _audit_storefront_action(
            request, "CREATE", "Order", order.pk,
            f"Customer placed storefront order {order.order_number}.", organization=organization,
        )
        return Response(_storefront_order_payload(order), status=status.HTTP_201_CREATED)


class StorefrontOrderDetailView(APIView):
    permission_classes = [IsStorefrontCustomer]

    def get(self, request, order_number):
        organization, customer = _storefront_customer_context(request)
        order = get_object_or_404(
            Order.objects.filter(organization=organization).filter(
                Q(source_user=request.user) | Q(customer=customer)
            ),
            order_number=order_number,
        )
        return Response(_storefront_order_payload(order))


class StorefrontLegacyOrderImportView(APIView):
    """One-time, authenticated import for older browser-local demo orders."""
    permission_classes = [IsStorefrontCustomer]

    @transaction.atomic
    def post(self, request):
        organization, customer = _storefront_customer_context(request)
        rows = request.data.get("orders")
        if not isinstance(rows, list) or len(rows) > 100:
            raise ValidationError({"orders": "Provide an array containing no more than 100 legacy orders."})
        created = 0
        duplicates = 0
        skipped = 0
        for raw in rows:
            if not isinstance(raw, dict):
                skipped += 1
                continue
            legacy_email = str(raw.get("customerEmail") or raw.get("customer_email") or "").strip().lower()
            if legacy_email and legacy_email != request.user.email.strip().lower():
                skipped += 1
                continue
            legacy_id = re.sub(r"[^A-Za-z0-9_-]", "", str(raw.get("id") or raw.get("order_number") or ""))[:50]
            if not legacy_id:
                skipped += 1
                continue
            existing = Order.objects.filter(organization=organization, order_number=legacy_id).first()
            if existing:
                if existing.customer_id == customer.pk and (existing.source_user_id in (None, request.user.pk)):
                    if existing.source_user_id is None:
                        existing.source_user = request.user
                        existing.save(update_fields=["source_user"])
                    duplicates += 1
                else:
                    skipped += 1
                continue
            details, total = _legacy_order_details(raw)
            status_raw = str(raw.get("fulfillmentStatus") or raw.get("status") or "PROCESSING").upper()
            if "CANCEL" in status_raw:
                order_status = Order.OrderStatus.CANCELLED
            elif "DELIVER" in status_raw:
                order_status = Order.OrderStatus.DELIVERED
            elif "SHIP" in status_raw:
                order_status = Order.OrderStatus.SHIPPED
            elif "CONFIRM" in status_raw:
                order_status = Order.OrderStatus.CONFIRMED
            elif "PENDING" in status_raw:
                order_status = Order.OrderStatus.PENDING
            else:
                order_status = Order.OrderStatus.PROCESSING
            date_raw = raw.get("createdAt") or raw.get("order_date")
            order_date = parse_datetime(str(date_raw)) if date_raw else None
            if order_date is None:
                order_date = timezone.now()
            elif timezone.is_naive(order_date):
                order_date = timezone.make_aware(order_date, timezone.get_current_timezone())
            order = Order.objects.create(
                organization=organization,
                customer=customer,
                source_user=request.user,
                order_number=legacy_id,
                amount=total,
                status=order_status,
                order_date=order_date,
                crm_data=details,
            )
            created += 1
        return Response({"created": created, "duplicates": duplicates, "skipped": skipped}, status=status.HTTP_200_OK)


class StorefrontSupportTicketListCreateView(APIView):
    permission_classes = [IsStorefrontCustomer]

    def get_queryset(self):
        organization, customer = _storefront_customer_context(self.request)
        return SupportTicket.objects.filter(organization=organization).filter(
            Q(customer=customer) | Q(customer_email__iexact=self.request.user.email)
        ).prefetch_related("messages").order_by("-updated_at").distinct()

    def get(self, request):
        return Response([_storefront_ticket_payload(ticket) for ticket in self.get_queryset()])

    @transaction.atomic
    def post(self, request):
        organization, customer = _storefront_customer_context(request)
        subject = str(request.data.get("subject") or "").strip()
        description = str(request.data.get("description") or request.data.get("message") or "").strip()
        category = str(request.data.get("category") or "Other").strip()[:40]
        order_id = str(request.data.get("orderId") or request.data.get("order_id") or "").strip()[:60]
        if not 4 <= len(subject) <= 160:
            raise ValidationError({"subject": "Subject must contain 4–160 characters."})
        if not 10 <= len(description) <= 2000:
            raise ValidationError({"description": "Description must contain 10–2,000 characters."})
        now = timezone.now()
        ticket = SupportTicket.objects.create(
            organization=organization,
            customer=customer,
            customer_name=f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email,
            customer_email=request.user.email,
            subject=subject,
            category=category,
            order_id=order_id,
            description=description,
            priority=SupportTicket.TicketPriority.MEDIUM,
            status=SupportTicket.TicketStatus.OPEN,
            assigned_to="Unassigned",
            created_by=request.user,
            status_history=[{"type": "Created", "from": "", "to": "Open", "by": request.user.email, "at": now.isoformat()}],
        )
        SupportTicketMessage.objects.create(
            ticket=ticket, author=request.user, author_name=request.user.email,
            text=description, is_internal=False, is_initial_request=True,
        )
        _audit_storefront_action(
            request, "CREATE", "SupportTicket", ticket.pk,
            f"Customer raised support ticket {ticket.ticket_code}.", organization=organization,
        )
        return Response(_storefront_ticket_payload(ticket), status=status.HTTP_201_CREATED)


class StorefrontSupportTicketDetailView(APIView):
    permission_classes = [IsStorefrontCustomer]

    def get_object(self, request, ticket_code):
        organization, customer = _storefront_customer_context(request)
        return get_object_or_404(
            SupportTicket.objects.filter(organization=organization).filter(
                Q(customer=customer) | Q(customer_email__iexact=request.user.email)
            ).prefetch_related("messages"),
            ticket_code=ticket_code,
        )

    def get(self, request, ticket_code):
        return Response(_storefront_ticket_payload(self.get_object(request, ticket_code)))

    @transaction.atomic
    def post(self, request, ticket_code):
        ticket = self.get_object(request, ticket_code)
        text = str(request.data.get("text") or "").strip()
        if not text or len(text) > 2000:
            raise ValidationError({"text": "Reply must contain 1–2,000 characters."})
        if ticket.status == SupportTicket.TicketStatus.CLOSED:
            raise ValidationError({"detail": "This ticket is closed. Create a new ticket if you need further help."})
        message = SupportTicketMessage.objects.create(
            ticket=ticket, author=request.user, author_name=request.user.email,
            text=text, is_internal=False, is_initial_request=False,
        )
        history = list(ticket.status_history or [])
        history.append({"id": f"{ticket.ticket_code}-H{len(history) + 1}", "type": "Customer reply", "from": "", "to": "Customer visible", "by": request.user.email, "at": message.created_at.isoformat()})
        ticket.status_history = history
        ticket.updated_at = timezone.now()
        ticket.save(update_fields=["status_history", "updated_at"])
        _audit_storefront_action(
            request, "UPDATE", "SupportTicket", ticket.pk,
            f"Customer replied to support ticket {ticket.ticket_code}.", organization=ticket.organization,
        )
        return Response(_storefront_ticket_payload(ticket), status=status.HTTP_201_CREATED)


class StorefrontLegacySupportTicketImportView(APIView):
    """One-time, email-scoped import of customer support tickets stored in browser mock data."""
    permission_classes = [IsStorefrontCustomer]

    @transaction.atomic
    def post(self, request):
        organization, customer = _storefront_customer_context(request)
        rows = request.data.get("tickets")
        if not isinstance(rows, list) or len(rows) > 100:
            raise ValidationError({"tickets": "Provide an array containing no more than 100 legacy tickets."})
        created = 0
        duplicates = 0
        skipped = 0
        allowed_statuses = {value for value, _label in SupportTicket.TicketStatus.choices}
        allowed_priorities = {value for value, _label in SupportTicket.TicketPriority.choices}
        for raw in rows:
            if not isinstance(raw, dict):
                skipped += 1
                continue
            ticket_email = str(raw.get("customerEmail") or raw.get("customer_email") or "").strip().lower()
            if ticket_email != request.user.email.strip().lower():
                skipped += 1
                continue
            legacy_code = re.sub(r"[^A-Za-z0-9_-]", "", str(raw.get("id") or raw.get("ticket_code") or ""))[:32]
            subject = str(raw.get("subject") or "").strip()[:160]
            description = str(raw.get("description") or raw.get("message") or "").strip()[:2000]
            if len(subject) < 4 or len(description) < 10:
                skipped += 1
                continue
            existing = SupportTicket.objects.filter(organization=organization, ticket_code=legacy_code).first() if legacy_code else None
            if existing:
                if existing.customer_email.strip().lower() == ticket_email:
                    duplicates += 1
                else:
                    skipped += 1
                continue
            status_raw = str(raw.get("status") or "Open")
            priority_raw = str(raw.get("priority") or "Medium")
            ticket = SupportTicket.objects.create(
                organization=organization,
                ticket_code=legacy_code if legacy_code and not SupportTicket.objects.filter(ticket_code=legacy_code).exists() else "",
                customer=customer,
                customer_name=str(raw.get("customerName") or f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email)[:120],
                customer_email=request.user.email,
                subject=subject,
                category=str(raw.get("category") or "Other")[:40],
                order_id=str(raw.get("orderId") or raw.get("order_id") or "")[:60],
                description=description,
                priority=priority_raw if priority_raw in allowed_priorities else SupportTicket.TicketPriority.MEDIUM,
                status=status_raw if status_raw in allowed_statuses else SupportTicket.TicketStatus.OPEN,
                assigned_to=str(raw.get("assignedTo") or raw.get("assigned_to") or "Unassigned")[:120],
                created_by=request.user,
                status_history=raw.get("statusHistory") if isinstance(raw.get("statusHistory"), list) else [],
            )
            SupportTicketMessage.objects.create(ticket=ticket, author_name=ticket.customer_name, text=description, is_internal=False, is_initial_request=True)
            raw_messages = raw.get("messages") if isinstance(raw.get("messages"), list) else []
            for message in raw_messages[:100]:
                if not isinstance(message, dict) or message.get("isInternal") or message.get("is_internal") or message.get("isInitialRequest") or message.get("is_initial_request"):
                    continue
                text = str(message.get("text") or "").strip()[:2000]
                if text:
                    SupportTicketMessage.objects.create(
                        ticket=ticket, author_name=str(message.get("author") or message.get("author_name") or "Customer")[:120],
                        text=text, is_internal=False, is_initial_request=False,
                    )
            created += 1
        return Response({"created": created, "duplicates": duplicates, "skipped": skipped}, status=status.HTTP_200_OK)
