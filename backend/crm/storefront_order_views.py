"""Authenticated storefront order and customer-support APIs.

Orders created here are persisted in Django and mirrored to the existing CRM Order
model so staff can manage their status in the CRM. The current project does not have
payment-gateway integration: every order is explicitly marked as payment-not-processed.
"""
from decimal import Decimal, ROUND_HALF_UP
import uuid

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Organization
from .models import (
    Customer,
    DiscountCoupon,
    Order,
    Product,
    StockMovement,
    StorefrontOrder,
    StorefrontOrderItem,
    SupportTicket,
    SupportTicketMessage,
)
from .storefront_account_views import IsStorefrontCustomer


CENT = Decimal("0.01")


def money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def storefront_organization_id():
    configured = getattr(settings, "STOREFRONT_ORGANIZATION_ID", None)
    if configured and str(configured).isdigit():
        return int(configured)
    # Do not accept a tenant/org ID from the browser. This is the same safe
    # single-store development fallback used by the public catalogue APIs.
    from .models import Category
    return Category.objects.order_by("organization_id").values_list("organization_id", flat=True).first()


class StorefrontOrderItemReadSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="product_id", read_only=True, allow_null=True)
    name = serializers.CharField(source="product_name", read_only=True)
    sku = serializers.CharField(source="product_sku", read_only=True)
    image = serializers.CharField(source="image_url", read_only=True)
    specs = serializers.CharField(source="short_description", read_only=True)
    price = serializers.DecimalField(source="unit_price", max_digits=12, decimal_places=2, read_only=True)
    mrp = serializers.DecimalField(source="list_price", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = StorefrontOrderItem
        fields = ["id", "sku", "name", "specs", "image", "price", "mrp", "quantity", "line_total"]
        read_only_fields = fields


class StorefrontOrderReadSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="crm_order.order_number", read_only=True)
    orderNumber = serializers.CharField(source="crm_order.order_number", read_only=True)
    fulfillmentStatus = serializers.SerializerMethodField()
    paymentMethod = serializers.CharField(source="payment_method", read_only=True)
    paymentStatus = serializers.CharField(source="payment_status", read_only=True)
    customerEmail = serializers.EmailField(source="user.email", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    address = serializers.JSONField(source="shipping_address", read_only=True)
    subtotal = serializers.DecimalField(source="item_subtotal", max_digits=12, decimal_places=2, read_only=True)
    itemPayable = serializers.DecimalField(source="product_subtotal", max_digits=12, decimal_places=2, read_only=True)
    discount = serializers.DecimalField(source="product_discount", max_digits=12, decimal_places=2, read_only=True)
    couponDiscount = serializers.DecimalField(source="coupon_discount", max_digits=12, decimal_places=2, read_only=True)
    couponCode = serializers.CharField(source="coupon_code", read_only=True)
    delivery = serializers.DecimalField(source="delivery_fee", max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(source="crm_order.amount", max_digits=12, decimal_places=2, read_only=True)
    status = serializers.CharField(source="crm_order.status", read_only=True)
    items = StorefrontOrderItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = StorefrontOrder
        fields = [
            "id", "orderNumber", "status", "fulfillmentStatus", "paymentMethod", "paymentStatus",
            "customerEmail", "createdAt", "address", "subtotal", "itemPayable", "discount",
            "couponDiscount", "couponCode", "delivery", "total", "items",
        ]
        read_only_fields = fields

    def get_fulfillmentStatus(self, obj):
        return dict(Order.OrderStatus.choices).get(obj.crm_order.status, obj.crm_order.status)


class StorefrontOrderListCreateView(APIView):
    permission_classes = [IsStorefrontCustomer]

    def get(self, request):
        orders = (
            StorefrontOrder.objects.filter(user=request.user)
            .select_related("user", "crm_order")
            .prefetch_related("items")
            .order_by("-created_at")
        )
        return Response(StorefrontOrderReadSerializer(orders, many=True).data)

    @transaction.atomic
    def post(self, request):
        organization_id = storefront_organization_id()
        if not organization_id:
            return Response(
                {"detail": "The storefront organization/catalogue is not configured. Publish a category and product first."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        address = request.data.get("address")
        if not isinstance(address, dict):
            raise ValidationError({"address": "Provide a delivery address."})
        address_fields = {
            "name": str(address.get("name") or "").strip(),
            "phone": str(address.get("phone") or "").strip(),
            "line": str(address.get("line") or "").strip(),
            "city": str(address.get("city") or "").strip(),
            "type": str(address.get("type") or "Home").strip(),
        }
        for key, label in [("name", "Full name"), ("phone", "Phone"), ("line", "Address line"), ("city", "City/state/PIN")]:
            if not address_fields[key]:
                raise ValidationError({"address": f"{label} is required."})
        if len(address_fields["line"]) < 5:
            raise ValidationError({"address": "Enter a more complete delivery address."})
        if address_fields["type"] not in {"Home", "Work", "Other"}:
            address_fields["type"] = "Other"

        payment_method = str(request.data.get("payment_method") or "UPI").strip()
        if payment_method not in {"UPI", "Credit / Debit Card", "Cash on Delivery"}:
            raise ValidationError({"payment_method": "Choose a supported demo payment method."})

        raw_items = request.data.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            raise ValidationError({"items": "Your cart is empty."})
        if len(raw_items) > 50:
            raise ValidationError({"items": "An order can contain at most 50 distinct product lines."})

        # Combine duplicate product lines and strictly validate identifiers/quantities.
        quantities = {}
        for row in raw_items:
            if not isinstance(row, dict):
                raise ValidationError({"items": "Each item must include product_id and quantity."})
            try:
                product_id = int(row.get("product_id"))
                quantity = int(row.get("quantity"))
            except (TypeError, ValueError):
                raise ValidationError({"items": "Product IDs and quantities must be whole numbers."})
            if product_id < 1 or quantity < 1 or quantity > 100:
                raise ValidationError({"items": "Product IDs must be positive and quantities must be between 1 and 100."})
            quantities[product_id] = quantities.get(product_id, 0) + quantity
        if len(quantities) > 50 or any(quantity > 100 for quantity in quantities.values()):
            raise ValidationError({"items": "Each product quantity must be between 1 and 100."})

        organization = get_object_or_404(Organization, pk=organization_id)
        products = []
        item_payable = Decimal("0.00")
        item_subtotal = Decimal("0.00")
        product_discount = Decimal("0.00")
        for product_id, quantity in quantities.items():
            product = (
                Product.objects.select_for_update()
                .select_related("category")
                .filter(
                    pk=product_id,
                    organization_id=organization_id,
                    status=Product.ProductStatus.ACTIVE,
                    category__is_active=True,
                )
                .first()
            )
            if product is None:
                raise ValidationError({"items": f"Product {product_id} is no longer available. Refresh your catalogue and try again."})
            if product.stock < quantity:
                raise ValidationError({"items": f"Only {product.stock} unit(s) of {product.name} are currently available."})
            line_price = money(product.price * quantity)
            list_unit_price = max(product.mrp or product.price, product.price)
            line_list_price = money(list_unit_price * quantity)
            item_payable += line_price
            item_subtotal += line_list_price
            product_discount += line_list_price - line_price
            products.append((product, quantity, line_price, list_unit_price))

        item_payable = money(item_payable)
        item_subtotal = money(item_subtotal)
        product_discount = money(product_discount)

        coupon_code = str(request.data.get("coupon_code") or "").strip().upper()
        coupon_discount = Decimal("0.00")
        coupon = None
        now = timezone.now()
        if coupon_code:
            coupon = (
                DiscountCoupon.objects.select_for_update()
                .filter(organization_id=organization_id, code=coupon_code)
                .first()
            )
            if coupon is None:
                raise ValidationError({"coupon_code": "This coupon code was not found."})
            if not coupon.is_active:
                raise ValidationError({"coupon_code": "This coupon is inactive."})
            if coupon.starts_at and now < coupon.starts_at:
                raise ValidationError({"coupon_code": "This coupon is not active yet."})
            if coupon.ends_at and now > coupon.ends_at:
                raise ValidationError({"coupon_code": "This coupon has expired."})
            if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
                raise ValidationError({"coupon_code": "This coupon has reached its usage limit."})
            if item_payable < coupon.min_order_value:
                raise ValidationError({"coupon_code": f"This coupon needs a minimum cart value of ₹{coupon.min_order_value}."})
            raw_discount = (item_payable * coupon.value / Decimal("100")) if coupon.discount_type == DiscountCoupon.DiscountType.PERCENT else coupon.value
            if coupon.discount_type == DiscountCoupon.DiscountType.PERCENT and coupon.max_discount is not None:
                raw_discount = min(raw_discount, coupon.max_discount)
            coupon_discount = money(min(item_payable, raw_discount))

        delivery_fee = Decimal("0.00") if item_payable >= Decimal("500.00") else Decimal("99.00")
        total = money(max(Decimal("0.00"), item_payable + delivery_fee - coupon_discount))
        order_number = f"TG-{timezone.localtime(now).strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        name_parts = address_fields["name"].split(maxsplit=1)
        first_name = name_parts[0][:100]
        last_name = name_parts[1][:100] if len(name_parts) > 1 else ""
        customer = Customer.objects.filter(organization=organization, email__iexact=request.user.email).first()
        if customer is None:
            customer = Customer.objects.create(
                organization=organization,
                first_name=first_name,
                last_name=last_name,
                email=request.user.email,
                phone=address_fields["phone"][:20],
                lifecycle_stage=Customer.LifecycleStage.CUSTOMER,
                is_active=True,
            )
        else:
            changed_fields = []
            if customer.lifecycle_stage in {Customer.LifecycleStage.VISITOR, Customer.LifecycleStage.LEAD}:
                customer.lifecycle_stage = Customer.LifecycleStage.CUSTOMER
                changed_fields.append("lifecycle_stage")
            if not customer.phone and address_fields["phone"]:
                customer.phone = address_fields["phone"][:20]
                changed_fields.append("phone")
            if changed_fields:
                customer.save(update_fields=[*changed_fields, "updated_at"])

        crm_order = Order.objects.create(
            organization=organization,
            customer=customer,
            order_number=order_number,
            amount=total,
            status=Order.OrderStatus.PENDING,
            order_date=now,
        )
        storefront_order = StorefrontOrder.objects.create(
            user=request.user,
            crm_order=crm_order,
            shipping_address=address_fields,
            payment_method=payment_method,
            payment_status=StorefrontOrder.PaymentStatus.NOT_PROCESSED,
            item_subtotal=item_subtotal,
            product_subtotal=item_payable,
            product_discount=product_discount,
            coupon_discount=coupon_discount,
            delivery_fee=delivery_fee,
            coupon_code=coupon_code,
        )

        for product, quantity, line_total, list_unit_price in products:
            stock_before = product.stock
            product.stock -= quantity
            product.save(update_fields=["stock", "updated_at"])
            StockMovement.objects.create(
                organization=organization,
                product=product,
                actor=request.user,
                movement_type=StockMovement.MovementType.ADJUSTMENT,
                quantity_delta=-quantity,
                stock_before=stock_before,
                stock_after=product.stock,
                reason=f"Reserved for storefront order {order_number}; payment is not processed by this demo checkout.",
            )
            StorefrontOrderItem.objects.create(
                order=storefront_order,
                product=product,
                product_name=product.name,
                product_sku=product.sku,
                image_url=(product.images[0] if isinstance(product.images, list) and product.images else ""),
                short_description=product.short_description,
                unit_price=product.price,
                list_price=list_unit_price,
                quantity=quantity,
                line_total=line_total,
            )

        if coupon is not None:
            coupon.used_count += 1
            coupon.save(update_fields=["used_count", "updated_at"])

        storefront_order = StorefrontOrder.objects.select_related("user", "crm_order").prefetch_related("items").get(pk=storefront_order.pk)
        return Response(StorefrontOrderReadSerializer(storefront_order).data, status=status.HTTP_201_CREATED)


class StorefrontOrderDetailView(APIView):
    permission_classes = [IsStorefrontCustomer]

    def get(self, request, order_number):
        order = get_object_or_404(
            StorefrontOrder.objects.filter(user=request.user)
            .select_related("user", "crm_order")
            .prefetch_related("items"),
            crm_order__order_number=order_number,
        )
        return Response(StorefrontOrderReadSerializer(order).data)


class StorefrontSupportTicketMessageReadSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author_name", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    isInternal = serializers.BooleanField(source="is_internal", read_only=True)
    isInitialRequest = serializers.BooleanField(source="is_initial_request", read_only=True)

    class Meta:
        model = SupportTicketMessage
        fields = ["id", "author", "author_name", "text", "createdAt", "isInternal", "isInitialRequest"]
        read_only_fields = fields


class StorefrontSupportTicketReadSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="ticket_code", read_only=True)
    customerName = serializers.CharField(source="customer_name", read_only=True)
    customerEmail = serializers.EmailField(source="customer_email", read_only=True)
    orderId = serializers.CharField(source="order_id", read_only=True)
    assignedTo = serializers.CharField(source="assigned_to", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    messages = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            "id", "customer", "customerName", "customerEmail", "subject", "category", "orderId",
            "description", "priority", "status", "assignedTo", "messages", "createdAt", "updatedAt",
        ]
        read_only_fields = fields

    def get_messages(self, obj):
        # Never expose staff-only internal notes to the customer storefront.
        visible = obj.messages.filter(is_internal=False).order_by("created_at")
        return StorefrontSupportTicketMessageReadSerializer(visible, many=True).data


class StorefrontSupportTicketCreateSerializer(serializers.Serializer):
    subject = serializers.CharField(min_length=4, max_length=160, trim_whitespace=True)
    category = serializers.CharField(max_length=40, required=False, allow_blank=True, default="Other")
    orderId = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    description = serializers.CharField(min_length=10, max_length=2000, trim_whitespace=True)


class StorefrontSupportTicketListCreateView(APIView):
    permission_classes = [IsStorefrontCustomer]

    def get(self, request):
        tickets = (
            SupportTicket.objects.filter(created_by=request.user)
            .select_related("customer")
            .prefetch_related("messages")
            .order_by("-updated_at")
        )
        return Response(StorefrontSupportTicketReadSerializer(tickets, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = StorefrontSupportTicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization_id = storefront_organization_id()
        if not organization_id:
            return Response({"detail": "The storefront organization is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        organization = get_object_or_404(Organization, pk=organization_id)
        user = request.user
        display_name = " ".join(part for part in [user.first_name, user.last_name] if part).strip() or user.email.split("@", 1)[0]
        customer = Customer.objects.filter(organization=organization, email__iexact=user.email).first()
        data = serializer.validated_data
        ticket = SupportTicket.objects.create(
            organization=organization,
            customer=customer,
            customer_name=display_name[:120],
            customer_email=user.email,
            subject=data["subject"],
            category=(data.get("category") or "Other").strip() or "Other",
            order_id=(data.get("orderId") or "").strip(),
            description=data["description"],
            priority=SupportTicket.TicketPriority.MEDIUM,
            status=SupportTicket.TicketStatus.OPEN,
            assigned_to="Unassigned",
            created_by=user,
            status_history=[{"type": "Created", "from": "", "to": "Open", "by": display_name, "at": timezone.now().isoformat()}],
        )
        SupportTicketMessage.objects.create(
            ticket=ticket,
            author=user,
            author_name=display_name[:120],
            text=ticket.description,
            is_internal=False,
            is_initial_request=True,
        )
        ticket = SupportTicket.objects.select_related("customer").prefetch_related("messages").get(pk=ticket.pk)
        return Response(StorefrontSupportTicketReadSerializer(ticket).data, status=status.HTTP_201_CREATED)


class StorefrontSupportTicketDetailView(APIView):
    permission_classes = [IsStorefrontCustomer]

    def get(self, request, ticket_id):
        ticket = get_object_or_404(
            SupportTicket.objects.filter(created_by=request.user).select_related("customer").prefetch_related("messages"),
            ticket_code=ticket_id,
        )
        return Response(StorefrontSupportTicketReadSerializer(ticket).data)


class StorefrontSupportTicketMessagesView(APIView):
    permission_classes = [IsStorefrontCustomer]

    @transaction.atomic
    def post(self, request, ticket_id):
        ticket = get_object_or_404(
            SupportTicket.objects.select_for_update().filter(created_by=request.user),
            ticket_code=ticket_id,
        )
        if ticket.status == SupportTicket.TicketStatus.CLOSED:
            raise ValidationError({"detail": "This ticket is closed. Create a new ticket if you still need help."})
        text = str(request.data.get("text") or "").strip()
        if not text or len(text) > 2000:
            raise ValidationError({"text": "Reply must contain between 1 and 2,000 characters."})
        display_name = " ".join(part for part in [request.user.first_name, request.user.last_name] if part).strip() or request.user.email.split("@", 1)[0]
        SupportTicketMessage.objects.create(
            ticket=ticket,
            author=request.user,
            author_name=display_name[:120],
            text=text,
            is_internal=False,
            is_initial_request=False,
        )
        if ticket.status == SupportTicket.TicketStatus.WAITING:
            ticket.status = SupportTicket.TicketStatus.IN_PROGRESS
            ticket.status_history = [*ticket.status_history, {"type": "Status changed", "from": "Waiting on Customer", "to": "In Progress", "by": display_name, "at": timezone.now().isoformat()}]
            ticket.save(update_fields=["status", "status_history", "updated_at"])
        ticket = SupportTicket.objects.select_related("customer").prefetch_related("messages").get(pk=ticket.pk)
        return Response(StorefrontSupportTicketReadSerializer(ticket).data)
