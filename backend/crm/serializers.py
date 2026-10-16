from decimal import Decimal

from rest_framework import serializers

from .models import (
    Customer,
    StorefrontCustomerProfile,
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

from .models import StockMovement as _StockMovement, DiscountCoupon as _DiscountCoupon

def get_user_organization_id(context):
    request = context.get("request")
    user = getattr(request, "user", None)

    if not user or not user.is_authenticated:
        return None

    return getattr(user, "organization_id", None)


class OrganizationScopedPrimaryKeyRelatedField(
    serializers.PrimaryKeyRelatedField
):
    """
    Restricts related-object selections to the current user's organization.

    Use only for related models that have an organization_id field.
    """

    def get_queryset(self):
        queryset = super().get_queryset()

        if queryset is None:
            return None

        organization_id = get_user_organization_id(self.context)

        if organization_id is None:
            return queryset.none()

        return queryset.filter(organization_id=organization_id)
class CustomerSerializer(serializers.ModelSerializer):

    # Storefront data lives in StorefrontCustomerProfile / StorefrontAddress,
    # not on crm.Customer. Return it as a nested, read-only CRM view.
    storefront_profile = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "storefront_profile",
            "lifecycle_stage",
            "is_active",
            "organization",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "organization",
            "created_at",
            "updated_at",
            "storefront_profile",
        ]

    def _get_storefront_profiles_by_email(self, organization_id):
        # Cache per organization so a Customers list response does not query
        # the profile table separately for every customer row.
        cache = self.context.setdefault("_storefront_profiles_by_org", {})
        if organization_id not in cache:
            profiles = (
                StorefrontCustomerProfile.objects
                .filter(user__organization_id=organization_id)
                .select_related("user")
                .prefetch_related("user__storefront_addresses")
            )
            cache[organization_id] = {
                profile.user.email.strip().lower(): profile
                for profile in profiles
            }
        return cache[organization_id]

    def get_storefront_profile(self, obj):
        # The same profile data is returned for list and detail requests so that
        # customer detail UI never depends on router/view kwarg naming. Access is
        # still organization-scoped in the profile lookup below.
        profile = self._get_storefront_profiles_by_email(obj.organization_id).get(
            str(obj.email or "").strip().lower()
        )
        if profile is None:
            return None

        addresses = []
        for address in profile.user.storefront_addresses.all():
            addresses.append({
                "id": address.id,
                "label": address.label,
                "full_name": address.full_name,
                "phone": address.phone,
                "address_line1": address.address_line1,
                "address_line2": address.address_line2,
                "city": address.city,
                "state": address.state,
                "postal_code": address.postal_code,
                "country": address.country,
                "is_default": address.is_default,
            })

        return {
            "phone": profile.phone,
            "date_of_birth": profile.date_of_birth.isoformat() if profile.date_of_birth else "",
            "gender": profile.gender,
            "email_updates": profile.email_updates,
            "sms_updates": profile.sms_updates,
            "whatsapp_updates": profile.whatsapp_updates,
            "addresses": addresses,
        }


class InteractionSerializer(serializers.ModelSerializer):

    customer_name = serializers.SerializerMethodField()

    customer = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Customer.objects.all()
    )

    created_by_email = serializers.EmailField(
        source="created_by.email",
        read_only=True
    )

    class Meta:
        model = Interaction

        fields = [
            "id",
            "customer",
            "customer_name",
            "interaction_type",
            "subject",
            "description",
            "interaction_date",
            "created_by",
            "created_by_email",
            "organization",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "customer_name",
            "created_by",
            "created_by_email",
            "organization",
            "created_at",
            "updated_at",
        ]

    def get_customer_name(self, obj):
        return str(obj.customer)

class OrderSerializer(serializers.ModelSerializer):

    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.EmailField(source="customer.email", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)

    customer = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Customer.objects.all()
    )

    class Meta:
        model = Order

        fields = [
            "id",
            "order_number",
            "customer",
            "customer_name",
            "customer_email",
            "customer_phone",
            "amount",
            "status",
            "order_date",
            "storefront_data",
            "organization",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "customer_name",
            "customer_email",
            "customer_phone",
            "storefront_data",
            "organization",
            "created_at",
            "updated_at",
        ]

    def get_customer_name(self, obj):
        return str(obj.customer)

