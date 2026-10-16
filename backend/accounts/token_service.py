
import uuid
from datetime import timedelta

import jwt
from django.conf import settings
from django.utils import timezone


ACCESS_TOKEN_LIFETIME = timedelta(minutes=30)
REFRESH_TOKEN_LIFETIME = timedelta(days=7)


class TokenError(Exception):
    """Raised when a JWT is invalid or cannot be verified."""


def _get_signing_key():
    key = getattr(settings, "JWT_SIGNING_KEY", None)

    if not isinstance(key, str) or len(key) < 32:
        raise RuntimeError(
            "JWT_SIGNING_KEY must be configured with a strong key "
            "of at least 32 characters."
        )

    return key


def create_token(user, token_type, lifetime):
    if token_type not in {"access", "refresh"}:
        raise ValueError("Unsupported token type.")

    now = timezone.now()

    payload = {
        "sub": str(user.pk),
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + lifetime).timestamp()),
        "jti": str(uuid.uuid4()),
    }

    return jwt.encode(
        payload,
        _get_signing_key(),
        algorithm="HS256",
    )


def create_access_token(user):
    return create_token(user, "access", ACCESS_TOKEN_LIFETIME)


def create_refresh_token(user):
    return create_token(user, "refresh", REFRESH_TOKEN_LIFETIME)


def decode_token(token, expected_type="access"):
    if expected_type not in {"access", "refresh"}:
        raise ValueError("Unsupported expected token type.")

    try:
        payload = jwt.decode(
            token,
            _get_signing_key(),
            algorithms=["HS256"],
            options={
                "require": ["sub", "type", "iat", "exp", "jti"],
            },
        )

        if payload["type"] != expected_type:
            raise TokenError("Incorrect token type.")

        if not isinstance(payload["sub"], str) or not payload["sub"]:
            raise TokenError("Invalid subject claim.")

        if not isinstance(payload["jti"], str):
            raise TokenError("Invalid token identifier.")

        # Validate that jti is a UUID because RefreshToken stores UUIDs.
        uuid.UUID(payload["jti"])

        if isinstance(payload["iat"], bool) or not isinstance(payload["iat"], int):
            raise TokenError("Invalid issued-at claim.")

        if isinstance(payload["exp"], bool) or not isinstance(payload["exp"], int):
            raise TokenError("Invalid expiration claim.")

        if payload["iat"] > int(timezone.now().timestamp()) + 60:
            raise TokenError("Token issued in the future.")

        return payload

    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise TokenError("Invalid or expired token.") from exc
