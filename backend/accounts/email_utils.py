
import json
import logging

from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from django.conf import settings
from django.core import signing
from django.core.exceptions import ImproperlyConfigured
from django.core.mail import send_mail


logger = logging.getLogger(__name__)

EMAIL_VERIFICATION_SALT = "accounts.email-verify"
EMAIL_VERIFICATION_MAX_AGE = 60 * 60 * 24

GOOGLE_APPS_SCRIPT_TIMEOUT = 25


def make_email_verification_token(user):
    return signing.dumps(
        {"user_id": user.pk},
        salt=EMAIL_VERIFICATION_SALT,
    )


def read_email_verification_token(token):
    """Validate the verification token and return the user ID."""
    payload = signing.loads(
        token,
        salt=EMAIL_VERIFICATION_SALT,
        max_age=EMAIL_VERIFICATION_MAX_AGE,
    )
    return payload["user_id"]


def send_with_google_apps_script(user, subject, message):
    """Send email through the private Google Apps Script HTTPS relay."""

    url = settings.GOOGLE_APPS_SCRIPT_URL
    secret = settings.GOOGLE_APPS_SCRIPT_SECRET

    if not url or not secret:
        raise ImproperlyConfigured(
            "Google Apps Script email settings are incomplete."
        )

    payload = {
        "secret": secret,
        "to": user.email,
        "subject": subject,
        "message": message,
    }

    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        # Google Apps Script ContentService may redirect its response
        # to script.googleusercontent.com. urllib follows that redirect.
        with urlopen(
            request,
            timeout=GOOGLE_APPS_SCRIPT_TIMEOUT,
        ) as response:
            response_text = response.read().decode("utf-8")

    except HTTPError as exc:
        logger.error(
            "Google Apps Script returned HTTP %s.",
            exc.code,
        )
        raise RuntimeError(
            "Google email relay returned an HTTP error."
        ) from exc

    except URLError as exc:
        logger.exception(
            "Could not connect to Google Apps Script email relay."
        )
        raise RuntimeError(
            "Could not connect to Google email relay."
        ) from exc

    try:
        result = json.loads(response_text)
    except (ValueError, TypeError) as exc:
        logger.error(
            "Google Apps Script returned an invalid response."
        )
        raise RuntimeError(
            "Invalid response from Google email relay."
        ) from exc

    if result.get("ok") is not True:
        # Do not log the secret or the verification token.
        logger.error(
            "Google email relay rejected the request: %s",
            result.get("error", "Unknown error"),
        )
        raise RuntimeError(
            "Google email relay could not send the email."
        )

    logger.info(
        "Verification email accepted by Google relay for user ID %s.",
        user.pk,
    )

    return result


def send_verification_email(user):
    """Send the account verification email through the configured provider."""

    token = make_email_verification_token(user)

    frontend_url = settings.FRONTEND_BASE_URL.rstrip("/")
    verify_link = f"{frontend_url}/verify-email?token={token}"

    subject = "Verify your TechGear account"

    message = (
        f"Hi {user.first_name or user.email},\n\n"
        "Confirm your email address to activate your account:\n"
        f"{verify_link}\n\n"
        "This link expires in 24 hours."
    )

    provider = settings.EMAIL_PROVIDER

    if provider == "apps_script":
        return send_with_google_apps_script(
            user=user,
            subject=subject,
            message=message,
        )

    if provider == "smtp":
        return send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

    raise ImproperlyConfigured(
        f"Unsupported EMAIL_PROVIDER: {provider}"
    )
