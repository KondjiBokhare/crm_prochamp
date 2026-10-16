from django.db.migrations import serializer
from requests import request
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, SAFE_METHODS
from rest_framework.exceptions import ValidationError
from django.db import models
from rest_framework.views import APIView
from rest_framework import status


# Analytical things
from django.db.models import Sum, Avg
from rest_framework.response import Response
from django.db.models import Count, Sum, Q, DecimalField, Value
from django.db.models.functions import Coalesce
from decimal import Decimal
from datetime import date, timedelta
from zoneinfo import ZoneInfo
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from accounts import serializers

from .models import (
    Customer,
    Interaction,
    Order,
    Segment,
    Campaign,
    CampaignResponse,
)

from .serializers import (
    CustomerSerializer,
    DiscountCouponSerializer,
    InteractionSerializer,
    OrderSerializer,
    SegmentSerializer,
    CampaignSerializer,
    CampaignResponseSerializer,
    AnalyticsSerializer, 
)

from rest_framework.permissions import IsAuthenticated
from accounts.permissions import (
    IsAdminOrReadOnly,
    IsSalesOrAdmin,
    IsSalesWriteOrSupportReadOnly,
    IsSupportOrAdmin,
    IsInteractionAllowed,
)

from accounts.permissions import (
    IsSegmentAllowed,
    IsCampaignAllowed,
    IsAdminOrReadOnly,
    IsAdminOrManagement,
)

from crm.services import update_customer_lifecycle
from crm.services import create_audit_log
from django.db import transaction
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import AuditLog
from .serializers import AuditLogSerializer

def get_dynamic_segment_customers(segment):
    """
    Return customers matching a dynamic segment's rules.
    Order metrics exclude cancelled and refunded orders.
    """
    from .models import Customer, Order

    queryset = Customer.objects.filter(
        organization=segment.organization
    )

    rules = segment.rules

    if not isinstance(rules, dict) or not rules:
        return queryset.none()

    match_type = rules.get("match", "all")
    conditions = rules.get("conditions")

    if match_type not in {"all", "any"}:
        raise ValidationError("'match' must be 'all' or 'any'.")

    if not isinstance(conditions, list) or not conditions:
        return queryset.none()

    # Aggregate only orders from the same organization.
    eligible_orders = Order.objects.filter(
        organization=segment.organization
    ).exclude(
        status__in=["CANCELLED", "REFUNDED"]
    )

    queryset = queryset.annotate(
        total_orders=Count(
            "orders",
            filter=models.Q(
                orders__organization=segment.organization
            ) & ~models.Q(
                orders__status__in=["CANCELLED", "REFUNDED"]
            ),
            distinct=True,
        ),
        total_spent=Coalesce(
            Sum(
                "orders__amount",
                filter=models.Q(
                    orders__organization=segment.organization,
                    orders__status="DELIVERED",
                ),
            ),
            Value(Decimal("0.00")),
            output_field=DecimalField(
                max_digits=12,
                decimal_places=2,
            ),
        ),
    )

    query = None

    for condition in conditions:
        if not isinstance(condition, dict) or set(condition) != {
            "field", "operator", "value"
        }:
            raise ValidationError(
                "Each condition must contain field, operator, and value."
            )

        field = condition["field"]
        operator = condition["operator"]
        value = condition["value"]

        allowed_fields = {
            "lifecycle_stage",
            "is_active",
            "total_orders",
            "total_spent",
        }

        if field not in allowed_fields:
            raise ValidationError(
                f"Unsupported segmentation field: {field}."
            )

        if field == "lifecycle_stage":
            valid_stages = {
                choice[0]
                for choice in Customer.LifecycleStage.choices
            }
            if not isinstance(value, str) or value not in valid_stages:
                raise ValidationError("Invalid lifecycle_stage value.")

        elif field == "is_active":
            if not isinstance(value, bool):
                raise ValidationError("is_active must be true or false.")

        elif field == "total_orders":
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValidationError("total_orders must be a non-negative integer.")

        elif field == "total_spent":
            try:
                value = Decimal(str(value))
            except Exception:
                raise ValidationError("total_spent must be a valid amount.")

            if not value.is_finite() or value < 0:
                raise ValidationError("total_spent must be a non-negative amount.")

        if operator not in {
            "equals", "not_equals", "gt", "gte", "lt", "lte"
        }:
            raise ValidationError(
                f"Unsupported operator: {operator}."
            )

        # Text and boolean fields support equality only.
        if field in {"lifecycle_stage", "is_active"} and operator not in {
            "equals", "not_equals"
        }:
            raise ValidationError(
                f"{operator} is not supported for {field}."
            )

        lookup_map = {
            "equals": "",
            "not_equals": "",
            "gt": "__gt",
            "gte": "__gte",
            "lt": "__lt",
            "lte": "__lte",
        }

        condition_query = Q(
            **{f"{field}{lookup_map[operator]}": value}
        )

        if operator == "not_equals":
            condition_query = ~condition_query

        if query is None:
            query = condition_query
        elif match_type == "all":
            query &= condition_query
        else:
            query |= condition_query

    return queryset.filter(query)


class CustomerListCreateView(generics.ListCreateAPIView):

    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsSalesWriteOrSupportReadOnly]

    def get_queryset(self):
        return Customer.objects.filter(
            organization=self.request.user.organization
        ).order_by("-created_at")


    @transaction.atomic
    def perform_create(self, serializer):
        customer = serializer.save(
            organization=self.request.user.organization
        )

        create_audit_log(
            organization=customer.organization,
            user=self.request.user,
            action="CREATE",
            entity_type="Customer",
            entity_id=customer.id,
            description=(
                f"Created customer "
                f"{customer.first_name} {customer.last_name}"
            ),
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )


class CustomerDetailView(generics.RetrieveUpdateDestroyAPIView):

    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsSalesWriteOrSupportReadOnly]

    def get_queryset(self):
        return Customer.objects.filter(
            organization=self.request.user.organization
        )