class SegmentSerializer(serializers.ModelSerializer):

    customer_count = serializers.SerializerMethodField()
    created_by_email = serializers.EmailField(
        source="created_by.email",
        read_only=True
    )
    customers = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Customer.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model = Segment

        fields = [
            "id",
            "name",
            "description",
            "segment_type",
            "customers",
            "customer_count",
            "organization",
            "created_by",
            "created_by_email",
            "is_active",
            "created_at",
            "updated_at",
            "rules",
        ]

        read_only_fields = [
            "id",
            "customer_count",
            "organization",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]

    def get_customer_count(self, obj):
        return obj.customers.count()

    def validate_rules(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Rules must be a JSON object.")
        if not value:
            return value

        allowed_keys = {"match", "conditions"}
        if set(value.keys()) - allowed_keys:
            raise serializers.ValidationError("Rules may contain only 'match' and 'conditions'.")

        match_type = value.get("match", "all")
        if match_type not in {"all", "any"}:
            raise serializers.ValidationError("'match' must be either 'all' or 'any'.")

        conditions = value.get("conditions")
        if not isinstance(conditions, list) or not conditions:
            raise serializers.ValidationError("'conditions' must be a non-empty list.")

        allowed_fields = {"lifecycle_stage", "is_active", "total_orders", "total_spent"}
        allowed_operators = {"equals", "not_equals", "gt", "gte", "lt", "lte"}
        valid_stages = {choice[0] for choice in Customer.LifecycleStage.choices}

        for condition in conditions:
            if not isinstance(condition, dict):
                raise serializers.ValidationError("Each condition must be a JSON object.")
            if set(condition.keys()) != {"field", "operator", "value"}:
                raise serializers.ValidationError("Each condition must contain exactly 'field', 'operator', and 'value'.")

            field = condition["field"]
            operator = condition["operator"]
            condition_value = condition["value"]
            if field not in allowed_fields:
                raise serializers.ValidationError(f"Unsupported field: {field}.")
            if operator not in allowed_operators:
                raise serializers.ValidationError(f"Unsupported operator: {operator}.")
            if field in {"lifecycle_stage", "is_active"} and operator not in {"equals", "not_equals"}:
                raise serializers.ValidationError(f"Operator {operator} is not supported for {field}.")

            if field == "lifecycle_stage":
                if not isinstance(condition_value, str) or condition_value not in valid_stages:
                    raise serializers.ValidationError("Invalid lifecycle_stage value.")
            elif field == "is_active":
                if not isinstance(condition_value, bool):
                    raise serializers.ValidationError("is_active must be true or false.")
            elif field == "total_orders":
                if isinstance(condition_value, bool) or not isinstance(condition_value, int) or condition_value < 0:
                    raise serializers.ValidationError("total_orders must be a non-negative integer.")
            elif field == "total_spent":
                try:
                    amount = Decimal(str(condition_value))
                except Exception as exc:
                    raise serializers.ValidationError("total_spent must be a valid amount.") from exc
                if not amount.is_finite() or amount < 0:
                    raise serializers.ValidationError("total_spent must be a non-negative amount.")
                condition["value"] = str(amount)

        return value

class CampaignSerializer(serializers.ModelSerializer):

    segment = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Segment.objects.all(),
        required=False,
        allow_null=True,
    )

    segment_name = serializers.CharField(
        source="segment.name",
        read_only=True
    )

    created_by_email = serializers.EmailField(
        source="created_by.email",
        read_only=True
    )

    customer_count = serializers.SerializerMethodField()

    class Meta:
        model = Campaign

        fields = [
            "id",
            "name",
            "description",
            "campaign_type",
            "status",
            "segment",
            "segment_name",
            "customer_count",
            "subject",
            "message",
            "scheduled_at",
            "started_at",
            "completed_at",
            "created_by",
            "created_by_email",
            "organization",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "segment_name",
            "customer_count",
            "created_by",
            "created_by_email",
            "organization",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    def get_customer_count(self, obj):
        if not obj.segment_id:
            return 0

        return obj.segment.customers.count()

class CampaignResponseSerializer(serializers.ModelSerializer):

    customer_name = serializers.SerializerMethodField()

    campaign = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Campaign.objects.all()
    )

    customer = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Customer.objects.all()
    )

    campaign_name = serializers.CharField(
        source="campaign.name",
        read_only=True
    )

    class Meta:
        model = CampaignResponse

        fields = [
            "id",
            "campaign",
            "campaign_name",
            "customer",
            "customer_name",
            "status",
            "response_date",
            "metadata",
            "organization",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "campaign_name",
            "customer_name",
            "organization",
            "created_at",
            "updated_at",
            "response_date",
        ]

    def validate(self, attrs):
        campaign = attrs.get(
            "campaign",
            getattr(self.instance, "campaign", None),
        )
        customer = attrs.get(
            "customer",
            getattr(self.instance, "customer", None),
        )

        if (
            campaign
            and customer
            and campaign.organization_id != customer.organization_id
        ):
            raise serializers.ValidationError(
                "Campaign and customer must belong to the same organization."
            )

        return attrs

    def get_customer_name(self, obj):
        return str(obj.customer)

class AnalyticsSerializer(serializers.Serializer):

    total_customers = serializers.IntegerField()
    active_customers = serializers.IntegerField()
    new_customers = serializers.IntegerField()
    repeat_customers = serializers.IntegerField()
    loyal_customers = serializers.IntegerField()

    total_orders = serializers.IntegerField()
    delivered_orders = serializers.IntegerField()
    cancelled_orders = serializers.IntegerField()

    total_revenue = serializers.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    average_order_value = serializers.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    total_campaigns = serializers.IntegerField()
    completed_campaigns = serializers.IntegerField()

    total_campaign_responses = serializers.IntegerField()
    converted_responses = serializers.IntegerField()

    campaign_response_rate = serializers.FloatField()

