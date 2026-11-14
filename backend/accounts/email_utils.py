from django.conf import settings
from django.core import signing
from django.core.mail import send_mail

EMAIL_VERIFICATION_SALT = "accounts.email-verify"
EMAIL_VERIFICATION_MAX_AGE = 60 * 60 * 24  # 24 hours


def make_email_verification_token(user):
    return signing.dumps({"user_id": user.pk}, salt=EMAIL_VERIFICATION_SALT)


def read_email_verification_token(token):
    """Return the user id encoded in a verification token, or raise signing.BadSignature."""
    payload = signing.loads(
        token,
        salt=EMAIL_VERIFICATION_SALT,
        max_age=EMAIL_VERIFICATION_MAX_AGE,
    )
    return payload["user_id"]


def send_verification_email(user):
    token = make_email_verification_token(user)
    verify_link = f"{settings.FRONTEND_BASE_URL}/verify-email?token={token}"

    send_mail(
        subject="Verify your TechGear account",
        message=(
            f"Hi {user.first_name or user.email},\n\n"
            "Confirm your email address to activate your account:\n"
            f"{verify_link}\n\n"
            "This link expires in 24 hours."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
