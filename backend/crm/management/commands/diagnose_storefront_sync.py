"""Read-only diagnostic for customer/profile/order/support visibility across the CRM."""
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from accounts.models import User
from crm.models import Customer, Order, StorefrontCustomerProfile, SupportTicket
from crm.storefront_utils import get_storefront_organization


class Command(BaseCommand):
    help = "Diagnose why a storefront customer's profile, orders, or support tickets are not visible in CRM."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Registered storefront customer's email")
        parser.add_argument("--staff-email", help="Optional CRM staff email to compare organization access")

    def handle(self, *args, **options):
        email = str(options["email"] or "").strip().lower()
        user = User.objects.filter(email__iexact=email, role=User.Role.CUSTOMER).first()
        if not user:
            raise CommandError(f"No active or inactive CUSTOMER account was found for {email}.")

        organization = get_storefront_organization()
        profile = StorefrontCustomerProfile.objects.filter(user=user).first()
        customer = (
            Customer.objects.filter(organization=organization, email__iexact=user.email).first()
            if organization else None
        )

        self.stdout.write("Storefront / CRM sync diagnostic")
        self.stdout.write(f"Customer email: {user.email}")
        self.stdout.write(f"Account role: {user.role}; active={user.is_active}")
        self.stdout.write(f"Account organization ID: {user.organization_id or 'UNASSIGNED'}")
        self.stdout.write(
            f"Resolved storefront organization: {organization.pk} ({organization.name})"
            if organization else "Resolved storefront organization: NOT CONFIGURED"
        )
        self.stdout.write(
            "Organization alignment: MATCH"
            if organization and user.organization_id == organization.pk
            else "Organization alignment: MISMATCH / UNASSIGNED"
        )

        if profile:
            self.stdout.write(
                "Storefront profile: FOUND; "
                f"phone={'saved' if bool(profile.phone) else 'blank'}, "
                f"DOB={'saved' if bool(profile.date_of_birth) else 'blank'}, "
                f"gender={profile.gender}, "
                f"email_updates={profile.email_updates}, sms_updates={profile.sms_updates}, "
                f"whatsapp_updates={profile.whatsapp_updates}"
            )
        else:
            self.stdout.write(self.style.WARNING("Storefront profile: MISSING"))

        if customer:
            self.stdout.write(self.style.SUCCESS(f"CRM Customer row: FOUND (ID {customer.pk})"))
        else:
            self.stdout.write(self.style.WARNING("CRM Customer row: MISSING in the resolved storefront organization"))

        orders = Order.objects.none()
        tickets = SupportTicket.objects.none()
        if organization:
            order_filter = Q(source_user=user)
            ticket_filter = Q(customer_email__iexact=user.email)
            if customer:
                order_filter |= Q(customer=customer)
                ticket_filter |= Q(customer=customer)
            orders = Order.objects.filter(organization=organization).filter(order_filter).distinct()
            tickets = SupportTicket.objects.filter(organization=organization).filter(ticket_filter).distinct()

        self.stdout.write(f"Orders linked in storefront organization: {orders.count()}")
        self.stdout.write(f"Support tickets linked in storefront organization: {tickets.count()}")

        staff_email = str(options.get("staff_email") or "").strip().lower()
        if staff_email:
            staff = User.objects.filter(email__iexact=staff_email).exclude(role=User.Role.CUSTOMER).first()
            if not staff:
                self.stdout.write(self.style.WARNING(f"CRM staff account not found for {staff_email}"))
            else:
                self.stdout.write(f"CRM staff organization ID: {staff.organization_id or 'UNASSIGNED'}")
                if organization and staff.organization_id == organization.pk:
                    self.stdout.write(self.style.SUCCESS("CRM staff organization alignment: MATCH"))
                else:
                    self.stdout.write(self.style.WARNING(
                        "CRM staff organization alignment: MISMATCH. Organization-scoped APIs will not show this store's records."
                    ))