class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(
        source="user.email",
        read_only=True,
        default=None,
    )
    
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_email",
            "action",
            "entity_type",
            "entity_id",
            "description",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Phase 21 — Category, Product and Support Ticket API serializers
# ---------------------------------------------------------------------------

class CategorySerializer(serializers.ModelSerializer):
    iconKey = serializers.CharField(source="icon_key", required=False, allow_blank=True)
    active = serializers.BooleanField(source="is_active", required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "iconKey", "active", "createdAt", "updatedAt"]
        read_only_fields = ["id", "createdAt", "updatedAt"]

    def validate_name(self, value):
        name = value.strip()

        if not name:
            raise serializers.ValidationError(
                "Category name cannot be empty."
            )

        request = self.context.get("request")
        user = getattr(request, "user", None)
        organization_id = getattr(user, "organization_id", None)

        if not organization_id:
            raise serializers.ValidationError(
                "You must belong to an organization to manage categories."
            )

        queryset = Category.objects.filter(
            organization_id=organization_id,
            name__iexact=name,
        )

        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "A category with this name already exists."
            )

        return name

    def create(self, validated_data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        organization_id = getattr(user, "organization_id", None)

        if not organization_id:
            raise serializers.ValidationError(
                "An organization is required."
            )

        validated_data["organization_id"] = organization_id
        return super().create(validated_data)


    def update(self, instance, validated_data):
        validated_data.pop("organization", None)
        validated_data.pop("organization_id", None)

        return super().update(instance, validated_data)

class ProductSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source="category.name", read_only=True)
    category_name = serializers.CharField(write_only=True, required=True, allow_blank=False)
    shortDescription = serializers.CharField(source="short_description", required=False, allow_blank=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    image = serializers.SerializerMethodField()
    discount = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku", "brand", "category", "category_name", "subcategory",
            "price", "mrp", "discount", "stock", "status", "image", "images", "specs",
            "shortDescription", "highlights", "tags", "specifications", "badge", "rating",
            "reviews", "createdAt", "updatedAt",
        ]
        read_only_fields = ["id", "category", "image", "discount", "createdAt", "updatedAt"]

    def validate_category_name(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        organization_id = getattr(user, "organization_id", None)

        if not organization_id:
            raise serializers.ValidationError(
                "You must belong to an organization to manage products."
            )

        name = value.strip()

        if not name:
            raise serializers.ValidationError(
                "Category name is required."
            )

        try:
            category = Category.objects.get(
                organization_id=organization_id,
                name__iexact=name,
            )
        except Category.DoesNotExist:
            raise serializers.ValidationError(
                "Category does not exist in your organization."
            )

        # Keep the field value a string, as declared by CharField.
        return category.name


    def _get_category(self, category_name):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        organization_id = getattr(user, "organization_id", None)

        if not organization_id:
            raise serializers.ValidationError(
                "An organization is required."
            )

        try:
            category = Category.objects.get(
                organization_id=organization_id,
                name__iexact=category_name,
            )
        except Category.DoesNotExist:
            raise serializers.ValidationError({
                "category_name": (
                    "Category does not exist in your organization."
                )
            })

        return category


    def create(self, validated_data):
        category_name = validated_data.pop("category_name", None)

        if not category_name:
            raise serializers.ValidationError({
                "category_name": "Category name is required."
            })

        category = self._get_category(category_name)

        request = self.context.get("request")
        user = getattr(request, "user", None)
        organization_id = getattr(user, "organization_id", None)

        if not organization_id:
            raise serializers.ValidationError({
                "organization": "An organization is required."
            })

        validated_data["category"] = category
        validated_data["organization_id"] = organization_id

        return super().create(validated_data)


    def update(self, instance, validated_data):
        category_name = validated_data.pop("category_name", None)

        if category_name is not None:
            validated_data["category"] = self._get_category(
                category_name
            )

        # Do not allow clients to move products between organizations.
        validated_data.pop("organization", None)
        validated_data.pop("organization_id", None)

        return super().update(instance, validated_data)

    def get_image(self, obj):
        return obj.images[0] if isinstance(obj.images, list) and obj.images else ""

    def get_discount(self, obj):
        if obj.mrp and obj.mrp > obj.price:
            return round((float(obj.mrp - obj.price) / float(obj.mrp)) * 100)
        return 0


class SupportTicketMessageSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author_name", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    isInternal = serializers.BooleanField(source="is_internal", read_only=True)
    isInitialRequest = serializers.BooleanField(source="is_initial_request", read_only=True)

    class Meta:
        model = SupportTicketMessage
        fields = ["id", "author", "author_name", "text", "isInternal", "isInitialRequest", "createdAt"]
        read_only_fields = fields


class SupportTicketSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="ticket_code", read_only=True)
    customerName = serializers.CharField(source="customer_name")
    customerEmail = serializers.EmailField(source="customer_email")
    orderId = serializers.CharField(source="order_id", required=False, allow_blank=True)
    assignedTo = serializers.CharField(source="assigned_to", required=False)
    statusHistory = serializers.JSONField(source="status_history", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    messages = serializers.SerializerMethodField()
    internalNotes = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            "id", "customer", "customerName", "customerEmail", "subject", "category", "orderId",
            "description", "priority", "status", "assignedTo", "messages", "internalNotes",
            "statusHistory", "createdAt", "updatedAt",
        ]
        read_only_fields = ["id", "customer", "messages", "internalNotes", "statusHistory", "createdAt", "updatedAt"]

    def validate_subject(self, value):
        subject = str(value or "").strip()
        if len(subject) < 4 or len(subject) > 160:
            raise serializers.ValidationError("Subject must be between 4 and 160 characters.")
        return subject

    def validate_description(self, value):
        value = str(value or "").strip()
        if len(value) < 10 or len(value) > 2000:
            raise serializers.ValidationError("Description must be between 10 and 2,000 characters.")
        return value

    def get_messages(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        can_view_internal = bool(
            user
            and user.is_authenticated
            and (
                user.is_staff
                or getattr(user, "role", None) in {"ADMIN", "SUPPORT"}
            )
        )

        queryset = obj.messages.all().order_by("created_at")

        if not can_view_internal:
            queryset = queryset.filter(is_internal=False)

        return SupportTicketMessageSerializer(
            queryset,
            many=True,
            context=self.context,
        ).data

    def get_internalNotes(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return []

        role = getattr(user, "role", None)

        # Adjust these role names if your project uses different choices.
        can_view_internal_notes = (
            user.is_staff
            or role in {"ADMIN", "SUPPORT"}
        )

        if not can_view_internal_notes:
            return []

        messages = obj.messages.filter(
            is_internal=True
        ).order_by("created_at")

        return SupportTicketMessageSerializer(
            messages,
            many=True,
            context=self.context,
        ).data


# ---------------------------------------------------------------------------
# Phase 22 — Leads, banners and homepage promotion serializers
# ---------------------------------------------------------------------------

class LeadSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="lead_code", read_only=True)
    assignedTo = serializers.CharField(source="assigned_to", required=False)
    estimatedValue = serializers.DecimalField(source="estimated_value", max_digits=12, decimal_places=2, required=False)
    nextFollowUpAt = serializers.DateField(source="next_follow_up_at", required=False, allow_null=True, format="%Y-%m-%d", input_formats=["%Y-%m-%d"])
    followUps = serializers.JSONField(source="follow_ups", required=False)
    statusHistory = serializers.JSONField(source="status_history", read_only=True)
    convertedCustomerId = serializers.IntegerField(source="converted_customer_id", read_only=True, allow_null=True)
    convertedAt = serializers.DateTimeField(source="converted_at", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id", "name", "email", "phone", "company", "city", "source", "status",
            "assignedTo", "score", "estimatedValue", "nextFollowUpAt", "notes",
            "followUps", "statusHistory", "convertedCustomerId", "convertedAt",
            "createdAt", "updatedAt",
        ]
        read_only_fields = ["id", "followUps", "statusHistory", "convertedCustomerId", "convertedAt", "createdAt", "updatedAt"]

    def validate_score(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Lead score must be between 0 and 100.")
        return value

    def validate_name(self, value):
        value = " ".join(str(value or "").split())
        if not value or len(value) > 120:
            raise serializers.ValidationError("Lead name is required and must be at most 120 characters.")
        return value

    def validate_email(self, value):
        value = str(value or "").strip().lower()
        request = self.context.get("request")
        organization = getattr(getattr(request, "user", None), "organization", None)
        if organization:
            duplicates = Lead.objects.filter(organization=organization, email__iexact=value).exclude(status__in=[Lead.LeadStatus.CONVERTED, Lead.LeadStatus.LOST])
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError(f"An open lead already exists for {value} ({duplicates.first().lead_code}).")
        return value

    def validate_estimatedValue(self, value):
        if value < 0:
            raise serializers.ValidationError("Estimated deal value cannot be negative.")
        return value

    def validate(self, attrs):
        status_value = attrs.get("status", getattr(self.instance, "status", Lead.LeadStatus.NEW))
        if self.instance and self.instance.status == Lead.LeadStatus.CONVERTED:
            raise serializers.ValidationError("Converted leads cannot be edited. Update the linked customer instead.")
        if status_value == Lead.LeadStatus.CONVERTED:
            raise serializers.ValidationError({"status": "Use the Convert lead action so customer conversion is recorded."})
        return attrs


class BannerSerializer(serializers.ModelSerializer):
    buttonText = serializers.CharField(source="button_text", required=False, allow_blank=True)
    targetUrl = serializers.CharField(source="target_url", required=False)
    imageUrl = serializers.URLField(source="image_url", required=False, allow_blank=True)
    backgroundColor = serializers.CharField(source="background_color", required=False)
    textColor = serializers.CharField(source="text_color", required=False)
    startDate = serializers.DateField(source="start_date", format="%Y-%m-%d", input_formats=["%Y-%m-%d"])
    endDate = serializers.DateField(source="end_date", format="%Y-%m-%d", input_formats=["%Y-%m-%d"])
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Banner
        fields = [
            "id", "name", "eyebrow", "title", "subtitle", "buttonText", "targetUrl",
            "imageUrl", "placement", "backgroundColor", "textColor", "status",
            "startDate", "endDate", "impressions", "clicks", "createdAt", "updatedAt",
        ]
        read_only_fields = ["id", "impressions", "clicks", "createdAt", "updatedAt"]

    def validate_name(self, value):
        value = str(value or "").strip()
        if not value:
            raise serializers.ValidationError("Banner name is required.")
        return value

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"endDate": "End date must be on or after the start date."})
        for field in ("background_color", "text_color"):
            color = attrs.get(field, getattr(self.instance, field, ""))
            if color and (len(color) != 7 or not color.startswith("#")):
                raise serializers.ValidationError({field: "Use a six-digit hex colour such as #061a3c."})
        target = attrs.get("target_url", getattr(self.instance, "target_url", "/products"))
        if not (target.startswith("/") or target.startswith("https://") or target.startswith("http://")):
            raise serializers.ValidationError({"targetUrl": "Destination must be a relative path or an HTTP(S) URL."})
        return attrs


