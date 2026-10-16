
from django.contrib.auth import get_user_model
from rest_framework.authentication import (
    BaseAuthentication,
    get_authorization_header,
)
from rest_framework.exceptions import AuthenticationFailed

from .token_service import TokenError, decode_token


User = get_user_model()


class CustomJWTAuthentication(BaseAuthentication):
    """
    Authenticate API requests using our own JWT access tokens.
    """

    keyword = b"bearer"

    def authenticate(self, request):
        auth_header = get_authorization_header(request).split()

        # No Authorization header: allow other authentication
        # methods or permission classes to handle the request.
        if not auth_header:
            return None

        # Ignore credentials using a different authentication scheme.
        if auth_header[0].lower() != self.keyword:
            return None

        if len(auth_header) != 2:
            raise AuthenticationFailed(
                "Invalid Authorization header."
            )

        try:
            token = auth_header[1].decode("utf-8")
            payload = decode_token(
                token,
                expected_type="access",
            )
        except (UnicodeDecodeError, TokenError):
            raise AuthenticationFailed(
                "Invalid or expired access token."
            )

        try:
            user_id = payload["sub"]
            user = User.objects.get(pk=user_id)
        except (KeyError, TypeError, ValueError, User.DoesNotExist):
            raise AuthenticationFailed(
                "User associated with this token was not found."
            )

        if not user.is_active:
            raise AuthenticationFailed(
                "This account is inactive."
            )

        return (user, payload)

    def authenticate_header(self, request):
        return "Bearer"
