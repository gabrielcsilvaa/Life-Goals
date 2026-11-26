from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_handler


class DomainError(APIException):
    status_code = 400
    default_code = "invalid_operation"


class Conflict(DomainError):
    status_code = 409
    default_code = "conflict"


def exception_handler(exc, context):
    response = drf_handler(exc, context)
    if response is not None:
        response.data = {
            "error": {"code": getattr(exc, "default_code", "validation_error"), "details": response.data}
        }
    return response