class HomepagePromotionSettingsSerializer(serializers.ModelSerializer):
    selectionMode = serializers.ChoiceField(source="selection_mode", choices=HomepagePromotionSettings.SelectionMode.choices, required=False)
    featuredProductIds = serializers.JSONField(source="featured_product_ids", required=False)
    sectionTitle = serializers.CharField(source="section_title", required=False, max_length=100)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    updatedBy = serializers.SerializerMethodField()

    class Meta:
        model = HomepagePromotionSettings
        fields = ["enabled", "selectionMode", "featuredProductIds", "sectionTitle", "subtitle", "updatedAt", "updatedBy"]
        read_only_fields = ["updatedAt", "updatedBy"]

    def get_updatedBy(self, obj):
        return getattr(obj.updated_by, "email", None)

    def validate_featuredProductIds(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Featured product IDs must be a list.")
        ids = list(dict.fromkeys(str(item) for item in value))
        if len(ids) > 2:
            raise serializers.ValidationError("Select up to two featured products.")
        request = self.context.get("request")
        organization = getattr(getattr(request, "user", None), "organization", None)
        selection_mode = self.initial_data.get("selectionMode", getattr(self.instance, "selection_mode", "AUTO"))
        if selection_mode == "MANUAL" and ids:
            try:
                numeric_ids = [int(item) for item in ids]
            except (TypeError, ValueError):
                raise serializers.ValidationError("Featured product IDs must be numeric product IDs.")
            products = Product.objects.filter(organization=organization, id__in=numeric_ids, status="Active", stock__gt=0)
            if not organization or products.count() != len(set(numeric_ids)):
                raise serializers.ValidationError("Every featured product must be active, in stock, and belong to this store.")
            return numeric_ids
        if selection_mode == "MANUAL" and not ids:
            enabled = self.initial_data.get("enabled", getattr(self.instance, "enabled", True))
            if enabled:
                raise serializers.ValidationError("Choose at least one featured product or switch to automatic selection.")
        return ids

    def validate_section_title(self, value):
        value = str(value or "").strip()
        if not value:
            raise serializers.ValidationError("Promotion section title is required.")
        return value

    def validate_subtitle(self, value):
        return str(value or "").strip()


# ---------------------------------------------------------------------------
# Phase 23 serializers
# ---------------------------------------------------------------------------
from .models import StorefrontSettings, CommunicationTemplate, CommunicationLog, Notification


class CommunicationTemplateSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = CommunicationTemplate
        fields = ["id", "name", "channel", "subject", "body", "category", "status", "createdAt", "updatedAt"]
        read_only_fields = ["id", "createdAt", "updatedAt"]

   
    def validate_name(self, value):
        name = value.strip()

        if not name:
            raise serializers.ValidationError(
                "Template name cannot be empty."
            )

        request = self.context.get("request")
        user = getattr(request, "user", None)
        organization_id = getattr(user, "organization_id", None)

        if organization_id is None:
            raise serializers.ValidationError(
                "An organization is required."
            )

        queryset = CommunicationTemplate.objects.filter(
            organization_id=organization_id,
            name__iexact=name,
        )

        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "A template with this name already exists."
            )

        return name

    def validate_body(self, value):
        body = value.strip()
        if len(body) < 5:
            raise serializers.ValidationError("Message body must contain at least 5 characters.")
        return body


