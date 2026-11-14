import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_turnstile(token, remote_ip=None):
    """Validate a Cloudflare Turnstile response token server-side."""
    secret_key = settings.TURNSTILE_SECRET_KEY

    if not secret_key:
        logger.warning("TURNSTILE_SECRET_KEY is not set; skipping bot verification.")
        return True

    if not token:
        return False

    payload = {"secret": secret_key, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        response = requests.post(TURNSTILE_VERIFY_URL, data=payload, timeout=5)
        response.raise_for_status()
        return bool(response.json().get("success"))
    except requests.RequestException:
        logger.exception("Could not reach Cloudflare Turnstile for verification.")
        return False