class InteractionListCreateView(generics.ListCreateAPIView):

    serializer_class = InteractionSerializer
    permission_classes = [IsAuthenticated, IsInteractionAllowed]

    def get_queryset(self):
        return Interaction.objects.filter(
            organization=self.request.user.organization
        ).select_related(
            "customer",
            "created_by",
        )

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        if not user.organization:
            raise PermissionDenied("User is not assigned to an organization.")

        customer_id = self.request.data.get("customer")
        try:
            customer = Customer.objects.get(id=customer_id, organization=user.organization)
        except (Customer.DoesNotExist, TypeError, ValueError):
            raise PermissionDenied("Customer does not belong to your organization.")

        interaction = serializer.save(
            customer=customer,
            organization=user.organization,
            created_by=user,
        )
        create_audit_log(
            organization=interaction.organization,
            user=user,
            action="CREATE",
            entity_type="Interaction",
            entity_id=interaction.id,
            description=f"Created interaction: {interaction.subject}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )


class InteractionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InteractionSerializer
    permission_classes = [IsAuthenticated, IsInteractionAllowed]

    def get_queryset(self):
        return Interaction.objects.filter(
            organization=self.request.user.organization
        ).select_related("customer", "created_by")

    @transaction.atomic
    def perform_update(self, serializer):
        interaction = serializer.save()
        create_audit_log(
            organization=interaction.organization,
            user=self.request.user,
            action="UPDATE",
            entity_type="Interaction",
            entity_id=interaction.id,
            description=f"Updated interaction: {interaction.subject}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )

    @transaction.atomic
    def perform_destroy(self, instance):
        interaction_id = instance.id
        subject = instance.subject
        organization = instance.organization
        create_audit_log(
            organization=organization,
            user=self.request.user,
            action="DELETE",
            entity_type="Interaction",
            entity_id=interaction_id,
            description=f"Deleted interaction: {subject}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )
        instance.delete()

class OrderListCreateView(generics.ListCreateAPIView):

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsSalesWriteOrSupportReadOnly]

    def get_queryset(self):
        return Order.objects.filter(
            organization=self.request.user.organization
        ).select_related(
            "customer"
        )

        
    def perform_create(self, serializer):
        user = self.request.user

        if not user.organization_id:
            raise serializers.ValidationError({
                "organization": "Your account is not assigned to an organization."
            })

        customer = serializer.validated_data.get("customer")

        # Ensure the customer belongs to the same organization.
        if customer and customer.organization_id != user.organization_id:
            raise serializers.ValidationError({
                "customer": "The customer must belong to your organization."
            })

        order = serializer.save(
            customer=customer,
            organization=user.organization,
        )

        update_customer_lifecycle(order.customer)

        create_audit_log(
            organization=order.organization,
            user=user,
            action="CREATE",
            entity_type="Order",
            entity_id=order.id,
            description=f"Created order {order.order_number}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )


class OrderDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsSalesWriteOrSupportReadOnly]
    lookup_field = "order_number"
    lookup_url_kwarg = "order_number"

    def get_queryset(self):
        return Order.objects.filter(
            organization=self.request.user.organization
        ).select_related(
            "customer"
        )
    
    def perform_update(self, serializer):
        order = serializer.save()
        update_customer_lifecycle(order.customer)
        create_audit_log(
            organization=order.organization,
            user=self.request.user,
            action="UPDATE",
            entity_type="Order",
            entity_id=order.id,
            description=f"Updated order {order.order_number}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )

    def perform_destroy(self, instance):
        # Storefront orders are a customer-visible audit trail; cancel/update them
        # rather than hard-deleting them from CRM.
        if instance.source_user_id:
            raise ValidationError({"detail": "Storefront-created orders cannot be deleted. Update the order status to Cancelled instead."})
        customer = instance.customer
        order_id = instance.id
        order_number = instance.order_number
        organization = instance.organization
        instance.delete()
        update_customer_lifecycle(customer)
        create_audit_log(
            organization=organization,
            user=self.request.user,
            action="DELETE",
            entity_type="Order",
            entity_id=order_id,
            description=f"Deleted order {order_number}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )


class SegmentListCreateView(generics.ListCreateAPIView):

    serializer_class = SegmentSerializer
    permission_classes = [IsAuthenticated, IsSegmentAllowed]

    def get_queryset(self):
        return Segment.objects.filter(
            organization=self.request.user.organization
        ).prefetch_related(
            "customers"
        )

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        if not user.organization:
            raise PermissionDenied("User is not assigned to an organization.")

        segment = serializer.save(
            organization=user.organization,
            created_by=user,
        )
        create_audit_log(
            organization=segment.organization,
            user=user,
            action="CREATE",
            entity_type="Segment",
            entity_id=segment.id,
            description=f"Created segment: {segment.name}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )


class SegmentDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = SegmentSerializer
    permission_classes = [IsAuthenticated, IsSegmentAllowed]

    def get_queryset(self):
        return Segment.objects.filter(
            organization=self.request.user.organization
        ).prefetch_related(
            "customers"
        )

    def perform_update(self, serializer):
        segment = serializer.save()

        create_audit_log(
            organization=segment.organization,
            user=self.request.user,
            action="UPDATE",
            entity_type="Segment",
            entity_id=segment.id,
            description=f"Updated segment: {segment.name}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )

class SegmentPreviewView(APIView):
    permission_classes = [IsAuthenticated, IsSegmentAllowed]

    def get(self, request, pk):
        try:
            segment = Segment.objects.get(
                pk=pk,
                organization=request.user.organization,
            )
        except Segment.DoesNotExist:
            return Response(
                {"detail": "Segment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if segment.segment_type != Segment.SegmentType.DYNAMIC:
            return Response(
                {
                    "detail": (
                        "Preview is available only for "
                        "dynamic segments."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        customers = get_dynamic_segment_customers(
            segment
        )

        serializer = CustomerSerializer(
            customers,
            many=True,
            context={"request": request},
        )

        return Response({
            "segment_id": segment.id,
            "segment_name": segment.name,
            "matching_customer_count": customers.count(),
            "customers": serializer.data,
        })


class CampaignListCreateView(generics.ListCreateAPIView):

    serializer_class = CampaignSerializer
    permission_classes = [IsAuthenticated, IsCampaignAllowed]

    def get_queryset(self):
        return Campaign.objects.filter(
            organization=self.request.user.organization
        ).select_related(
            "segment",
            "created_by",
        ).prefetch_related(
            "segment__customers"
        )

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        if not user.organization:
            raise PermissionDenied("User is not assigned to an organization.")

        segment_id = self.request.data.get("segment")
        try:
            segment = Segment.objects.get(id=segment_id, organization=user.organization)
        except (Segment.DoesNotExist, TypeError, ValueError):
            raise PermissionDenied("Segment does not belong to your organization.")

        campaign = serializer.save(
            segment=segment,
            organization=user.organization,
            created_by=user,
        )
        create_audit_log(
            organization=campaign.organization,
            user=user,
            action="CREATE",
            entity_type="Campaign",
            entity_id=campaign.id,
            description=f"Created campaign: {campaign.name}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )


class CampaignDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = CampaignSerializer
    permission_classes = [IsAuthenticated, IsCampaignAllowed]

    def get_queryset(self):
        return Campaign.objects.filter(
            organization=self.request.user.organization
        ).select_related(
            "segment",
            "created_by",
        ).prefetch_related(
            "segment__customers"
        )

    def perform_update(self, serializer):
        campaign = serializer.save()

        create_audit_log(
            organization=campaign.organization,
            user=self.request.user,
            action="UPDATE",
            entity_type="Campaign",
            entity_id=campaign.id,
            description=f"Updated campaign: {campaign.name}",
            ip_address=self.request.META.get("REMOTE_ADDR"),
        )

class CampaignResponseListCreateView(
    generics.ListCreateAPIView
):

    serializer_class = CampaignResponseSerializer
    permission_classes = [IsAuthenticated, IsCampaignAllowed]

    def get_queryset(self):
        return CampaignResponse.objects.filter(
            organization=self.request.user.organization
        ).select_related(
            "campaign",
            "customer",
        )

    def perform_create(self, serializer):

        user = self.request.user

        if not user.organization:
            raise PermissionDenied(
                "User is not assigned to an organization."
            )

        campaign_id = self.request.data.get("campaign")
        customer_id = self.request.data.get("customer")

        try:
            campaign = Campaign.objects.get(
                id=campaign_id,
                organization=user.organization
            )
        except Campaign.DoesNotExist:
            raise PermissionDenied(
                "Campaign does not belong to your organization."
            )

        try:
            customer = Customer.objects.get(
                id=customer_id,
                organization=user.organization
            )
        except Customer.DoesNotExist:
            raise PermissionDenied(
                "Customer does not belong to your organization."
            )

        if not campaign.segment.customers.filter(
            id=customer.id
        ).exists():
            raise PermissionDenied(
                "Customer does not belong to the campaign segment."
            )

        serializer.save(
            campaign=campaign,
            customer=customer,
            organization=user.organization,
        )


class CampaignResponseDetailView(
    generics.RetrieveUpdateDestroyAPIView
):

    serializer_class = CampaignResponseSerializer
    permission_classes = [IsAuthenticated, IsCampaignAllowed]

    def get_queryset(self):
        return CampaignResponse.objects.filter(
            organization=self.request.user.organization
        ).select_related(
            "campaign",
            "customer",
        )

class AnalyticsView(generics.GenericAPIView):
    """Organization-scoped aggregate analytics.

    Orders and campaign responses are filtered to the requested date range.
    Customer lifecycle totals are a current snapshot; new_customers is period-filtered.
    Campaign counts use campaign creation date. This endpoint intentionally returns
    aggregate KPIs only; it does not provide a daily/weekly/monthly time series.
    """
    permission_classes = [IsAuthenticated, IsAdminOrManagement]
    serializer_class = AnalyticsSerializer

    def get(self, request):
        organization = request.user.organization
        if not organization:
            raise PermissionDenied("User is not assigned to an organization.")

        start_date_value = request.query_params.get("start_date")
        end_date_value = request.query_params.get("end_date")
        today = timezone.localdate()
        default_start = today - timedelta(days=29)

        try:
            start_date = date.fromisoformat(start_date_value) if start_date_value else default_start
            end_date = date.fromisoformat(end_date_value) if end_date_value else today
        except ValueError:
            raise ValidationError("Dates must use YYYY-MM-DD format.")

        if start_date > end_date:
            raise ValidationError("start_date must be on or before end_date.")

        customers = Customer.objects.filter(organization=organization)
        new_customers = customers.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ).count()

        orders_in_period = Order.objects.filter(
            organization=organization,
            order_date__date__gte=start_date,
            order_date__date__lte=end_date,
        )
        delivered_orders_qs = orders_in_period.filter(status=Order.OrderStatus.DELIVERED)
        total_orders = orders_in_period.count()
        delivered_orders = delivered_orders_qs.count()
        cancelled_orders = orders_in_period.filter(status=Order.OrderStatus.CANCELLED).count()
        total_revenue = delivered_orders_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        average_order_value = (total_revenue / delivered_orders) if delivered_orders else Decimal("0.00")

        campaigns_in_period = Campaign.objects.filter(
            organization=organization,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        responses_in_period = CampaignResponse.objects.filter(
            organization=organization,
            response_date__date__gte=start_date,
            response_date__date__lte=end_date,
        )
        total_campaign_responses = responses_in_period.count()
        converted_responses = responses_in_period.filter(
            status=CampaignResponse.ResponseStatus.CONVERTED
        ).count()
        campaign_response_rate = (
            converted_responses / total_campaign_responses * 100
            if total_campaign_responses else 0
        )

        data = {
            "total_customers": customers.count(),
            "active_customers": customers.filter(is_active=True).count(),
            "new_customers": new_customers,
            "repeat_customers": customers.filter(lifecycle_stage=Customer.LifecycleStage.REPEAT).count(),
            "loyal_customers": customers.filter(lifecycle_stage=Customer.LifecycleStage.LOYAL).count(),
            "total_orders": total_orders,
            "delivered_orders": delivered_orders,
            "cancelled_orders": cancelled_orders,
            "total_revenue": total_revenue,
            "average_order_value": average_order_value,
            "total_campaigns": campaigns_in_period.count(),
            "completed_campaigns": campaigns_in_period.filter(status=Campaign.CampaignStatus.COMPLETED).count(),
            "total_campaign_responses": total_campaign_responses,
            "converted_responses": converted_responses,
            "campaign_response_rate": round(campaign_response_rate, 2),
        }
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)

class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [
        IsAuthenticated,
        IsAdminOrManagement,
    ]

    def get_queryset(self):
        queryset = AuditLog.objects.filter(
            organization=self.request.user.organization
        ).select_related("user")

        action = self.request.query_params.get("action")
        entity_type = self.request.query_params.get("entity_type")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")

        if action:
            valid_actions = AuditLog.ActionType.values
            if action not in valid_actions:
                raise ValidationError({
                    "action": "Invalid action."
                })
            queryset = queryset.filter(action=action)

        if entity_type:
            queryset = queryset.filter(
                entity_type__iexact=entity_type
            )

        try:
            if start_date:
                date.fromisoformat(start_date)
                queryset = queryset.filter(
                    created_at__date__gte=start_date
                )

            if end_date:
                date.fromisoformat(end_date)
                queryset = queryset.filter(
                    created_at__date__lte=end_date
                )
        except ValueError:
            raise ValidationError({
                "date": "Dates must use YYYY-MM-DD format."
            })

        if start_date and end_date and start_date > end_date:
            raise ValidationError({
                "date": "start_date must be on or before end_date."
            })

        return queryset


# ---------------------------------------------------------------------------
# Phase 21 — Product catalogue, categories and support ticket endpoints
# ---------------------------------------------------------------------------
from django.db import transaction as db_transaction
from django.conf import settings as django_settings
from django.db.models import Q as DjangoQ
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from .models import Category, Product, SupportTicket, SupportTicketMessage
from .serializers import CategorySerializer, ProductSerializer, SupportTicketSerializer, SupportTicketMessageSerializer
from crm.services import create_audit_log


class IsCatalogStaffAllowed(IsAuthenticated):
    """Read access for authenticated CRM staff; writes only for Admin/Sales (CRM Manager)."""
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return bool(user.is_superuser or user.role in {"ADMIN", "SALES"})


class IsSupportStaffAllowed(IsAuthenticated):
    """CRM roles may view support tickets; Admin, Sales and Support may mutate them."""
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return bool(user.is_superuser or user.role in {"ADMIN", "SALES", "SUPPORT"})


def _require_organization(request):
    organization = getattr(request.user, "organization", None)
    if organization is None:
        raise PermissionDenied("Your staff account is not linked to an organization. Ask an administrator to configure it.")
    return organization


def _record_api_audit(request, action, entity_type, entity_id, description):
    organization = getattr(request.user, "organization", None)
    if organization:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
        ip_address = forwarded or request.META.get("REMOTE_ADDR")
        try:
            create_audit_log(organization, request.user, action, entity_type, entity_id, description, ip_address)
        except Exception:
            # Audit logging must not turn a successful catalogue write into a failed response.
            pass


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsCatalogStaffAllowed]

    def get_queryset(self):
        organization = _require_organization(self.request)
        queryset = Category.objects.filter(organization=organization)
        include_inactive = str(self.request.query_params.get("includeInactive", "false")).lower() in {"true", "1", "yes"}
        if not include_inactive:
            queryset = queryset.filter(is_active=True)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset.order_by("name")

    def perform_create(self, serializer):
        category = serializer.save(organization=_require_organization(self.request))
        _record_api_audit(self.request, "CREATE", "Category", category.id, f"Created category '{category.name}'.")


class CategoryStatusView(APIView):
    permission_classes = [IsCatalogStaffAllowed]

    def patch(self, request, pk):
        organization = _require_organization(request)
        category = get_object_or_404(Category, pk=pk, organization=organization)
        active = request.data.get("active")
        if not isinstance(active, bool):
            raise ValidationError({"active": "Expected true or false."})
        if not active and category.products.filter(status="Active").exists():
            # Keeping the category inactive is allowed; storefront queries will hide products under it.
            pass
        category.is_active = active
        category.save(update_fields=["is_active", "updated_at"])
        _record_api_audit(request, "UPDATE", "Category", category.id, f"Set category '{category.name}' active={active}.")
        return Response(CategorySerializer(category).data)


class ProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsCatalogStaffAllowed]

    def get_queryset(self):
        organization = _require_organization(self.request)
        queryset = Product.objects.filter(organization=organization).select_related("category")
        include_inactive = str(self.request.query_params.get("includeInactive", "false")).lower() in {"true", "1", "yes"}
        if not include_inactive:
            queryset = queryset.filter(status="Active", category__is_active=True)
        status_filter = self.request.query_params.get("status", "All")
        if status_filter and status_filter != "All":
            queryset = queryset.filter(status=status_filter)
        category_filter = self.request.query_params.get("category", "All")
        if category_filter and category_filter != "All":
            queryset = queryset.filter(category__name__iexact=category_filter)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                DjangoQ(name__icontains=search) | DjangoQ(sku__icontains=search)
                | DjangoQ(brand__icontains=search) | DjangoQ(category__name__icontains=search)
            )
        return queryset.order_by("name")

    def perform_create(self, serializer):
        organization = _require_organization(self.request)
        product = serializer.save(organization=organization)
        if product.stock > 0:
            _StockMovement.objects.create(
                organization=organization, product=product, actor=self.request.user,
                movement_type="RESTOCK", quantity_delta=product.stock,
                stock_before=0, stock_after=product.stock,
                reason="Opening stock recorded when product was created.",
            )
        _record_api_audit(self.request, "CREATE", "Product", product.id, f"Created product '{product.name}' ({product.sku}).")


class ProductDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsCatalogStaffAllowed]
    lookup_field = "pk"

    def get_queryset(self):
        return Product.objects.filter(organization=_require_organization(self.request)).select_related("category")

    def perform_update(self, serializer):
        previous_stock = serializer.instance.stock
        product = serializer.save()
        if previous_stock != product.stock:
            _StockMovement.objects.create(
                organization=product.organization, product=product, actor=self.request.user,
                movement_type="COUNT_CORRECTION", quantity_delta=product.stock - previous_stock,
                stock_before=previous_stock, stock_after=product.stock,
                reason="Stock quantity changed in Product Management.",
            )
        _record_api_audit(self.request, "UPDATE", "Product", product.id, f"Updated product '{product.name}'.")


class ProductStatusView(APIView):
    permission_classes = [IsCatalogStaffAllowed]

    def patch(self, request, pk):
        organization = _require_organization(request)
        product = get_object_or_404(Product.objects.select_related("category"), pk=pk, organization=organization)
        next_status = request.data.get("status")
        allowed = {value for value, _ in Product.ProductStatus.choices}
        if next_status not in allowed:
            raise ValidationError({"status": f"Choose one of: {', '.join(sorted(allowed))}."})
        if next_status == "Active" and not product.category.is_active:
            raise ValidationError({"status": "Activate this product's category before publishing it."})
        product.status = next_status
        product.save(update_fields=["status", "updated_at"])
        _record_api_audit(request, "UPDATE", "Product", product.id, f"Changed product status to {next_status}.")
        return Response(ProductSerializer(product).data)


def _public_store_organization_id(request):
    """Scope public storefront reads to one configured organization, never a client-selected tenant."""
    configured = getattr(django_settings, "STOREFRONT_ORGANIZATION_ID", None)
    if configured and str(configured).isdigit():
        return int(configured)
    # Safe single-store development fallback: never blend or client-select tenant catalogues.
    return Category.objects.order_by("organization_id").values_list("organization_id", flat=True).first()


class StorefrontCategoryListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Public responses deliberately expose active categories only.
        organization_id = _public_store_organization_id(request)
        queryset = Category.objects.filter(is_active=True)
        queryset = queryset.filter(organization_id=organization_id) if organization_id else queryset.none()
        data = CategorySerializer(queryset.order_by("name"), many=True).data
        return Response(data)


class StorefrontProductListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Public route can only return published items from active categories.
        queryset = Product.objects.filter(status="Active", category__is_active=True).select_related("category")
        organization_id = _public_store_organization_id(request)
        queryset = queryset.filter(organization_id=organization_id) if organization_id else queryset.none()
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                DjangoQ(name__icontains=search) | DjangoQ(brand__icontains=search)
                | DjangoQ(category__name__icontains=search)
            )
        category_filter = request.query_params.get("category", "All")
        if category_filter and category_filter != "All":
            queryset = queryset.filter(category__name__iexact=category_filter)
        return Response(ProductSerializer(queryset.order_by("name"), many=True).data)


class SupportTicketListCreateView(generics.ListCreateAPIView):
    serializer_class = SupportTicketSerializer
    permission_classes = [IsSupportStaffAllowed]

    def get_queryset(self):
        organization = _require_organization(self.request)
        queryset = SupportTicket.objects.filter(organization=organization).prefetch_related("messages")
        for field in ("status", "priority", "category"):
            value = self.request.query_params.get(field)
            if value and value != "All":
                queryset = queryset.filter(**{field: value})
        assigned_to = self.request.query_params.get("assignedTo") or self.request.query_params.get("assigned_to")
        if assigned_to and assigned_to != "All":
            queryset = queryset.filter(assigned_to=assigned_to)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                DjangoQ(ticket_code__icontains=search) | DjangoQ(subject__icontains=search)
                | DjangoQ(customer_name__icontains=search) | DjangoQ(customer_email__icontains=search)
                | DjangoQ(order_id__icontains=search) | DjangoQ(description__icontains=search)
            )
        return queryset.order_by("-updated_at")

    @db_transaction.atomic
    def perform_create(self, serializer):
        organization = _require_organization(self.request)
        ticket = serializer.save(organization=organization, created_by=self.request.user)
        customer = Customer.objects.filter(organization=organization, email__iexact=ticket.customer_email).first()
        if customer:
            ticket.customer = customer
            ticket.save(update_fields=["customer", "updated_at"])
        now = timezone.now().isoformat()
        ticket.status_history = [{"id": f"{ticket.ticket_code}-H1", "type": "Created", "from": "", "to": "Open", "by": ticket.customer_name, "at": now}]
        ticket.save(update_fields=["status_history", "updated_at"])
        SupportTicketMessage.objects.create(
            ticket=ticket, author_name=ticket.customer_name, text=ticket.description,
            is_internal=False, is_initial_request=True,
        )
        _record_api_audit(self.request, "CREATE", "SupportTicket", ticket.ticket_code, f"Created support ticket '{ticket.subject}'.")
        _create_staff_notification(organization, f"New support ticket: {ticket.ticket_code}", f"{ticket.customer_name} submitted ‘{ticket.subject}’.", notification_type="support", source="support-ticket", metadata={"ticketId": ticket.ticket_code}, created_by=self.request.user)


class SupportTicketDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = SupportTicketSerializer
    permission_classes = [IsSupportStaffAllowed]
    lookup_field = "ticket_code"
    lookup_url_kwarg = "ticket_id"

    def get_queryset(self):
        return SupportTicket.objects.filter(organization=_require_organization(self.request)).prefetch_related("messages")

    def perform_update(self, serializer):
        ticket = serializer.instance
        old_values = {"status": ticket.status, "priority": ticket.priority, "assigned_to": ticket.assigned_to}
        new_status = serializer.validated_data.get("status", ticket.status)
        transitions = {
            "Open": {"In Progress", "Waiting on Customer", "Resolved", "Closed"},
            "In Progress": {"Open", "Waiting on Customer", "Resolved", "Closed"},
            "Waiting on Customer": {"Open", "In Progress", "Resolved", "Closed"},
            "Resolved": {"Open", "Closed"},
            "Closed": {"Open"},
        }
        if new_status != ticket.status and new_status not in transitions.get(ticket.status, set()):
            raise ValidationError({"status": f"Cannot move a ticket from {ticket.status} to {new_status}."})
        updated = serializer.save()
        now = timezone.now().isoformat()
        history = list(updated.status_history or [])
        for field, history_type in (("status", "Status"), ("priority", "Priority"), ("assigned_to", "Assignment")):
            next_value = getattr(updated, field)
            previous_value = old_values[field]
            if next_value != previous_value:
                history.append({
                    "id": f"{updated.ticket_code}-H{len(history) + 1}",
                    "type": history_type,
                    "from": previous_value,
                    "to": next_value,
                    "by": self.request.user.email,
                    "at": now,
                })
        updated.status_history = history
        updated.save(update_fields=["status_history", "updated_at"])
        _record_api_audit(self.request, "UPDATE", "SupportTicket", updated.ticket_code, f"Updated support ticket {updated.ticket_code}.")
        if any(old_values[field] != getattr(updated, field) for field in old_values):
            _create_staff_notification(_require_organization(self.request), f"Support ticket updated: {updated.ticket_code}", f"Ticket ‘{updated.subject}’ status is {updated.status} and priority is {updated.priority}.", notification_type="support", source="support-ticket-update", metadata={"ticketId": updated.ticket_code, "status": updated.status, "priority": updated.priority}, created_by=self.request.user)


class SupportTicketMessagesView(APIView):
    permission_classes = [IsSupportStaffAllowed]

    def post(self, request, ticket_id):
        organization = _require_organization(request)
        ticket = get_object_or_404(SupportTicket, organization=organization, ticket_code=ticket_id)
        text = str(request.data.get("text", "")).strip()
        is_internal = request.data.get("is_internal", request.data.get("isInternal", False))
        if not isinstance(is_internal, bool):
            raise ValidationError({"is_internal": "Expected true or false."})
        if not text or len(text) > 2000:
            raise ValidationError({"text": "Message must contain 1–2,000 characters."})
        if ticket.status == "Closed" and not is_internal:
            raise ValidationError({"detail": "This ticket is closed. Reopen it before replying to the customer."})
        message = SupportTicketMessage.objects.create(
            ticket=ticket, author=request.user, author_name=request.user.email,
            text=text, is_internal=is_internal, is_initial_request=False,
        )
        ticket.updated_at = timezone.now()
        history = list(ticket.status_history or [])
        history.append({
            "id": f"{ticket.ticket_code}-H{len(history) + 1}",
            "type": "Internal note" if is_internal else "Reply",
            "from": "", "to": "Staff only" if is_internal else "Customer visible",
            "by": request.user.email, "at": ticket.updated_at.isoformat(),
        })
        ticket.status_history = history
        ticket.save(update_fields=["updated_at", "status_history"])
        _record_api_audit(request, "UPDATE", "SupportTicket", ticket.ticket_code, "Added internal note." if is_internal else "Added customer-visible reply.")
        if not is_internal:
            _create_staff_notification(organization, f"Support reply: {ticket.ticket_code}", f"{request.user.email} replied to ‘{ticket.subject}’.", notification_type="support", source="support-reply", metadata={"ticketId": ticket.ticket_code}, created_by=request.user)
        return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)

# ---------------------------------------------------------------------------
# Phase 22 — Leads, banners and homepage promotion APIs
# ---------------------------------------------------------------------------

from datetime import date as _date
import uuid
from django.db.models import F as _F
from rest_framework.permissions import AllowAny as _AllowAny
from accounts.permissions import IsMarketingOrAdmin as _IsMarketingOrAdmin
from accounts.permissions import IsSalesWriteOrSupportReadOnly as _IsSalesWriteOrSupportReadOnly
from .models import Lead as _Lead, Banner as _Banner, HomepagePromotionSettings as _HomepagePromotionSettings
from .serializers import LeadSerializer as _LeadSerializer, BannerSerializer as _BannerSerializer, HomepagePromotionSettingsSerializer as _HomepagePromotionSettingsSerializer


class _IsLeadStaffAllowed(IsAuthenticated):
    """All CRM roles can read leads; Admin, Sales and Marketing can mutate them."""
    read_roles = {"ADMIN", "SALES", "MARKETING", "SUPPORT", "MANAGEMENT", "OPERATIONS"}
    write_roles = {"ADMIN", "SALES", "MARKETING"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.role == "ADMIN":
            return True
        if request.method in SAFE_METHODS:
            return user.role in self.read_roles
        return user.role in self.write_roles and request.method in {"POST", "PUT", "PATCH"}


class LeadListCreateView(generics.ListCreateAPIView):
    serializer_class = _LeadSerializer
    permission_classes = [IsAuthenticated, _IsLeadStaffAllowed]

    def get_queryset(self):
        organization = _require_organization(self.request)
        queryset = _Lead.objects.filter(organization=organization)
        for key in ("status", "source"):
            value = self.request.query_params.get(key)
            if value and value != "All":
                queryset = queryset.filter(**{key: value})
        assigned_to = self.request.query_params.get("assignedTo") or self.request.query_params.get("assigned_to")
        if assigned_to and assigned_to != "All":
            queryset = queryset.filter(assigned_to=assigned_to)
        start = self.request.query_params.get("from")
        end = self.request.query_params.get("to")
        if start:
            queryset = queryset.filter(created_at__date__gte=start)
        if end:
            queryset = queryset.filter(created_at__date__lte=end)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                DjangoQ(lead_code__icontains=search) | DjangoQ(name__icontains=search)
                | DjangoQ(email__icontains=search) | DjangoQ(phone__icontains=search)
                | DjangoQ(company__icontains=search) | DjangoQ(city__icontains=search)
            )
        return queryset.order_by("-created_at")

    @transaction.atomic
    def perform_create(self, serializer):
        organization = _require_organization(self.request)
        lead = serializer.save(organization=organization, created_by=self.request.user)
        lead.status_history = [{"status": lead.status, "at": timezone.now().isoformat(), "by": self.request.user.email}]
        lead.save(update_fields=["status_history", "updated_at"])
        _record_api_audit(self.request, "CREATE", "Lead", lead.lead_code, f"Created lead '{lead.name}'.")


class LeadDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = _LeadSerializer
    permission_classes = [IsAuthenticated, _IsLeadStaffAllowed]
    lookup_field = "lead_code"
    lookup_url_kwarg = "lead_id"

    def get_queryset(self):
        return _Lead.objects.filter(organization=_require_organization(self.request))

    @transaction.atomic
    def perform_update(self, serializer):
        lead = serializer.instance
        previous_status = lead.status
        previous_owner = lead.assigned_to
        updated = serializer.save()
        history = list(updated.status_history or [])
        now = timezone.now().isoformat()
        if updated.status != previous_status:
            history.append({"status": updated.status, "at": now, "by": self.request.user.email})
        if updated.assigned_to != previous_owner:
            history.append({"status": updated.status, "event": "Assignment", "from": previous_owner, "to": updated.assigned_to, "at": now, "by": self.request.user.email})
        updated.status_history = history
        updated.save(update_fields=["status_history", "updated_at"])
        _record_api_audit(self.request, "UPDATE", "Lead", updated.lead_code, f"Updated lead '{updated.name}'.")


class LeadFollowUpView(APIView):
    permission_classes = [IsAuthenticated, _IsLeadStaffAllowed]

    @transaction.atomic
    def post(self, request, lead_id):
        organization = _require_organization(request)
        lead = get_object_or_404(_Lead, organization=organization, lead_code=lead_id)
        if lead.status == _Lead.LeadStatus.CONVERTED:
            raise ValidationError("Converted leads are read-only.")
        summary = str(request.data.get("summary", "")).strip()
        followup_type = str(request.data.get("type", "Note")).strip()
        next_date = request.data.get("nextFollowUpAt") or None
        if not summary or len(summary) > 1000:
            raise ValidationError({"summary": "Enter a follow-up summary (up to 1,000 characters)."})
        if followup_type not in {"Call", "Email", "Meeting", "Note"}:
            raise ValidationError({"type": "Choose Call, Email, Meeting or Note."})
        if next_date:
            try:
                _date.fromisoformat(str(next_date))
            except ValueError:
                raise ValidationError({"nextFollowUpAt": "Use YYYY-MM-DD format."})
        now = timezone.now()
        entry = {
            "id": f"LFU-{uuid.uuid4().hex[:10].upper()}",
            "type": followup_type,
            "summary": summary,
            "at": now.isoformat(),
            "nextFollowUpAt": str(next_date or ""),
            "by": request.user.email,
        }
        lead.follow_ups = list(lead.follow_ups or []) + [entry]
        lead.next_follow_up_at = _date.fromisoformat(str(next_date)) if next_date else None
        if lead.status == _Lead.LeadStatus.NEW and followup_type != "Note":
            lead.status = _Lead.LeadStatus.CONTACTED
            lead.status_history = list(lead.status_history or []) + [{"status": "Contacted", "at": now.isoformat(), "by": request.user.email}]
        lead.save()
        _record_api_audit(request, "UPDATE", "Lead", lead.lead_code, "Added lead follow-up.")
        return Response({"lead": _LeadSerializer(lead, context={"request": request}).data, "followUp": entry}, status=status.HTTP_201_CREATED)


class LeadConvertView(APIView):
    permission_classes = [IsAuthenticated, _IsLeadStaffAllowed]

    @transaction.atomic
    def post(self, request, lead_id):
        organization = _require_organization(request)
        lead = get_object_or_404(_Lead.objects.select_for_update(), organization=organization, lead_code=lead_id)
        if lead.status == _Lead.LeadStatus.CONVERTED and lead.converted_customer_id:
            customer = lead.converted_customer
            return Response({"lead": _LeadSerializer(lead, context={"request": request}).data, "customer": {"id": customer.id, "name": str(customer), "email": customer.email}, "alreadyConverted": True})
        if lead.status == _Lead.LeadStatus.LOST:
            raise ValidationError("A lost lead cannot be converted. Reopen it before conversion.")
        customer = Customer.objects.filter(organization=organization, email__iexact=lead.email).first()
        if not customer:
            name_parts = lead.name.split()
            customer = Customer.objects.create(
                organization=organization,
                first_name=(name_parts[0] if name_parts else lead.name)[:100],
                last_name=" ".join(name_parts[1:])[:100],
                email=lead.email.lower(), phone=lead.phone,
                lifecycle_stage=Customer.LifecycleStage.CUSTOMER,
                is_active=True,
            )
        now = timezone.now()
        lead.status = _Lead.LeadStatus.CONVERTED
        lead.converted_customer = customer
        lead.converted_at = now
        lead.status_history = list(lead.status_history or []) + [{"status": "Converted", "at": now.isoformat(), "by": request.user.email}]
        lead.save()
        _record_api_audit(request, "UPDATE", "Lead", lead.lead_code, f"Converted lead to customer {customer.id}.")
        return Response({"lead": _LeadSerializer(lead, context={"request": request}).data, "customer": {"id": customer.id, "name": str(customer), "email": customer.email}, "alreadyConverted": False})


class BannerListCreateView(generics.ListCreateAPIView):
    serializer_class = _BannerSerializer
    permission_classes = [IsAuthenticated, _IsMarketingOrAdmin]

    def get_queryset(self):
        organization = _require_organization(self.request)
        queryset = _Banner.objects.filter(organization=organization)
        placement = self.request.query_params.get("placement")
        status_value = self.request.query_params.get("status")
        if placement and placement != "All": queryset = queryset.filter(placement=placement)
        if status_value and status_value != "All": queryset = queryset.filter(status=status_value)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(DjangoQ(name__icontains=search) | DjangoQ(title__icontains=search) | DjangoQ(eyebrow__icontains=search))
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        banner = serializer.save(organization=_require_organization(self.request), created_by=self.request.user)
        _record_api_audit(self.request, "CREATE", "Banner", banner.id, f"Created banner '{banner.name}'.")


class BannerDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = _BannerSerializer
    permission_classes = [IsAuthenticated, _IsMarketingOrAdmin]

    def get_queryset(self):
        return _Banner.objects.filter(organization=_require_organization(self.request))

    def perform_update(self, serializer):
        banner = serializer.save()
        _record_api_audit(self.request, "UPDATE", "Banner", banner.id, f"Updated banner '{banner.name}'.")


class BannerStatusView(APIView):
    permission_classes = [IsAuthenticated, _IsMarketingOrAdmin]

    def patch(self, request, pk):
        banner = get_object_or_404(_Banner, organization=_require_organization(request), pk=pk)
        next_status = str(request.data.get("status", ""))
        if next_status not in _Banner.BannerStatus.values:
            raise ValidationError({"status": "Status must be Draft, Active or Paused."})
        banner.status = next_status
        banner.save(update_fields=["status", "updated_at"])
        _record_api_audit(request, "UPDATE", "Banner", banner.id, f"Set banner status to {next_status}.")
        return Response(_BannerSerializer(banner).data)


def _homepage_promotion_defaults():
    return {
        "enabled": True,
        "selectionMode": "AUTO",
        "featuredProductIds": [],
        "sectionTitle": "Featured products",
        "subtitle": "Picked by our marketing team for your setup.",
        "updatedAt": None,
        "updatedBy": None,
    }


class HomepagePromotionSettingsView(APIView):
    permission_classes = [IsAuthenticated, _IsMarketingOrAdmin]

    def get(self, request):
        organization = _require_organization(request)
        settings_obj = _HomepagePromotionSettings.objects.filter(organization=organization).first()
        if not settings_obj:
            return Response(_homepage_promotion_defaults())
        return Response(_HomepagePromotionSettingsSerializer(settings_obj, context={"request": request}).data)

    @transaction.atomic
    def put(self, request):
        return self._save(request)

    @transaction.atomic
    def patch(self, request):
        return self._save(request)

    def _save(self, request):
        organization = _require_organization(request)
        settings_obj = _HomepagePromotionSettings.objects.filter(organization=organization).first()
        serializer = _HomepagePromotionSettingsSerializer(
            settings_obj, data=request.data, partial=(request.method == "PATCH"), context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        saved = serializer.save(organization=organization, updated_by=request.user)
        _record_api_audit(request, "UPDATE", "HomepagePromotionSettings", organization.id, "Updated homepage promotion settings.")
        return Response(_HomepagePromotionSettingsSerializer(saved, context={"request": request}).data)


class StorefrontBannerListView(APIView):
    permission_classes = [_AllowAny]

    def get(self, request):
        organization_id = _public_store_organization_id(request)
        # Banner start/end dates are selected in the India-based storefront UI.
        # Use the storefront's local calendar date rather than the server's UTC date.
        today = timezone.localdate(timezone=ZoneInfo("Asia/Kolkata"))
        queryset = _Banner.objects.filter(status="Active", start_date__lte=today, end_date__gte=today)
        queryset = queryset.filter(organization_id=organization_id) if organization_id else queryset.none()
        placement = request.query_params.get("placement", "All")
        if placement and placement != "All": queryset = queryset.filter(placement=placement)
        return Response(_BannerSerializer(queryset.order_by("-created_at"), many=True).data)


class StorefrontBannerMetricView(APIView):
    permission_classes = [_AllowAny]

    def post(self, request, pk, metric):
        organization_id = _public_store_organization_id(request)
        today = timezone.localdate(timezone=ZoneInfo("Asia/Kolkata"))
        if metric not in {"impression", "click"}:
            return Response({"detail": "Unsupported metric."}, status=status.HTTP_404_NOT_FOUND)
        field = "impressions" if metric == "impression" else "clicks"
        changed = _Banner.objects.filter(
            pk=pk, organization_id=organization_id, status="Active",
            start_date__lte=today, end_date__gte=today,
        ).update(**{field: _F(field) + 1}) if organization_id else 0
        if not changed:
            return Response({"detail": "Active banner not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class StorefrontHomepagePromotionSettingsView(APIView):
    permission_classes = [_AllowAny]

    def get(self, request):
        organization_id = _public_store_organization_id(request)
        settings_obj = _HomepagePromotionSettings.objects.filter(organization_id=organization_id).first() if organization_id else None
        if not settings_obj:
            return Response(_homepage_promotion_defaults())
        data = _HomepagePromotionSettingsSerializer(settings_obj).data
        return Response(data)

# ---------------------------------------------------------------------------
# Phase 23 — Storefront settings, communications and notifications APIs
# ---------------------------------------------------------------------------

from django.utils.dateparse import parse_datetime as _parse_datetime
from rest_framework.exceptions import ValidationError as _ValidationError
from accounts.permissions import IsAdmin as _IsAdmin
from .models import (
    StorefrontSettings as _StorefrontSettings,
    CommunicationTemplate as _CommunicationTemplate,
    CommunicationLog as _CommunicationLog,
    Notification as _Notification,
)
from .serializers import (
    CommunicationTemplateSerializer as _CommunicationTemplateSerializer,
    CommunicationLogSerializer as _CommunicationLogSerializer,
    NotificationSerializer as _NotificationSerializer,
)


class _IsCommunicationStaffAllowed(IsAuthenticated):
    """All CRM roles can read; authorized CRM teams can manage communications."""
    read_roles = {"ADMIN", "SALES", "MARKETING", "SUPPORT", "MANAGEMENT", "OPERATIONS"}
    write_roles = {"ADMIN", "SALES", "MARKETING", "SUPPORT"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.role == "ADMIN":
            return True
        if request.method in SAFE_METHODS:
            return user.role in self.read_roles
        return user.role in self.write_roles and request.method in {"POST", "PUT", "PATCH", "DELETE"}


class StorefrontSettingsView(APIView):
    """Protected CRUD for the current organization's public-store settings."""
    permission_classes = [IsAuthenticated, _IsAdmin]

    def get(self, request):
        organization = _require_organization(request)
        record = _StorefrontSettings.objects.filter(organization=organization).first()
        return Response(record.data if record and isinstance(record.data, dict) else {})

    def put(self, request):
        return self._save(request)

    def patch(self, request):
        return self._save(request)

    def _save(self, request):
        organization = _require_organization(request)
        payload = request.data
        if not isinstance(payload, dict):
            raise _ValidationError({"detail": "Storefront settings must be a JSON object."})
        if len(str(payload)) > 1_800_000:
            raise _ValidationError({"detail": "Settings payload is too large. Store the logo in media storage instead of embedding a large image."})
        existing = _StorefrontSettings.objects.filter(organization=organization).first()
        if request.method == "PATCH" and existing:
            payload = {**(existing.data or {}), **payload}
        record, _ = _StorefrontSettings.objects.update_or_create(
            organization=organization,
            defaults={"data": payload, "updated_by": request.user},
        )
        _record_api_audit(request, "UPDATE", "StorefrontSettings", record.pk, "Updated storefront settings.")
        return Response(record.data)


class StorefrontPublicSettingsView(APIView):
    permission_classes = [_AllowAny]

    def get(self, request):
        organization_id = _public_store_organization_id(request)
        record = _StorefrontSettings.objects.filter(organization_id=organization_id).first() if organization_id else None
        return Response(record.data if record and isinstance(record.data, dict) else {})


class CommunicationTemplateListCreateView(generics.ListCreateAPIView):
    serializer_class = _CommunicationTemplateSerializer
    permission_classes = [IsAuthenticated, _IsCommunicationStaffAllowed]

    def get_queryset(self):
        organization = _require_organization(self.request)
        queryset = _CommunicationTemplate.objects.filter(organization=organization)
        channel = self.request.query_params.get("channel")
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("search", "").strip()
        if channel and channel != "All": queryset = queryset.filter(channel=channel)
        if status_value and status_value != "All": queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(DjangoQ(name__icontains=search) | DjangoQ(subject__icontains=search) | DjangoQ(body__icontains=search) | DjangoQ(category__icontains=search))
        return queryset.order_by("-updated_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = _require_organization(self.request)
        return context

    def perform_create(self, serializer):
        template = serializer.save(organization=_require_organization(self.request), created_by=self.request.user, updated_by=self.request.user)
        _record_api_audit(self.request, "CREATE", "CommunicationTemplate", template.pk, f"Created communication template '{template.name}'.")


class CommunicationTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = _CommunicationTemplateSerializer
    permission_classes = [IsAuthenticated, _IsCommunicationStaffAllowed]

    def get_queryset(self):
        return _CommunicationTemplate.objects.filter(organization=_require_organization(self.request))

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["organization"] = _require_organization(self.request)
        return context

    def perform_update(self, serializer):
        template = serializer.save(updated_by=self.request.user)
        _record_api_audit(self.request, "UPDATE", "CommunicationTemplate", template.pk, f"Updated communication template '{template.name}'.")

    def perform_destroy(self, instance):
        _record_api_audit(self.request, "DELETE", "CommunicationTemplate", instance.pk, f"Deleted communication template '{instance.name}'.")
        instance.delete()


class CommunicationHistoryListView(generics.ListAPIView):
    serializer_class = _CommunicationLogSerializer
    permission_classes = [IsAuthenticated, _IsCommunicationStaffAllowed]

    def get_queryset(self):
        organization = _require_organization(self.request)
        queryset = _CommunicationLog.objects.filter(organization=organization)
        channel = self.request.query_params.get("channel")
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("search", "").strip()
        if channel and channel != "All": queryset = queryset.filter(channel=channel)
        if status_value and status_value != "All": queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(DjangoQ(subject__icontains=search) | DjangoQ(body__icontains=search) | DjangoQ(audience__icontains=search) | DjangoQ(actor__icontains=search))
        return queryset.order_by("-created_at")[:300]


class CommunicationDispatchView(APIView):
    permission_classes = [IsAuthenticated, _IsCommunicationStaffAllowed]

    def post(self, request):
        organization = _require_organization(request)
        channel = str(request.data.get("channel", "In-app"))
        if channel not in _CommunicationTemplate.Channel.values:
            raise _ValidationError({"channel": "Choose In-app, Email or SMS."})
        subject = str(request.data.get("subject", "")).strip()
        body = str(request.data.get("body", "")).strip()
        if not subject or len(subject) > 160:
            raise _ValidationError({"subject": "Subject/title is required and must be 160 characters or fewer."})
        if len(body) < 5 or len(body) > 3000:
            raise _ValidationError({"body": "Message body must contain 5–3,000 characters."})
        audience_key = str(request.data.get("audience", "all"))
        audience_label = "All customers"
        recipient_count = Customer.objects.filter(organization=organization, is_active=True).count()
        if audience_key.startswith("segment:"):
            try:
                segment_id = int(audience_key.split(":", 1)[1])
            except (ValueError, IndexError):
                raise _ValidationError({"audience": "Choose a valid customer segment."})
            segment = get_object_or_404(Segment, organization=organization, pk=segment_id)
            audience_label = segment.name
            recipient_count = segment.customers.filter(is_active=True).count()
            audience_key = f"segment:{segment.pk}"
        scheduled_at = None
        raw_scheduled_at = str(request.data.get("scheduledAt", "") or "").strip()
        if raw_scheduled_at:
            scheduled_at = _parse_datetime(raw_scheduled_at)
            if scheduled_at is None:
                raise _ValidationError({"scheduledAt": "Choose a valid scheduled date and time."})
            if timezone.is_naive(scheduled_at):
                scheduled_at = timezone.make_aware(scheduled_at, timezone.get_current_timezone())
            if scheduled_at <= timezone.now():
                raise _ValidationError({"scheduledAt": "Scheduled time must be in the future."})
        template = None
        template_id = request.data.get("templateId")
        if template_id not in (None, "", False):
            try:
                template = get_object_or_404(_CommunicationTemplate, organization=organization, pk=int(template_id))
            except (ValueError, TypeError):
                raise _ValidationError({"templateId": "Choose a valid saved template."})
        status_label = "Scheduled" if scheduled_at else "Recorded (not sent)"
        entry = _CommunicationLog.objects.create(
            organization=organization,
            subject=subject,
            body=body,
            channel=channel,
            audience=audience_label,
            audience_key=audience_key,
            recipient_count=recipient_count,
            notification_type=str(request.data.get("type", "general"))[:20] or "general",
            status=status_label,
            scheduled_at=scheduled_at,
            sent_at=None,
            actor=request.user.email,
            template=template,
            created_by=request.user,
        )
        _record_api_audit(request, "CREATE", "CommunicationLog", entry.pk, f"Recorded a {channel} communication request; no delivery provider was invoked.")
        return Response(_CommunicationLogSerializer(entry).data, status=status.HTTP_201_CREATED)


def _frontend_role_for_backend(role):
    return {
        "SALES": "CRM_MANAGER", "MARKETING": "MARKETING_MANAGER",
        "SUPPORT": "SUPPORT_AGENT", "MANAGEMENT": "ANALYST",
    }.get(str(role or "").upper(), str(role or "").upper())


def _notification_is_visible_to_user(item, user):
    email = str(user.email or "").strip().lower()
    backend_role = str(user.role or "").strip().upper()
    frontend_role = _frontend_role_for_backend(backend_role)
    if item.recipient_email:
        return item.recipient_email.strip().lower() == email
    recipient_emails = [str(value).strip().lower() for value in (item.recipient_emails or [])]
    if recipient_emails:
        return email in recipient_emails
    recipient_roles = {str(value).strip().upper() for value in (item.recipient_roles or [])}
    if recipient_roles:
        return backend_role in recipient_roles or frontend_role in recipient_roles
    if item.recipient_role:
        return str(item.recipient_role).strip().upper() in {backend_role, frontend_role}
    return item.audience in {"crm", "all", ""}


def _create_staff_notification(organization, title, message, *, notification_type="support", link="/crm/support", source="system", metadata=None, created_by=None):
    """Persist a CRM-only notification; does not send email/SMS to customers."""
    return _Notification.objects.create(
        organization=organization,
        title=str(title)[:180],
        message=str(message)[:2000],
        notification_type=notification_type,
        audience="crm",
        link=link,
        source=source,
        metadata=metadata if isinstance(metadata, dict) else {},
        created_by=created_by,
    )


class NotificationListCreateView(APIView):
    permission_classes = [IsAuthenticated, _IsCommunicationStaffAllowed]

    def get(self, request):
        organization = _require_organization(request)
        records = list(_Notification.objects.filter(organization=organization).prefetch_related("read_by").order_by("-created_at")[:500])
        visible = [item for item in records if _notification_is_visible_to_user(item, request.user)]
        return Response(_NotificationSerializer(visible, many=True, context={"request": request}).data)

    def post(self, request):
        organization = _require_organization(request)
        title = str(request.data.get("title", "")).strip()
        message = str(request.data.get("message", "")).strip()
        if not title or not message:
            raise _ValidationError({"detail": "Both title and message are required."})
        if request.data.get("audience", "crm") not in {"crm", "all"}:
            raise _ValidationError({"audience": "This endpoint creates staff notifications only. Customer notifications require customer authentication."})
        recipient_emails = request.data.get("recipientEmails", [])
        recipient_roles = request.data.get("recipientRoles", [])
        if not isinstance(recipient_emails, list) or not isinstance(recipient_roles, list):
            raise _ValidationError({"detail": "recipientEmails and recipientRoles must be JSON arrays."})
        item = _Notification.objects.create(
            organization=organization, title=title[:180], message=message[:2000],
            notification_type=str(request.data.get("type", "general"))[:30], audience="crm",
            recipient_email=str(request.data.get("recipientEmail", "")).strip().lower(),
            recipient_emails=[str(value).strip().lower() for value in recipient_emails if str(value).strip()],
            recipient_role=str(request.data.get("recipientRole", "")).strip().upper(),
            recipient_roles=[str(value).strip().upper() for value in recipient_roles if str(value).strip()],
            link=str(request.data.get("link", ""))[:500],
            source=str(request.data.get("source", "system"))[:80],
            metadata=request.data.get("metadata", {}) if isinstance(request.data.get("metadata", {}), dict) else {},
            created_by=request.user,
        )
        _record_api_audit(request, "CREATE", "Notification", item.pk, f"Created CRM notification '{item.title}'.")
        return Response(_NotificationSerializer(item, context={"request": request}).data, status=status.HTTP_201_CREATED)


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated, _IsCommunicationStaffAllowed]

    def post(self, request, pk):
        organization = _require_organization(request)
        item = get_object_or_404(_Notification, organization=organization, pk=pk)
        if not _notification_is_visible_to_user(item, request.user):
            raise PermissionDenied("This notification is not addressed to your staff account.")
        item.read_by.add(request.user)
        return Response(_NotificationSerializer(item, context={"request": request}).data)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated, _IsCommunicationStaffAllowed]

    def post(self, request):
        organization = _require_organization(request)
        records = list(_Notification.objects.filter(organization=organization).order_by("-created_at")[:500])
        visible = [item for item in records if _notification_is_visible_to_user(item, request.user)]
        if visible:
            request.user.read_crm_notifications.add(*visible)
        return Response({"markedRead": len(visible)})

# ---------------------------------------------------------------------------
# Phase 24 — pseudonymous storefront behaviour APIs
# ---------------------------------------------------------------------------

from collections import defaultdict as _defaultdict
from datetime import timedelta as _timedelta
from decimal import Decimal as _Decimal
from .models import CustomerBehaviorEvent as _CustomerBehaviorEvent, Product as _Product
from .serializers import CustomerBehaviorEventInputSerializer as _CustomerBehaviorEventInputSerializer, ProductSerializer as _ProductSerializer


class StorefrontBehaviorEventView(APIView):
    """Public ingestion of scrubbed, pseudonymous storefront interaction events."""
    permission_classes = [_AllowAny]

    def post(self, request):
        organization_id = _public_store_organization_id(request)
        if not organization_id:
            return Response(
                {"detail": "The public storefront organization is not configured yet. Add an active category/product first."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = _CustomerBehaviorEventInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        # A client event ID is only an idempotency key. Date-range reporting uses
        # server-created timestamps, not a browser-supplied clock.
        event_id = data.pop("event_id")
        event, created = _CustomerBehaviorEvent.objects.get_or_create(
            organization_id=organization_id,
            event_id=event_id,
            defaults=data,
        )
        response_data = {
            "accepted": True,
            "duplicate": not created,
            "eventId": event.event_id,
            "createdAt": event.created_at.isoformat(),
        }
        return Response(response_data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class CustomerBehaviorAnalyticsView(APIView):
    """Organization-scoped analytics from stored anonymous behaviour events."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_superuser or request.user.role in {"ADMIN", "MANAGEMENT"}):
            raise PermissionDenied("Only Admin and Management roles may view customer behaviour analytics.")
        organization = _require_organization(request)
        try:
            days = int(request.query_params.get("days", "30"))
        except (TypeError, ValueError):
            raise ValidationError({"days": "Use a whole number between 1 and 90."})
        if not 1 <= days <= 90:
            raise ValidationError({"days": "Choose a period between 1 and 90 days."})
        events = list(
            _CustomerBehaviorEvent.objects.filter(
                organization=organization,
                created_at__gte=timezone.now() - _timedelta(days=days),
            ).order_by("-created_at")[:50000]
        )[::-1]
        return Response(_summarize_behavior_events(events, days))


def _summarize_behavior_events(events, days):
    product_metrics = _defaultdict(lambda: {
        "productId": "", "productName": "Unknown product", "category": "Other", "brand": "",
        "views": 0, "cartAdds": 0, "purchasedQuantity": 0, "totalRevenue": 0.0, "eventCount": 0,
    })
    search_metrics = {}
    journeys = {}
    for event in events:
        if event.event_type in {"product_view", "add_to_cart", "purchase"} and event.product_id:
            item = product_metrics[event.product_id]
            item["productId"] = event.product_id
            item["productName"] = event.product_name or item["productName"]
            item["category"] = event.product_category or item["category"]
            item["brand"] = event.product_brand or item["brand"]
            item["eventCount"] += 1
            if event.event_type == "product_view":
                item["views"] += 1
            elif event.event_type == "add_to_cart":
                item["cartAdds"] += max(1, int(event.quantity or 1))
            elif event.event_type == "purchase":
                item["purchasedQuantity"] += max(1, int(event.quantity or 1))
                item["totalRevenue"] += float(event.line_total or 0)
        if event.event_type == "search" and event.query:
            key = event.query.lower()
            item = search_metrics.setdefault(key, {"query": event.query, "searches": 0, "zeroResultSearches": 0, "linkedToProduct": 0})
            item["searches"] += 1
            if int(event.result_count or 0) == 0:
                item["zeroResultSearches"] += 1
            if event.previous_viewed_product_id:
                item["linkedToProduct"] += 1
            if event.previous_viewed_product_id:
                journey_key = f"{event.previous_viewed_product_id}::{key}"
                journey = journeys.setdefault(journey_key, {
                    "previousViewedProductId": event.previous_viewed_product_id,
                    "previousViewedProductName": event.previous_viewed_product_name or f"Product {event.previous_viewed_product_id}",
                    "query": event.query, "occurrences": 0, "zeroResultSearches": 0,
                })
                journey["occurrences"] += 1
                if int(event.result_count or 0) == 0:
                    journey["zeroResultSearches"] += 1

    def top_products(event_type, metric):
        current = _defaultdict(lambda: {"count": 0, "name": "", "category": "Other", "brand": ""})
        for event in events:
            if event.event_type != event_type or not event.product_id:
                continue
            row = current[event.product_id]
            row["count"] += (max(1, int(event.quantity or 1)) if metric in {"cartAdds", "purchasedQuantity"} else 1)
            row["name"] = event.product_name or row["name"]
            row["category"] = event.product_category or row["category"]
            row["brand"] = event.product_brand or row["brand"]
        return [
            {"productId": product_id, "productName": row["name"] or "Unknown product", "category": row["category"], "brand": row["brand"], metric: row["count"]}
            for product_id, row in sorted(current.items(), key=lambda pair: (-pair[1]["count"], pair[0]))[:8]
        ]

    unique_for = lambda event_type: len({e.visitor_id for e in events if e.event_type == event_type})
    total_views = sum(1 for e in events if e.event_type == "product_view")
    total_searches = sum(1 for e in events if e.event_type == "search")
    total_cart_adds = sum(1 for e in events if e.event_type == "add_to_cart")
    total_purchase_units = sum(max(1, int(e.quantity or 1)) for e in events if e.event_type == "purchase")
    unique_viewers = unique_for("product_view")
    unique_cart_visitors = unique_for("add_to_cart")
    checkout_visitors = unique_for("checkout_started")
    unique_purchasers = unique_for("purchase")
    adoption_products = []
    for item in product_metrics.values():
        row = dict(item)
        row["adoptionScore"] = row["views"] + row["cartAdds"] * 3 + row["purchasedQuantity"] * 6
        adoption_products.append(row)
    adoption_products.sort(key=lambda row: (-row["adoptionScore"], row["productName"].lower()))
    recent_events = []
    for event in reversed(events[-10:]):
        recent_events.append({
            "eventId": event.event_id,
            "timestamp": event.created_at.isoformat(),
            "eventType": event.event_type,
            "path": event.path,
            "productName": event.product_name,
            "query": event.query,
        })
    return {
        "periodDays": days,
        "eventCount": len(events),
        "totalViews": total_views,
        "totalSearches": total_searches,
        "totalCartAdds": total_cart_adds,
        "totalPurchaseUnits": total_purchase_units,
        "uniqueViewers": unique_viewers,
        "uniqueCartVisitors": unique_cart_visitors,
        "checkoutVisitors": checkout_visitors,
        "uniquePurchasers": unique_purchasers,
        "viewsToCartRate": round(unique_cart_visitors / unique_viewers * 1000) / 10 if unique_viewers else 0,
        "checkoutToPurchaseRate": round(unique_purchasers / checkout_visitors * 1000) / 10 if checkout_visitors else 0,
        "mostViewed": top_products("product_view", "views"),
        "mostAddedToCart": top_products("add_to_cart", "cartAdds"),
        "mostPurchased": top_products("purchase", "purchasedQuantity"),
        "popularSearches": sorted(search_metrics.values(), key=lambda row: (-row["searches"], row["query"].lower()))[:8],
        "searchAfterViews": sorted(journeys.values(), key=lambda row: (-row["occurrences"], row["query"].lower()))[:8],
        "adoptionProducts": adoption_products[:8],
        "recentEvents": recent_events,
    }


class StorefrontRecommendationsView(APIView):
    """Public, aggregate popularity/behaviour based product recommendations."""
    permission_classes = [_AllowAny]

    def get(self, request):
        organization_id = _public_store_organization_id(request)
        try:
            limit = int(request.query_params.get("limit", "8"))
        except (TypeError, ValueError):
            raise ValidationError({"limit": "Use a whole number between 1 and 12."})
        if not 1 <= limit <= 12:
            raise ValidationError({"limit": "Choose between 1 and 12 products."})
        if not organization_id:
            return Response({"items": [], "source": "popular-products", "eventCount": 0})

        products = list(_Product.objects.filter(
            organization_id=organization_id,
            status="Active",
            category__is_active=True,
            stock__gt=0,
        ).select_related("category"))
        if not products:
            return Response({"items": [], "source": "popular-products", "eventCount": 0})

        events = _CustomerBehaviorEvent.objects.filter(
            organization_id=organization_id,
            created_at__gte=timezone.now() - _timedelta(days=30),
            event_type__in=["product_view", "add_to_cart", "purchase"],
        ).values("product_id", "event_type", "quantity")
        scores = _defaultdict(lambda: {"views": 0, "cartAdds": 0, "purchased": 0})
        event_count = 0
        for event in events.iterator(chunk_size=1000):
            event_count += 1
            row = scores[str(event["product_id"])]
            if event["event_type"] == "product_view": row["views"] += 1
            elif event["event_type"] == "add_to_cart": row["cartAdds"] += max(1, int(event["quantity"] or 1))
            elif event["event_type"] == "purchase": row["purchased"] += max(1, int(event["quantity"] or 1))

        def product_score(product):
            metric = scores.get(str(product.pk), {})
            behaviour = metric.get("views", 0) + metric.get("cartAdds", 0) * 3 + metric.get("purchased", 0) * 6
            popular = float(product.rating or 0) * 10 + int(product.reviews or 0) * 0.01
            return (behaviour, popular)

        products.sort(key=lambda product: (*product_score(product), product.name.lower()), reverse=True)
        result = _ProductSerializer(products[:limit], many=True).data
        has_behaviour = any(any(score.values()) for score in scores.values())
        return Response({
            "items": result,
            "source": "storefront-behaviour" if has_behaviour else "catalogue-popularity-fallback",
            "periodDays": 30,
            "eventCount": event_count,
            "personalized": False,
        })


# ---------------------------------------------------------------------------
# Phase 25 — persistent storefront cart/wishlist and moderated reviews
# ---------------------------------------------------------------------------
from .models import StorefrontCart as _StorefrontCart, StorefrontCartItem as _StorefrontCartItem
from .models import StorefrontWishlistItem as _StorefrontWishlistItem, ProductReview as _ProductReview
from .serializers import (
    StorefrontCartSyncSerializer as _StorefrontCartSyncSerializer,
    StorefrontWishlistSyncSerializer as _StorefrontWishlistSyncSerializer,
    StorefrontProductReviewCreateSerializer as _StorefrontProductReviewCreateSerializer,
    StorefrontProductReviewSerializer as _StorefrontProductReviewSerializer,
    CRMProductReviewSerializer as _CRMProductReviewSerializer,
)
from django.db.models import Avg as _Phase25Avg, Count as _Phase25Count


def _phase25_visitor_id(value):
    import re
    value = str(value or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value):
        raise ValidationError({"visitor_id": "Use the pseudonymous visitor ID generated by this browser."})
    return value


def _phase25_storefront_org(request):
    organization_id = _public_store_organization_id(request)
    if not organization_id:
        return None
    return organization_id


def _phase25_cart_payload(cart):
    rows = []
    for item in cart.items.select_related("product", "product__category").all():
        product_data = _ProductSerializer(item.product).data
        rows.append({
            "product_id": item.product_id,
            "quantity": item.quantity,
            "product": product_data,
            "line_total": str(item.product.price * item.quantity),
        })
    return {"visitorId": cart.visitor_id, "items": rows, "updatedAt": cart.updated_at.isoformat()}


class StorefrontCartView(APIView):
    permission_classes = [_AllowAny]

    def get(self, request):
        organization_id = _phase25_storefront_org(request)
        if not organization_id:
            return Response({"items": [], "detail": "The storefront organization is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        visitor_id = _phase25_visitor_id(request.query_params.get("visitor_id"))
        cart, _ = _StorefrontCart.objects.get_or_create(organization_id=organization_id, visitor_id=visitor_id)
        return Response(_phase25_cart_payload(cart))

    def put(self, request):
        organization_id = _phase25_storefront_org(request)
        if not organization_id:
            return Response({"detail": "The storefront organization is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        serializer = _StorefrontCartSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        visitor_id = serializer.validated_data["visitor_id"]
        requested_items = serializer.validated_data["items"]
        product_ids = [row["product_id"] for row in requested_items]
        products = {product.pk: product for product in _Product.objects.filter(
            organization_id=organization_id, status="Active", category__is_active=True,
            pk__in=product_ids,
        ).select_related("category")}
        for row in requested_items:
            product = products.get(row["product_id"])
            if product is None:
                raise ValidationError({"items": f"Product {row['product_id']} is not currently available."})
            if product.stock < row["quantity"]:
                raise ValidationError({"items": f"Only {product.stock} unit(s) of {product.name} are in stock."})
        with transaction.atomic():
            cart, _ = _StorefrontCart.objects.select_for_update().get_or_create(organization_id=organization_id, visitor_id=visitor_id)
            cart.items.all().delete()
            _StorefrontCartItem.objects.bulk_create([
                _StorefrontCartItem(cart=cart, product=products[row["product_id"]], quantity=row["quantity"])
                for row in requested_items
            ])
            cart.save(update_fields=["updated_at"])
        cart.refresh_from_db()
        return Response(_phase25_cart_payload(cart))

    def delete(self, request):
        organization_id = _phase25_storefront_org(request)
        if not organization_id:
            return Response(status=status.HTTP_204_NO_CONTENT)
        visitor_id = _phase25_visitor_id(request.query_params.get("visitor_id"))
        _StorefrontCart.objects.filter(organization_id=organization_id, visitor_id=visitor_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StorefrontWishlistView(APIView):
    permission_classes = [_AllowAny]

    def _payload(self, organization_id, visitor_id):
        items = list(_StorefrontWishlistItem.objects.filter(
            organization_id=organization_id, visitor_id=visitor_id, product__status="Active", product__category__is_active=True
        ).select_related("product", "product__category"))
        return {"visitorId": visitor_id, "productIds": [item.product_id for item in items], "items": _ProductSerializer([item.product for item in items], many=True).data}

    def get(self, request):
        organization_id = _phase25_storefront_org(request)
        if not organization_id:
            return Response({"productIds": [], "items": []}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        visitor_id = _phase25_visitor_id(request.query_params.get("visitor_id"))
        return Response(self._payload(organization_id, visitor_id))

    def put(self, request):
        organization_id = _phase25_storefront_org(request)
        if not organization_id:
            return Response({"detail": "The storefront organization is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        serializer = _StorefrontWishlistSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        visitor_id = serializer.validated_data["visitor_id"]
        product_ids = serializer.validated_data["product_ids"]
        products = list(_Product.objects.filter(organization_id=organization_id, status="Active", category__is_active=True, pk__in=product_ids).select_related("category"))
        if len(products) != len(product_ids):
            raise ValidationError({"product_ids": "One or more products are unavailable or belong to another storefront."})
        with transaction.atomic():
            _StorefrontWishlistItem.objects.filter(organization_id=organization_id, visitor_id=visitor_id).delete()
            _StorefrontWishlistItem.objects.bulk_create([
                _StorefrontWishlistItem(organization_id=organization_id, visitor_id=visitor_id, product=product)
                for product in products
            ])
        return Response(self._payload(organization_id, visitor_id))


def _phase25_recalculate_product_rating(product):
    summary = _ProductReview.objects.filter(product=product, status=_ProductReview.ReviewStatus.APPROVED).aggregate(
        average=_Phase25Avg("rating"), count=_Phase25Count("id")
    )
    product.rating = round(float(summary["average"] or 0), 2)
    product.reviews = int(summary["count"] or 0)
    product.save(update_fields=["rating", "reviews", "updated_at"])


class StorefrontProductReviewsView(APIView):
    permission_classes = [_AllowAny]

    def get(self, request, product_id):
        organization_id = _phase25_storefront_org(request)
        if not organization_id:
            return Response({"items": [], "summary": {"rating": 0, "count": 0}}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        product = get_object_or_404(_Product.objects.select_related("category"), pk=product_id, organization_id=organization_id, status="Active", category__is_active=True)
        queryset = _ProductReview.objects.filter(product=product, status=_ProductReview.ReviewStatus.APPROVED)
        summary = queryset.aggregate(average=_Phase25Avg("rating"), count=_Phase25Count("id"))
        return Response({
            "items": _StorefrontProductReviewSerializer(queryset[:100], many=True).data,
            "summary": {"rating": round(float(summary["average"] or 0), 2), "count": int(summary["count"] or 0)},
        })

    def post(self, request, product_id):
        organization_id = _phase25_storefront_org(request)
        if not organization_id:
            return Response({"detail": "The storefront organization is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        product = get_object_or_404(_Product.objects.select_related("category"), pk=product_id, organization_id=organization_id, status="Active", category__is_active=True)
        serializer = _StorefrontProductReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if _ProductReview.objects.filter(organization_id=organization_id, product=product, visitor_id=data["visitor_id"]).exists():
            return Response({"detail": "A review has already been submitted for this product from this browser."}, status=status.HTTP_409_CONFLICT)
        try:
            review = _ProductReview.objects.create(
                organization_id=organization_id, product=product, visitor_id=data["visitor_id"],
                reviewer_name=data["reviewer_name"], rating=data["rating"], title=data["title"],
                comment=data["comment"], status=_ProductReview.ReviewStatus.PENDING, verified_purchase=False,
            )
        except Exception as exc:
            # Handles concurrent duplicate submissions without returning a database error page.
            if _ProductReview.objects.filter(organization_id=organization_id, product=product, visitor_id=data["visitor_id"]).exists():
                return Response({"detail": "A review has already been submitted for this product from this browser."}, status=status.HTTP_409_CONFLICT)
            raise exc
        return Response({"id": review.id, "status": review.status, "detail": "Review submitted and awaiting moderation."}, status=status.HTTP_201_CREATED)


class CRMProductReviewListView(generics.ListAPIView):
    serializer_class = _CRMProductReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not (user.is_superuser or user.role in {"ADMIN", "MARKETING", "MANAGEMENT"}):
            raise PermissionDenied("Only Admin, Marketing, or Management staff may moderate product reviews.")
        organization = _require_organization(self.request)
        queryset = _ProductReview.objects.filter(organization=organization).select_related("product")
        review_status = self.request.query_params.get("status", "PENDING").upper()
        if review_status != "ALL":
            allowed = {choice[0] for choice in _ProductReview.ReviewStatus.choices}
            if review_status not in allowed:
                raise ValidationError({"status": "Choose PENDING, APPROVED, REJECTED, or ALL."})
            queryset = queryset.filter(status=review_status)
        search = self.request.query_params.get("search", "").strip()[:100]
        if search:
            queryset = queryset.filter(
                DjangoQ(product__name__icontains=search) | DjangoQ(reviewer_name__icontains=search)
                | DjangoQ(title__icontains=search) | DjangoQ(comment__icontains=search)
            )
        return queryset[:500]


class CRMProductReviewStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        user = request.user
        if not (user.is_superuser or user.role in {"ADMIN", "MARKETING", "MANAGEMENT"}):
            raise PermissionDenied("Only Admin, Marketing, or Management staff may moderate product reviews.")
        organization = _require_organization(request)
        review = get_object_or_404(_ProductReview.objects.select_related("product"), pk=pk, organization=organization)
        next_status = str(request.data.get("status", "")).upper()
        if next_status not in {_ProductReview.ReviewStatus.APPROVED, _ProductReview.ReviewStatus.REJECTED, _ProductReview.ReviewStatus.PENDING}:
            raise ValidationError({"status": "Choose PENDING, APPROVED, or REJECTED."})
        review.status = next_status
        review.save(update_fields=["status", "updated_at"])
        _phase25_recalculate_product_rating(review.product)
        _record_api_audit(request, "UPDATE", "ProductReview", review.id, f"Changed product review status to {next_status}.")
        return Response(_CRMProductReviewSerializer(review).data)


# ---------------------------------------------------------------------------
# Phase 26 — inventory movements, discount coupons, and abandoned cart reporting
# ---------------------------------------------------------------------------
from datetime import timedelta as _Timedelta
from decimal import Decimal as _Decimal, ROUND_HALF_UP as _ROUND_HALF_UP
from django.db import transaction as _Transaction
from django.db.models import Q as _Q
from rest_framework.permissions import AllowAny as _AllowAny
from .models import (
    StockMovement as _StockMovement,
    DiscountCoupon as _DiscountCoupon,
    StorefrontCart as _StorefrontCart,
)
from .serializers import (
    StockMovementSerializer as _StockMovementSerializer,
    InventoryAdjustmentSerializer as _InventoryAdjustmentSerializer,
    DiscountCouponSerializer as _DiscountCouponSerializer,
)
from accounts.permissions import IsMarketingOrAdmin as _IsMarketingOrAdmin


class _IsInventoryStaffAllowed(IsAuthenticated):
    """Allow stock writes to Admin, Sales/CRM Manager, and Operations roles."""
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return bool(user.is_superuser or user.role in {"ADMIN", "SALES", "OPERATIONS"})


class InventoryMovementsView(APIView):
    permission_classes = [_IsInventoryStaffAllowed]

    def get(self, request):
        organization = _require_organization(request)
        queryset = _StockMovement.objects.filter(organization=organization).select_related("product", "actor")
        product_id = request.query_params.get("product_id")
        movement_type = request.query_params.get("movement_type")
        search = request.query_params.get("search", "").strip()
        if product_id and str(product_id).isdigit():
            queryset = queryset.filter(product_id=int(product_id))
        if movement_type and movement_type != "All":
            queryset = queryset.filter(movement_type=movement_type)
        if search:
            queryset = queryset.filter(
                _Q(product__name__icontains=search)
                | _Q(product__sku__icontains=search)
                |   _Q(reason__icontains=search)
                | _Q(actor__email__icontains=search)
            )
        return Response(_StockMovementSerializer(queryset[:300], many=True).data)

    def post(self, request):
        organization = _require_organization(request)
        payload = _InventoryAdjustmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        with _Transaction.atomic():
            product = get_object_or_404(
                Product.objects.select_for_update().filter(organization=organization),
                pk=data["product_id"],
            )
            before = int(product.stock)
            direction = data["direction"]
            amount = int(data["quantity"])
            if direction == "ADD":
                after = before + amount
            elif direction == "REMOVE":
                after = before - amount
            else:
                after = amount
            if after < 0:
                raise ValidationError({"quantity": f"Only {before} unit(s) are available to remove."})
            delta = after - before
            if delta == 0:
                raise ValidationError({"quantity": "This adjustment would not change the current stock."})
            movement_type = data["movement_type"]
            if movement_type == "RESTOCK" and direction != "ADD":
                raise ValidationError({"movement_type": "Restock movements must use Add quantity."})
            if movement_type == "RETURN" and direction != "ADD":
                raise ValidationError({"movement_type": "Returned stock must use Add quantity."})
            if movement_type == "DAMAGE" and direction != "REMOVE":
                raise ValidationError({"movement_type": "Damaged stock must use Remove quantity."})
            if movement_type == "COUNT_CORRECTION" and direction != "SET":
                raise ValidationError({"movement_type": "Stock count corrections must set the exact stock quantity."})
            product.stock = after
            product.save(update_fields=["stock", "updated_at"])
            movement = _StockMovement.objects.create(
                organization=organization,
                product=product,
                actor=request.user,
                movement_type=movement_type,
                quantity_delta=delta,
                stock_before=before,
                stock_after=after,
                reason=data["reason"].strip(),
            )
        _record_api_audit(request, "UPDATE", "Inventory", movement.id, f"Stock changed for {product.sku}: {before} → {after}.")
        return Response(_StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)


class  DiscountCouponListCreateView(APIView):
    permission_classes = [IsAuthenticated, _IsMarketingOrAdmin]

    def get(self, request):
        organization = _require_organization(request)
        queryset = _DiscountCoupon.objects.filter(organization=organization)
        active = request.query_params.get("active")
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=(active == "true"))
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(_Q(code__icontains=search) | _Q(name__icontains=search))
        return Response(_DiscountCouponSerializer(queryset[:300], many=True).data)

    def post(self, request):
        organization = _require_organization(request)
        serializer =    DiscountCouponSerializer(data=request.data, context={"organization": organization})
        serializer.is_valid(raise_exception=True)
        coupon = serializer.save(organization=organization, created_by=request.user, code=serializer.validated_data["code"].upper())
        _record_api_audit(request, "CREATE", "DiscountCoupon", coupon.id, f"Created coupon {coupon.code}.")
        return Response(_DiscountCouponSerializer(coupon).data, status=status.HTTP_201_CREATED)


class  DiscountCouponDetailView(APIView):
    permission_classes = [IsAuthenticated, _IsMarketingOrAdmin]

    def get_object(self, request, pk):
        return get_object_or_404(_DiscountCoupon, pk=pk, organization=_require_organization(request))

    def patch(self, request, pk):
        coupon = self.get_object(request, pk)
        serializer = _DiscountCouponSerializer(coupon, data=request.data, partial=True, context={"organization": coupon.organization})
        serializer.is_valid(raise_exception=True)
        updated = serializer.save(code=serializer.validated_data.get("code", coupon.code).upper())
        _record_api_audit(request, "UPDATE", "DiscountCoupon", updated.id, f"Updated coupon {updated.code}.")
        return Response(_DiscountCouponSerializer(updated).data)

    def delete(self, request, pk):
        coupon = self.get_object(request, pk)
        code, coupon_id = coupon.code, coupon.pk
        coupon.delete()
        _record_api_audit(request, "DELETE", "DiscountCoupon", coupon_id, f"Deleted coupon {code}.")
        return Response(status=status.HTTP_204_NO_CONTENT)


class  StorefrontCouponValidationView(APIView):
    permission_classes = [_AllowAny]

    def post(self, request):
        organization_id = _phase25_storefront_org(request)
        if not organization_id:
            return Response({"valid": False, "detail": "The storefront organization is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        visitor_id = _phase25_visitor_id(request.data.get("visitor_id"))
        code = str(request.data.get("code") or "").strip().upper()
        if not code or len(code) > 32:
            return Response({"valid": False, "detail": "Enter a valid coupon code."})
        coupon = _DiscountCoupon.objects.filter(organization_id=organization_id, code=code).first()
        if coupon is None:
            return Response({"valid": False, "detail": "This coupon code was not found."})
        now = timezone.now()
        if not coupon.is_active:
            return Response({"valid": False, "detail": "This coupon is inactive."})
        if coupon.starts_at and now < coupon.starts_at:
            return Response({"valid": False, "detail": "This coupon is not active yet."})
        if coupon.ends_at and now > coupon.ends_at:
            return Response({"valid": False, "detail": "This coupon has expired."})
        if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
            return Response({"valid": False, "detail": "This coupon has reached its usage limit."})
        cart = _StorefrontCart.objects.filter(
            organization_id=organization_id, visitor_id=visitor_id
        ).prefetch_related("items__product").first()
        if not cart or not cart.items.exists():
            return Response({"valid": False, "detail": "Add a product to your cart before applying a coupon."})
        subtotal = sum((_Decimal(item.product.price) * item.quantity for item in cart.items.all()), Decimal("0.00"))
        subtotal = subtotal.quantize(_Decimal("0.01"), rounding=_ROUND_HALF_UP)
        if subtotal < coupon.min_order_value:
            return Response({
                "valid": False,
                "detail": f"This coupon needs a minimum cart value of ₹{coupon.min_order_value}.",
                "subtotal": str(subtotal),
            })
        raw_discount = subtotal * coupon.value / _Decimal("100") if coupon.discount_type == "PERCENT" else coupon.value
        if coupon.discount_type == "PERCENT" and coupon.max_discount is not None:
            raw_discount = min(raw_discount, coupon.max_discount)
        discount_amount = min(subtotal, raw_discount).quantize(_Decimal("0.01"), rounding=_ROUND_HALF_UP)
        return Response({
            "valid": True,
            "code": coupon.code,
            "name": coupon.name,
            "discountType": coupon.discount_type,
            "value": str(coupon.value),
            "discountAmount": str(discount_amount),
            "subtotal": str(subtotal),
            "payableAfterCoupon": str(max(_Decimal("0.00"), subtotal - discount_amount).quantize(_Decimal("0.01"))),
            "note": "Preview only. Coupon redemption is not recorded until real API order placement is implemented.",
        })


class AbandonedCartListView(APIView):
    permission_classes = [IsAuthenticated, IsCatalogStaffAllowed]

    def get(self, request):
        organization = _require_organization(request)
        try:
            min_age_hours = int(request.query_params.get("min_age_hours", "24"))
        except (TypeError, ValueError):
            raise ValidationError({"min_age_hours": "Use a whole number between 1 and 720."})
        min_age_hours = max(1, min(720, min_age_hours))
        cutoff = timezone.now() - _Timedelta(hours=min_age_hours)
        carts = _StorefrontCart.objects.filter(
            organization=organization, updated_at__lt=cutoff, items__isnull=False
        ).distinct().prefetch_related("items__product").order_by("-updated_at")[:250]
        rows = []
        now = timezone.now()
        search = request.query_params.get("search", "").strip().lower()
        for cart in carts:
            items = list(cart.items.all())
            if not items:
                continue
            quantity_count = sum(int(item.quantity) for item in items)
            subtotal = sum((_Decimal(item.product.price) * item.quantity for item in items), _Decimal("0.00"))
            product_names = [item.product.name for item in items]
            searchable = " ".join([cart.visitor_id, *product_names, *(item.product.sku for item in items)]).lower()
            if search and search not in searchable:
                continue
            age_hours = round((now - cart.updated_at).total_seconds() / 3600, 1)
            rows.append({
                "id": cart.pk,
                "visitorHint": f"…{cart.visitor_id[-8:]}",
                "itemCount": len(items),
                "quantityCount": quantity_count,
                "productNames": product_names,
                "subtotal": str(subtotal.quantize(_Decimal("0.01"))),
                "updatedAt": cart.updated_at.isoformat(),
                "ageHours": age_hours,
            })
        return Response({"items": rows, "minAgeHours": min_age_hours, "count": len(rows), "deliveryConfigured": False})


# ---------------------------------------------------------------------------
#  27: organization-scoped order operations (shipments, returns, timeline)
# ---------------------------------------------------------------------------
from rest_framework.permissions import BasePermission as _BasePermission
from rest_framework.views import APIView as _APIView
from rest_framework.response import Response as _Response
from rest_framework import status as _Status
from .models import OrderShipment, OrderReturnRequest, OrderActivityEvent
from .serializers import OrderShipmentSerializer, OrderReturnRequestSerializer, OrderActivityEventSerializer


class IsOrderOperationsAllowed(_BasePermission):
    """Operations/Sales/Management can write; authenticated CRM roles can read."""
    read_roles = {"ADMIN", "SALES", "SUPPORT", "MARKETING", "MANAGEMENT", "OPERATIONS"}
    write_roles = {"ADMIN", "SALES", "MANAGEMENT", "OPERATIONS"}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.role == "ADMIN":
            return True
        if request.method in SAFE_METHODS:
            return user.role in self.read_roles
        return user.role in self.write_roles


def _record_order_event(*, order, user, event_type, message, metadata=None):
    return OrderActivityEvent.objects.create(
        organization=order.organization,
        order=order,
        created_by=user,
        event_type=event_type,
        message=message[:2000],
        metadata=metadata or {},
    )


class OrderShipmentListCreateView(generics.ListCreateAPIView):
    serializer_class = OrderShipmentSerializer
    permission_classes = [IsAuthenticated, IsOrderOperationsAllowed]

    def get_queryset(self):
        queryset = OrderShipment.objects.filter(organization=self.request.user.organization).select_related("order", "order__customer", "created_by")
        order_id = self.request.query_params.get("order_id")
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("search", "").strip()
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        if status_value and status_value != "All":
            queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(models.Q(order__order_number__icontains=search) | models.Q(carrier__icontains=search) | models.Q(tracking_number__icontains=search) | models.Q(order__customer__first_name__icontains=search) | models.Q(order__customer__last_name__icontains=search))
        return queryset[:500]

    def perform_create(self, serializer):
        user = self.request.user
        organization = getattr(user, "organization", None)
        if not organization:
            raise PermissionDenied("User is not assigned to an organization.")
        order = serializer.validated_data["order"]
        if order.organization_id != organization.id:
            raise PermissionDenied("Order does not belong to your organization.")
        if order.status in {Order.OrderStatus.CANCELLED, Order.OrderStatus.REFUNDED}:
            raise ValidationError("Cannot create a shipment for a cancelled or refunded order.")
        shipment = serializer.save(organization=organization, created_by=user, status=OrderShipment.Status.PREPARING)
        _record_order_event(order=order, user=user, event_type=OrderActivityEvent.EventType.SHIPMENT,
            message=f"Shipment record created: {shipment.carrier}, tracking {shipment.tracking_number}.",
            metadata={"shipment_id": shipment.id, "tracking_number": shipment.tracking_number, "status": shipment.status})


class OrderShipmentDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = OrderShipmentSerializer
    permission_classes = [IsAuthenticated, IsOrderOperationsAllowed]

    def get_queryset(self):
        return OrderShipment.objects.filter(organization=self.request.user.organization).select_related("order", "order__customer", "created_by")

    def perform_update(self, serializer):
        previous = serializer.instance.status
        shipment = serializer.save()
        if shipment.status != previous:
            fields = ["updated_at"]
            if shipment.status in {OrderShipment.Status.IN_TRANSIT, OrderShipment.Status.OUT_FOR_DELIVERY, OrderShipment.Status.DELIVERED} and not shipment.shipped_at:
                shipment.shipped_at = timezone.now()
                fields.append("shipped_at")
            if shipment.status == OrderShipment.Status.DELIVERED and not shipment.delivered_at:
                shipment.delivered_at = timezone.now()
                fields.append("delivered_at")
            shipment.save(update_fields=fields)
            _record_order_event(order=shipment.order, user=self.request.user, event_type=OrderActivityEvent.EventType.SHIPMENT,
                message=f"Shipment {shipment.tracking_number} status changed from {previous} to {shipment.status}.",
                metadata={"shipment_id": shipment.id, "previous_status": previous, "status": shipment.status})
            order = shipment.order
            next_order_status = None
            if shipment.status in {OrderShipment.Status.IN_TRANSIT, OrderShipment.Status.OUT_FOR_DELIVERY} and order.status in {Order.OrderStatus.PENDING, Order.OrderStatus.CONFIRMED, Order.OrderStatus.PROCESSING}:
                next_order_status = Order.OrderStatus.SHIPPED
            elif shipment.status == OrderShipment.Status.DELIVERED and order.status not in {Order.OrderStatus.CANCELLED, Order.OrderStatus.REFUNDED}:
                next_order_status = Order.OrderStatus.DELIVERED
            if next_order_status and order.status != next_order_status:
                previous_order_status = order.status
                order.status = next_order_status
                order.save(update_fields=["status", "updated_at"])
                _record_order_event(order=order, user=self.request.user, event_type=OrderActivityEvent.EventType.STATUS,
                    message=f"Order status changed from {previous_order_status} to {next_order_status} based on shipment tracking.",
                    metadata={"shipment_id": shipment.id, "previous_status": previous_order_status, "status": next_order_status})


class OrderReturnRequestListCreateView(generics.ListCreateAPIView):
    serializer_class = OrderReturnRequestSerializer
    permission_classes = [IsAuthenticated, IsOrderOperationsAllowed]

    def get_queryset(self):
        queryset = OrderReturnRequest.objects.filter(organization=self.request.user.organization).select_related("order", "order__customer", "requested_by", "reviewed_by")
        order_id = self.request.query_params.get("order_id")
        status_value = self.request.query_params.get("status")
        search = self.request.query_params.get("search", "").strip()
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        if status_value and status_value != "All":
            queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(models.Q(order__order_number__icontains=search) | models.Q(reason__icontains=search) | models.Q(description__icontains=search) | models.Q(order__customer__first_name__icontains=search) | models.Q(order__customer__last_name__icontains=search))
        return queryset[:500]

    def perform_create(self, serializer):
        user = self.request.user
        organization = getattr(user, "organization", None)
        if not organization:
            raise PermissionDenied("User is not assigned to an organization.")
        order = serializer.validated_data["order"]
        if order.organization_id != organization.id:
            raise PermissionDenied("Order does not belong to your organization.")
        return_request = serializer.save(organization=organization, requested_by=user)
        _record_order_event(order=order, user=user, event_type=OrderActivityEvent.EventType.RETURN,
            message=f"Return request #{return_request.id} recorded: {return_request.get_reason_display()}.",
            metadata={"return_request_id": return_request.id, "status": return_request.status, "reason": return_request.reason})


class OrderReturnRequestStatusView(_APIView):
    permission_classes = [IsAuthenticated, IsOrderOperationsAllowed]
    transitions = {
        "REQUESTED": {"APPROVED", "REJECTED"},
        "APPROVED": {"ITEM_RECEIVED", "CLOSED"},
        "REJECTED": {"CLOSED"},
        "ITEM_RECEIVED": {"REFUND_PENDING", "CLOSED"},
        "REFUND_PENDING": {"CLOSED"},
        "CLOSED": set(),
    }

    def patch(self, request, pk):
        try:
            item = OrderReturnRequest.objects.select_related("order").get(pk=pk, organization=request.user.organization)
        except OrderReturnRequest.DoesNotExist:
            return _Response({"detail": "Return request not found."}, status=_Status.HTTP_404_NOT_FOUND)
        next_status = str(request.data.get("status", "")).upper()
        previous = item.status
        if next_status != previous and next_status not in self.transitions.get(previous, set()):
            return _Response({"detail": f"Return request cannot transition from {previous} to {next_status}."}, status=_Status.HTTP_400_BAD_REQUEST)
        resolution_note = request.data.get("resolution_note", item.resolution_note)
        if not isinstance(resolution_note, str) or len(resolution_note) > 4000:
            return _Response({"resolution_note": "Must be text up to 4000 characters."}, status=_Status.HTTP_400_BAD_REQUEST)
        item.status = next_status
        item.resolution_note = resolution_note.strip()
        item.reviewed_by = request.user
        item.save(update_fields=["status", "resolution_note", "reviewed_by", "updated_at"])
        if next_status != previous:
            message = f"Return request #{item.id} status changed from {previous} to {next_status}."
            metadata = {"return_request_id": item.id, "previous_status": previous, "status": next_status}
        else:
            message = f"Resolution note updated for return request #{item.id}."
            metadata = {"return_request_id": item.id, "status": next_status, "resolution_note_updated": True}
        _record_order_event(order=item.order, user=request.user, event_type=OrderActivityEvent.EventType.RETURN,
            message=message, metadata=metadata)
        return _Response(OrderReturnRequestSerializer(item).data)


class OrderActivityListCreateView(generics.ListCreateAPIView):
    serializer_class = OrderActivityEventSerializer
    permission_classes = [IsAuthenticated, IsOrderOperationsAllowed]

    def get_queryset(self):
        queryset = OrderActivityEvent.objects.filter(organization=self.request.user.organization).select_related("order", "created_by")
        order_id = self.request.query_params.get("order_id")
        event_type = self.request.query_params.get("event_type")
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        if event_type and event_type != "All":
            queryset = queryset.filter(event_type=event_type)
        return queryset[:500]

    def perform_create(self, serializer):
        user = self.request.user
        organization = getattr(user, "organization", None)
        if not organization:
            raise PermissionDenied("User is not assigned to an organization.")
        order = serializer.validated_data["order"]
        if order.organization_id != organization.id:
            raise PermissionDenied("Order does not belong to your organization.")
        serializer.save(organization=organization, created_by=user)