class CommunicationLogSerializer(serializers.ModelSerializer):
    audienceKey = serializers.CharField(source="audience_key", read_only=True)
    recipientCount = serializers.IntegerField(source="recipient_count", read_only=True)
    type = serializers.CharField(source="notification_type", read_only=True)
    scheduledAt = serializers.DateTimeField(source="scheduled_at", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    sentAt = serializers.DateTimeField(source="sent_at", read_only=True, allow_null=True)
    templateId = serializers.IntegerField(source="template_id", read_only=True, allow_null=True)

    class Meta:
        model = CommunicationLog
        fields = ["id", "subject", "body", "channel", "audience", "audienceKey", "recipientCount", "type", "status", "scheduledAt", "sentAt", "createdAt", "actor", "templateId"]
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    type = serializers.SerializerMethodField()
    recipientEmail = serializers.EmailField(source="recipient_email", read_only=True, allow_blank=True)
    recipientEmails = serializers.JSONField(source="recipient_emails", read_only=True)
    recipientRole = serializers.CharField(source="recipient_role", read_only=True, allow_blank=True)
    recipientRoles = serializers.JSONField(source="recipient_roles", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    read = serializers.SerializerMethodField()
    time = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "title", "message", "type", "audience", "recipientEmail", "recipientEmails", "recipientRole", "recipientRoles", "link", "source", "metadata", "createdAt", "read", "time"]
        read_only_fields = ["id", "createdAt", "read", "time"]

    def get_type(self, obj):
        return obj.notification_type

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["type"] = instance.notification_type
        return data

    def get_read(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.read_by.filter(pk=request.user.pk).exists())

    def get_time(self, obj):
        request = self.context.get("request")
        return obj.created_at.isoformat() if obj.created_at else ""

# ---------------------------------------------------------------------------
# Phase 24 — customer behaviour event ingestion
# ---------------------------------------------------------------------------

class CustomerBehaviorEventInputSerializer(serializers.Serializer):
    event_id = serializers.CharField(max_length=100)
    visitor_id = serializers.CharField(max_length=100)
    session_id = serializers.CharField(max_length=100)
    event_type = serializers.ChoiceField(choices=[
        "product_view", "search", "add_to_cart", "wishlist_add",
        "wishlist_remove", "checkout_started", "purchase",
    ])
    path = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    previous_viewed_product_id = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    previous_viewed_product_name = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")
    product_id = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    product_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    product_category = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    product_brand = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False, default=Decimal("0.00"))
    query = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    search_category = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    result_count = serializers.IntegerField(min_value=0, required=False, default=0)
    matched_product_ids = serializers.ListField(child=serializers.CharField(max_length=80), required=False, max_length=20, default=list)
    quantity = serializers.IntegerField(min_value=1, max_value=1000, required=False, default=1)
    item_count = serializers.IntegerField(min_value=0, max_value=1000, required=False, allow_null=True, default=None)
    order_id = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False, default=Decimal("0.00"))
    order_total = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False, default=Decimal("0.00"))

    def validate_visitor_id(self, value):
        import re
        value = value.strip()
        if not value or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value):
            raise serializers.ValidationError("Use a pseudonymous visitor ID containing letters, numbers, hyphens or underscores only.")
        return value

    def validate_session_id(self, value):
        import re
        value = value.strip()
        if not value or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value):
            raise serializers.ValidationError("Use a pseudonymous session ID containing letters, numbers, hyphens or underscores only.")
        return value

    def validate_event_id(self, value):
        import re
        value = value.strip()
        if not value or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value):
            raise serializers.ValidationError("Use a valid non-personal event ID for idempotent ingestion.")
        return value

    def _scrub_sensitive_text(self, value, max_length):
        import re
        value = re.sub(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", "[redacted-email]", str(value), flags=re.I)
        value = re.sub(r"\+?\d[\d\s().-]{8,}\d", "[redacted-number]", value)
        return " ".join(value.split())[:max_length]

    def validate_query(self, value):
        return self._scrub_sensitive_text(value, 120)

    def validate_path(self, value):
        return self._scrub_sensitive_text(value, 200)

    def validate_previous_viewed_product_name(self, value):
        return self._scrub_sensitive_text(value, 160)

    def validate_product_name(self, value):
        return self._scrub_sensitive_text(value, 200)

    def validate_product_category(self, value):
        return self._scrub_sensitive_text(value, 80)

    def validate_product_brand(self, value):
        return self._scrub_sensitive_text(value, 80)

    def validate_search_category(self, value):
        return self._scrub_sensitive_text(value, 80)


# ---------------------------------------------------------------------------
# Phase 25 — public cart/wishlist inputs and product review serializers
# ---------------------------------------------------------------------------
import re as re
from .models import StorefrontCart, StorefrontCartItem, StorefrontWishlistItem, ProductReview


def _validate_phase25_visitor_id(value):
    value = str(value or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value):
        raise serializers.ValidationError("Use the pseudonymous visitor ID generated by this browser.")
    return value


class StorefrontCartItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=100)


