from django.utils.cache import patch_vary_headers


class PrivateResponsesMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith(("/api/", "/mcp", "/oauth/")):
            response["Cache-Control"] = "private, no-store, max-age=0"
            patch_vary_headers(response, ["Cookie", "Authorization"])
        return response
