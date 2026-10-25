from mimetypes import guess_type

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSalesWriteOrSupportReadOnly
from .models import (
    AuditLog,
    Customer,
    Interaction,
    Order,
    OrderActivityEvent,
    CrmAddress,
    CrmCustomerProfile,
    CrmSavedPaymentMethod,
    SupportTicket,
)

User = get_user_model()
MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _staff_customer(request, customer_id):
    organization = getattr(request.user, "organization", None)
    if organization is None:
        raise PermissionDenied("Your staff account is not assigned to an organization.")
    return get_object_or_404(Customer, pk=customer_id, organization=organization)


def _matching_account(customer):
    return User.objects.filter(
        email__iexact=customer.email,
        role="CUSTOMER",
        organization_id=customer.organization_id,
    ).first()


def _iso(value):
    return value.isoformat() if value else None


def _mask_upi_id(value):
    value = str(value or "").strip()
    if "@" not in value:
        return "UPI ID saved (masked)" if value else ""
    local, provider = value.rsplit("@", 1)
    if len(local) <= 2:
        masked = (local[:1] or "•") + "•••"
    else:
        masked = f"{local[:1]}•••{local[-1:]}"
    return f"{masked}@{provider}"


def _record_profile_audit(request, action, entity_type, entity_id, description):
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return
    organization = getattr(user, "organization", None)
    if organization is None:
        linked = Customer.objects.filter(email__iexact=getattr(user, "email", "")).select_related("organization").first()
        organization = linked.organization if linked else None
    if organization is None:
        from .storefront_utils import get_storefront_organization
        organization = get_storefront_organization()
    if organization is None:
        return
    AuditLog.objects.create(
        organization=organization,
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id or ""),
        description=description[:2000],
        ip_address=(getattr(request, "META", {}) or {}).get("REMOTE_ADDR"),
    )


def _ticket_payload(ticket):
    return {
        "id": ticket.ticket_code or str(ticket.pk),
        "subject": ticket.subject,
        "category": ticket.category,
        "priority": ticket.priority,
        "status": ticket.status,
        "orderId": ticket.order_id,
        "description": ticket.description,
        "assignedTo": ticket.assigned_to,
        "createdAt": _iso(ticket.created_at),
        "updatedAt": _iso(ticket.updated_at),
        "history": ticket.status_history if isinstance(ticket.status_history, list) else [],
        "messages": [
            {
                "id": message.pk,
                "author": message.author_name,
                "text": message.text,
                "isInternal": message.is_internal,
                "isInitialRequest": message.is_initial_request,
                "createdAt": _iso(message.created_at),
            }
            for message in ticket.messages.all().order_by("created_at")
        ],
    }


def _order_payload(order):
    details = order.crm_data if isinstance(order.crm_data, dict) else {}
    items = details.get("items") if isinstance(details.get("items"), list) else []
    safe_items = []
    for row in items[:100]:
        if not isinstance(row, dict):
            continue
        safe_items.append({
            "id": row.get("id"),
            "sku": str(row.get("sku") or ""),
            "name": str(row.get("name") or "Product"),
            "specs": str(row.get("specs") or row.get("shortDescription") or ""),
            "image": str(row.get("image") or ""),
            "price": row.get("price", 0),
            "mrp": row.get("mrp", row.get("price", 0)),
            "quantity": row.get("quantity", 1),
            "lineTotal": float(row.get("price") or 0) * int(row.get("quantity") or 1),
        })
    address = details.get("address") if isinstance(details.get("address"), dict) else {}
    return {
        "id": order.pk,
        "orderNumber": order.order_number,
        "date": _iso(order.order_date or order.created_at),
        "createdAt": _iso(order.created_at),
        "updatedAt": _iso(order.updated_at),
        "total": float(order.amount or 0),
        "status": order.status,
        "paymentMethod": str(details.get("paymentMethod") or "Not recorded"),
        "paymentStatus": str(details.get("paymentStatus") or "Not tracked by backend"),
        "address": {str(k): v for k, v in address.items() if not str(k).startswith("_")},
        "items": safe_items,
        "subtotal": details.get("subtotal"),
        "itemPayable": details.get("itemPayable"),
        "discount": details.get("discount"),
        "couponDiscount": details.get("couponDiscount"),
        "couponCode": str(details.get("couponCode") or ""),
        "delivery": details.get("delivery"),
        "shipments": [
            {
                "id": shipment.pk,
                "carrier": shipment.carrier,
                "trackingNumber": shipment.tracking_number,
                "trackingUrl": shipment.tracking_url,
                "status": shipment.status,
                "shippedAt": _iso(shipment.shipped_at),
                "estimatedDelivery": _iso(shipment.estimated_delivery),
                "deliveredAt": _iso(shipment.delivered_at),
                "updatedAt": _iso(shipment.updated_at),
            }
            for shipment in order.shipments.all().order_by("-created_at")
        ],
        "returns": [
            {
                "id": return_request.pk,
                "reason": return_request.reason,
                "description": return_request.description,
                "status": return_request.status,
                "resolutionNote": return_request.resolution_note,
                "createdAt": _iso(return_request.created_at),
                "updatedAt": _iso(return_request.updated_at),
            }
            for return_request in order.return_requests.all().order_by("-created_at")
        ],
        "demoOnly": bool(details.get("demoOnly") or details.get("legacyImported")),
        "source": str(details.get("source") or "crm"),
    }