class StorefrontCartSyncSerializer(serializers.Serializer):
    visitor_id = serializers.CharField(max_length=100)
    items = StorefrontCartItemInputSerializer(many=True, max_length=50)

    def validate_visitor_id(self, value):
        return _validate_phase25_visitor_id(value)

    def validate_items(self, items):
        product_ids = [item["product_id"] for item in items]
        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError("Each product may appear once in the cart snapshot.")
        return items


class StorefrontWishlistSyncSerializer(serializers.Serializer):
    visitor_id = serializers.CharField(max_length=100)
    product_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), max_length=100, allow_empty=True
    )

    def validate_visitor_id(self, value):
        return _validate_phase25_visitor_id(value)

    def validate_product_ids(self, product_ids):
        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError("Each product may appear once in the wishlist.")
        return product_ids


class StorefrontProductReviewCreateSerializer(serializers.Serializer):
    visitor_id = serializers.CharField(max_length=100)
    reviewer_name = serializers.CharField(max_length=100, trim_whitespace=True)
    rating = serializers.IntegerField(min_value=1, max_value=5)
    title = serializers.CharField(max_length=120, trim_whitespace=True)
    comment = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_visitor_id(self, value):
        return _validate_phase25_visitor_id(value)

    def validate_reviewer_name(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Name must contain at least 2 characters.")
        return value

    def validate_title(self, value):
        value = " ".join(value.split())
        if len(value) < 3:
            raise serializers.ValidationError("Review title must contain at least 3 characters.")
        return value

    def validate_comment(self, value):
        value = " ".join(value.split())
        if len(value) < 10:
            raise serializers.ValidationError("Review comment must contain at least 10 characters.")
        return value


class StorefrontProductReviewSerializer(serializers.ModelSerializer):
    reviewerName = serializers.CharField(source="reviewer_name", read_only=True)
    verifiedPurchase = serializers.BooleanField(source="verified_purchase", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ProductReview
        fields = ["id", "reviewerName", "rating", "title", "comment", "verifiedPurchase", "createdAt"]
        read_only_fields = fields


class CRMProductReviewSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    reviewerName = serializers.CharField(source="reviewer_name", read_only=True)
    verifiedPurchase = serializers.BooleanField(source="verified_purchase", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = ProductReview
        fields = ["id", "product_id", "product_name", "reviewerName", "rating", "title", "comment", "status", "verifiedPurchase", "createdAt"]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Phase 26 — inventory movement and discount coupon serializers
# ---------------------------------------------------------------------------

class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    actor_email = serializers.CharField(source="actor.email", read_only=True, default="", allow_null=True)

    class Meta:
        model = _StockMovement
        fields = [
            "id", "product", "product_name", "sku", "actor", "actor_email",
            "movement_type", "quantity_delta", "stock_before", "stock_after",
            "reason", "created_at",
        ]
        read_only_fields = fields


class InventoryAdjustmentSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    direction = serializers.ChoiceField(choices=[("ADD", "Add stock"), ("REMOVE", "Remove stock"), ("SET", "Set exact stock")])
    quantity = serializers.IntegerField(min_value=0, max_value=1_000_000)
    movement_type = serializers.ChoiceField(choices=_StockMovement.MovementType.choices, default=_StockMovement.MovementType.ADJUSTMENT)
    reason = serializers.CharField(max_length=500, allow_blank=True, required=False, default="")

    def validate(self, attrs):
        if attrs["direction"] in {"ADD", "REMOVE"} and attrs["quantity"] < 1:
            raise serializers.ValidationError({"quantity": "Enter a quantity greater than zero for Add/Remove."})
        return attrs


class DiscountCouponSerializer(serializers.ModelSerializer):
    created_by_email = serializers.CharField(source="created_by.email", read_only=True, default="", allow_null=True)

    class Meta:
        model = _DiscountCoupon
        fields = [
            "id", "code", "name", "discount_type", "value", "min_order_value",
            "max_discount", "starts_at", "ends_at", "usage_limit", "used_count",
            "is_active", "created_by", "created_by_email", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "used_count", "created_by", "created_by_email", "created_at", "updated_at"]

    def validate_code(self, value):
        code = value.strip().upper()

        if not code:
            raise serializers.ValidationError(
                "Coupon code is required."
            )

        request = self.context.get("request")
        user = getattr(request, "user", None)

        organization_id = (
            getattr(user, "organization_id", None)
            or getattr(self.instance, "organization_id", None)
        )

        if organization_id is None:
            raise serializers.ValidationError(
                "An organization is required."
            )

        queryset = _DiscountCoupon.objects.filter(
            organization_id=organization_id,
            code__iexact=code,
        )

        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "A coupon with this code already exists."
            )

        return code

    def validate(self, attrs):
        discount_type = attrs.get("discount_type", getattr(self.instance, "discount_type", None))
        value = attrs.get("value", getattr(self.instance, "value", None))
        min_order_value = attrs.get("min_order_value", getattr(self.instance, "min_order_value", 0))
        max_discount = attrs.get("max_discount", getattr(self.instance, "max_discount", None))
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if value is not None and value <= 0:
            raise serializers.ValidationError({"value": "Discount value must be greater than zero."})
        if discount_type == _DiscountCoupon.DiscountType.PERCENT and value is not None and value > 100:
            raise serializers.ValidationError({"value": "A percentage discount cannot exceed 100%."})
        if min_order_value is not None and min_order_value < 0:
            raise serializers.ValidationError({"min_order_value": "Minimum order value cannot be negative."})
        if max_discount is not None and max_discount <= 0:
            raise serializers.ValidationError({"max_discount": "Maximum discount must be greater than zero when provided."})
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "End date/time must be later than the start date/time."})
        return attrs


