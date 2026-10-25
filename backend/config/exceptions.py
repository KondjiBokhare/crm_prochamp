
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """
    Return consistent error responses for handled DRF exceptions.
    Preserve the original HTTP status and validation details.
    """
    response = exception_handler(exc, context)

    # Let Django handle unexpected exceptions as HTTP 500.
    # Do not expose internal exception details to the client.
    if response is None:
        return None

    status_code = response.status_code
    details = response.data

    if status_code == 401:
        message = "Authentication required. Please log in again."
    elif status_code == 403:
        message = "You do not have permission to perform this action."
    elif status_code == 404:
        message = "The requested resource was not found."
    elif status_code == 400:
        message = "Please check your input and try again."
    elif status_code == 429:
        message = "Too many requests. Please try again later."
    else:
        message = "The request could not be completed."

    # Prefer a useful detail message returned by DRF when available.
    if isinstance(details, dict):
        detail_message = details.get("detail")
        if isinstance(detail_message, str) and detail_message.strip():
            message = detail_message
    elif isinstance(details, list) and details:
        if isinstance(details[0], str):
            message = details[0]

    response.data = {
        "success": False,
        "message": message,
        "errors": details,
        "status_code": status_code,
    }

    return response