class CustomerProfileOverviewView(APIView):
    """Single organization-scoped CRM read model for the customer 360° profile."""
    permission_classes = [IsAuthenticated, IsSalesWriteOrSupportReadOnly]

    def get(self, request, customer_id):
        customer = _staff_customer(request, customer_id)
        account = _matching_account(customer)
        profile = None
        addresses = []
        payment_methods = []
        if account:
            profile = CrmCustomerProfile.objects.filter(user=account).first()
            addresses = list(CrmAddress.objects.filter(user=account).order_by("-is_default", "-updated_at"))
            payment_methods = list(CrmSavedPaymentMethod.objects.filter(user=account).order_by("-is_default", "-updated_at"))

        raw_orders = list(
            Order.objects.filter(organization=customer.organization, customer=customer)
            .prefetch_related("shipments", "return_requests")
            .order_by("-order_date", "-id")[:200]
        )
        # Include rows linked directly to the storefront account even if an old customer row was re-created.
        if account:
            existing_ids = {row.pk for row in raw_orders}
            for row in Order.objects.filter(organization=customer.organization, source_user=account).prefetch_related("shipments", "return_requests").order_by("-order_date", "-id")[:200]:
                if row.pk not in existing_ids:
                    raw_orders.append(row)
        raw_orders.sort(key=lambda row: row.order_date or row.created_at, reverse=True)
        order_ids = [row.pk for row in raw_orders]
        orders = [_order_payload(row) for row in raw_orders]

        tickets_qs = SupportTicket.objects.filter(organization=customer.organization).filter(
            Q(customer=customer) | Q(customer_email__iexact=customer.email)
        ).prefetch_related("messages").order_by("-updated_at")
        tickets = list(tickets_qs[:200])
        interactions = list(
            Interaction.objects.filter(organization=customer.organization, customer=customer)
            .select_related("created_by").order_by("-interaction_date")[:200]
        )
        order_events = list(
            OrderActivityEvent.objects.filter(organization=customer.organization, order_id__in=order_ids)
            .select_related("created_by", "order").order_by("-created_at")[:300]
        ) if order_ids else []

        audits_q = Q(entity_type__iexact="Customer", entity_id=str(customer.pk))
        if account:
            audits_q |= Q(entity_type__iexact="User", entity_id=str(account.pk))
            # Include future login, profile/address/payment changes, and delete events
            # even when the deleted row is no longer present in the current snapshot.
            audits_q |= Q(user=account)
        if profile:
            audits_q |= Q(entity_type__iexact="CrmCustomerProfile", entity_id=str(profile.pk))
        if addresses:
            audits_q |= Q(entity_type__iexact="CrmAddress", entity_id__in=[str(item.pk) for item in addresses])
        if raw_orders:
            audits_q |= Q(entity_type__iexact="Order", entity_id__in=[str(item.pk) for item in raw_orders] + [str(item.order_number) for item in raw_orders])
        if tickets:
            audits_q |= Q(entity_type__iexact="SupportTicket", entity_id__in=[str(item.pk) for item in tickets] + [str(item.ticket_code) for item in tickets])
        audits = list(AuditLog.objects.filter(organization=customer.organization).filter(audits_q).select_related("user").order_by("-created_at")[:150])

        activity = []
        def add_activity(kind, title, description, when, reference=None):
            if not when:
                return
            activity.append({
                "id": f"{kind}:{reference or len(activity)}:{when.isoformat()}",
                "kind": kind,
                "title": title,
                "description": description or "",
                "date": when.isoformat(),
                "reference": str(reference or ""),
            })

        add_activity("customer", "Customer record created", f"{customer.first_name} {customer.last_name}".strip(), customer.created_at, customer.pk)
        if account:
            add_activity("account", "Storefront account created", account.email, getattr(account, "date_joined", None), account.pk)
            has_login_audit = any(
                str(audit.entity_type).lower() == "user"
                and str(audit.entity_id) == str(account.pk)
                and str(audit.action).upper() == "LOGIN"
                for audit in audits
            )
            if not has_login_audit:
                add_activity("login", "Most recent login", "Only the latest login is available because historical login auditing was not enabled earlier.", account.last_login, account.pk)
        if profile:
            add_activity("profile", "Personal profile saved", "Personal details and communication preferences", profile.updated_at, profile.pk)
            for address in addresses:
                add_activity("address", f"{address.get_label_display()} address", f"{address.full_name} · {address.city}, {address.state} {address.postal_code}" + (" · Default" if address.is_default else ""), address.updated_at, address.pk)
        for order in raw_orders:
            add_activity("order", f"Order {order.order_number}", f"{order.status} · ₹{order.amount}", order.order_date or order.created_at, order.pk)
        for ticket in tickets:
            add_activity("support", f"Support ticket {ticket.ticket_code}", f"{ticket.subject} · {ticket.status} · {ticket.priority}", ticket.created_at, ticket.ticket_code)
            if ticket.updated_at and ticket.updated_at != ticket.created_at:
                add_activity("support-update", f"Support ticket updated: {ticket.ticket_code}", f"Current status: {ticket.status}", ticket.updated_at, ticket.ticket_code)
            for history_item in ticket.status_history if isinstance(ticket.status_history, list) else []:
                if not isinstance(history_item, dict):
                    continue
                when = history_item.get("at")
                if not when:
                    continue
                add_activity(
                    "support-status", f"Ticket {ticket.ticket_code}: {history_item.get('type') or 'History'}",
                    f"{history_item.get('from') or '—'} → {history_item.get('to') or '—'} · by {history_item.get('by') or 'system'}",
                    parse_datetime(when.replace("Z", "+00:00")) if isinstance(when, str) else when,
                    history_item.get("id") or ticket.ticket_code,
                )
            for message in ticket.messages.all():
                if message.is_initial_request:
                    continue
                prefix = "Internal note" if message.is_internal else "Support reply"
                add_activity(
                    "support-message", f"{prefix} · {ticket.ticket_code}",
                    f"{message.author_name}: {message.text[:240]}", message.created_at, message.pk,
                )
        for method in payment_methods:
            method_description = f"{method.method_type} · {method.label}"
            if method.method_type == CrmSavedPaymentMethod.MethodType.CARD:
                method_description += f" · ending {method.last_four}"
            elif method.upi_id:
                method_description += f" · {_mask_upi_id(method.upi_id)}"
            if method.is_default:
                method_description += " · default"
            add_activity("payment-method", f"Saved payment method {method.label}", method_description, method.updated_at, method.pk)
        for item in interactions:
            add_activity("interaction", item.subject, f"{item.get_interaction_type_display()} · {item.description}".strip(" ·"), item.interaction_date or item.created_at, item.pk)
        for event in order_events:
            add_activity("order-activity", f"Order activity · {event.order.order_number}", event.message, event.created_at, event.pk)
        for audit in audits:
            actor = getattr(audit.user, "email", None)
            audit_description = f"{audit.description} · By {actor}" if actor and audit.description else (audit.description or (f"By {actor}" if actor else ""))
            add_activity("audit", f"{audit.action.title()} · {audit.entity_type}", audit_description, audit.created_at, audit.pk)

        activity.sort(key=lambda row: row["date"] or "", reverse=True)
        activity = activity[:300]

        storefront_profile = None
        if profile:
            storefront_profile = {
                "id": profile.pk,
                "firstName": account.first_name,
                "lastName": account.last_name,
                "email": account.email,
                "phone": profile.phone or customer.phone,
                "dateOfBirth": profile.date_of_birth.isoformat() if profile.date_of_birth else None,
                "gender": profile.gender,
                "emailUpdates": profile.email_updates,
                "smsUpdates": profile.sms_updates,
                "whatsappUpdates": profile.whatsapp_updates,
                "createdAt": _iso(profile.created_at),
                "updatedAt": _iso(profile.updated_at),
                "profileImageAvailable": bool(profile.profile_image),
            }

        return Response({
            "customer": {
                "id": customer.pk,
                "name": str(customer),
                "firstName": customer.first_name,
                "lastName": customer.last_name,
                "email": customer.email,
                "phone": (profile.phone if profile and profile.phone else customer.phone),
                "status": "Active" if customer.is_active else "Inactive",
                "lifecycleStage": customer.lifecycle_stage,
                "joinedAt": _iso(customer.created_at),
                "updatedAt": _iso(customer.updated_at),
                "accountCreatedAt": _iso(getattr(account, "date_joined", None)) if account else None,
                "lastLoginAt": _iso(getattr(account, "last_login", None)) if account else None,
            },
            "profile": storefront_profile,
            "profileImageAvailable": bool(profile and profile.profile_image),
            "addresses": [
                {
                    "id": item.pk, "label": item.label, "labelDisplay": item.get_label_display(),
                    "fullName": item.full_name, "phone": item.phone, "addressLine1": item.address_line1,
                    "addressLine2": item.address_line2, "city": item.city, "state": item.state,
                    "postalCode": item.postal_code, "country": item.country, "isDefault": item.is_default,
                    "createdAt": _iso(item.created_at), "updatedAt": _iso(item.updated_at),
                }
                for item in addresses
            ],
            "savedPaymentMethods": [
                {
                    "id": method.pk,
                    "type": method.method_type,
                    "label": method.label,
                    "provider": method.provider,
                    "maskedDetails": (
                        f"•••• {method.last_four}" if method.method_type == CrmSavedPaymentMethod.MethodType.CARD
                        else _mask_upi_id(method.upi_id)
                    ),
                    "lastFour": method.last_four or None,
                    "isDefault": method.is_default,
                    "createdAt": _iso(method.created_at),
                    "updatedAt": _iso(method.updated_at),
                }
                for method in payment_methods
            ],
            "paymentMethodsNotice": "Saved payment metadata is shown masked. The project does not store full card numbers or CVV, and no payment-gateway tokenization is connected; these saved labels cannot authorize a charge.",
            "orders": orders,
            "supportTickets": [_ticket_payload(ticket) for ticket in tickets],
            "interactions": [
                {"id": item.pk, "type": item.interaction_type, "typeDisplay": item.get_interaction_type_display(),
                 "subject": item.subject, "description": item.description, "date": _iso(item.interaction_date),
                 "createdAt": _iso(item.created_at), "createdBy": getattr(item.created_by, "email", None)}
                for item in interactions
            ],
            "activity": activity,
        })