# Phase 27 order operations serializers
from .models import OrderShipment, OrderReturnRequest, OrderActivityEvent


class OrderShipmentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    customer_name = serializers.SerializerMethodField()
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True, allow_null=True)
    order = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Order.objects.all()
    )

    class Meta:
        model = OrderShipment
        fields = ["id", "order", "order_number", "customer_name", "carrier", "tracking_number", "tracking_url", "status", "shipped_at", "estimated_delivery", "delivered_at", "organization", "created_by", "created_by_email", "created_at", "updated_at"]
        read_only_fields = ["id", "order_number", "customer_name", "organization", "created_by", "created_by_email", "shipped_at", "delivered_at", "created_at", "updated_at"]

    def get_customer_name(self, obj):
        return str(obj.order.customer)

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        next_status = attrs.get("status", getattr(instance, "status", OrderShipment.Status.PREPARING))
        target_order = attrs.get("order", getattr(instance, "order", None))
        if target_order and target_order.status in {Order.OrderStatus.CANCELLED, Order.OrderStatus.REFUNDED} and next_status in {OrderShipment.Status.IN_TRANSIT, OrderShipment.Status.OUT_FOR_DELIVERY, OrderShipment.Status.DELIVERED}:
            raise serializers.ValidationError({"status": "A cancelled or refunded order cannot be marked as in transit or delivered."})
        if instance:
            transitions = {
                "PREPARING": {"LABEL_CREATED", "IN_TRANSIT", "EXCEPTION"},
                "LABEL_CREATED": {"IN_TRANSIT", "EXCEPTION"},
                "IN_TRANSIT": {"OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION", "RETURN_TO_SENDER"},
                "OUT_FOR_DELIVERY": {"DELIVERED", "EXCEPTION", "RETURN_TO_SENDER"},
                "EXCEPTION": {"IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "RETURN_TO_SENDER"},
                "DELIVERED": set(),
                "RETURN_TO_SENDER": set(),
            }
            if next_status != instance.status and next_status not in transitions.get(instance.status, set()):
                raise serializers.ValidationError({"status": f"Shipment cannot transition from {instance.status} to {next_status}."})
        return attrs


class OrderReturnRequestSerializer(serializers.ModelSerializer):
    order = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Order.objects.all()
    )
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    customer_name = serializers.SerializerMethodField()
    requested_by_email = serializers.EmailField(source="requested_by.email", read_only=True, allow_null=True)
    reviewed_by_email = serializers.EmailField(source="reviewed_by.email", read_only=True, allow_null=True)
   

    class Meta:
        model = OrderReturnRequest
        fields = ["id", "order", "order_number", "customer_name", "reason", "description", "status", "resolution_note", "organization", "requested_by", "requested_by_email", "reviewed_by", "reviewed_by_email", "created_at", "updated_at"]
        read_only_fields = ["id", "order_number", "customer_name", "status", "organization", "requested_by", "requested_by_email", "reviewed_by", "reviewed_by_email", "created_at", "updated_at"]

    def get_customer_name(self, obj):
        return str(obj.order.customer)


class OrderActivityEventSerializer(serializers.ModelSerializer):
    order = OrganizationScopedPrimaryKeyRelatedField(
        queryset=Order.objects.all()
    )
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    actor_email = serializers.EmailField(source="created_by.email", read_only=True, allow_null=True)

    class Meta:
        model = OrderActivityEvent
        fields = ["id", "order", "order_number", "event_type", "message", "metadata", "organization", "created_by", "actor_email", "created_at"]
        read_only_fields = ["id", "order_number", "organization", "created_by", "actor_email", "created_at"]

    def validate_event_type(self, value):
        if value not in {OrderActivityEvent.EventType.NOTE, OrderActivityEvent.EventType.CUSTOMER_CONTACT}:
            raise serializers.ValidationError("Only internal notes or customer-contact events can be added manually.")
        return value

    def validate_message(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Message cannot be empty.")
        return value.strip()