class ProfileImageUploadSerializer(serializers.Serializer):
    profile_image = serializers.ImageField()

    def validate_profile_image(self, value):
        if value.size > MAX_PROFILE_IMAGE_BYTES:
            raise serializers.ValidationError("Profile image must be 2 MB or smaller.")
        content_type = getattr(value, "content_type", None)
        if content_type and content_type not in ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError("Upload a JPG, PNG, or WebP image.")
        extension = value.name.rsplit(".", 1)[-1].lower() if "." in value.name else ""
        if extension not in {"jpg", "jpeg", "png", "webp"}:
            raise serializers.ValidationError("Upload a JPG, PNG, or WebP image.")
        return value


def _serve_private_profile_image(profile):
    if not profile or not profile.profile_image:
        raise Http404("No profile image has been uploaded.")
    try:
        profile.profile_image.open("rb")
        content = profile.profile_image.read()
        profile.profile_image.close()
    except (OSError, ValueError):
        raise Http404("The profile image file is unavailable.")
    content_type = guess_type(profile.profile_image.name)[0] or "application/octet-stream"
    response = HttpResponse(content, content_type=content_type)
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


class StorefrontCustomerProfileImageView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _profile(self, request):
        if getattr(request.user, "role", None) != "CUSTOMER" or not request.user.is_active:
            raise PermissionDenied("A signed-in customer account is required.")
        profile, _ = CrmCustomerProfile.objects.get_or_create(user=request.user)
        return profile

    def get(self, request):
        return _serve_private_profile_image(self._profile(request))

    def put(self, request):
        profile = self._profile(request)
        serializer = ProfileImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        old_name = profile.profile_image.name if profile.profile_image else ""
        profile.profile_image = serializer.validated_data["profile_image"]
        profile.save(update_fields=["profile_image", "updated_at"])
        if old_name and old_name != profile.profile_image.name:
            profile.profile_image.storage.delete(old_name)
        _record_profile_audit(request, "UPDATE", "CrmCustomerProfile", profile.pk, "Customer updated their profile image.")
        return Response({"hasProfileImage": True, "updatedAt": _iso(profile.updated_at)}, status=status.HTTP_200_OK)

    def delete(self, request):
        profile = self._profile(request)
        if profile.profile_image:
            profile.profile_image.delete(save=False)
            profile.profile_image = None
            profile.save(update_fields=["profile_image", "updated_at"])
            _record_profile_audit(request, "UPDATE", "CrmCustomerProfile", profile.pk, "Customer removed their profile image.")
        return Response({"hasProfileImage": False}, status=status.HTTP_200_OK)


class CustomerProfileImageView(APIView):
    permission_classes = [IsAuthenticated, IsSalesWriteOrSupportReadOnly]

    def get(self, request, customer_id):
        customer = _staff_customer(request, customer_id)
        account = _matching_account(customer)
        if not account:
            raise Http404("This CRM customer has no linked storefront account.")
        profile = CrmCustomerProfile.objects.filter(user=account).first()
        return _serve_private_profile_image(profile)
