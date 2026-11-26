from django.contrib.auth.views import LoginView
from django.urls import include, path
from oauth2_provider.urls import metadata_urlpatterns
from oauth2_provider.views import (
    AuthorizationView,
    DynamicClientRegistrationManagementView,
    RevokeTokenView,
    TokenView,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from finance.views import CommandView, SchemaView, SnapshotView, TransactionListView, health
from identity.views import LogoutView, RegisterView
from integrations.oauth import PublicRegistrationView
from integrations.views import ConnectionsView, RevokeConnectionView

urlpatterns = [
    path("health/", health),
    path("api/v1/auth/register/", RegisterView.as_view()),
    path("api/v1/auth/token/", TokenObtainPairView.as_view()),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view()),
    path("api/v1/auth/logout/", LogoutView.as_view()),
    path("api/v1/snapshot/", SnapshotView.as_view()),
    path("api/v1/transactions/", TransactionListView.as_view()),
    path("api/v1/commands/<str:operation>/", CommandView.as_view()),
    path("api/v1/command-schemas/", SchemaView.as_view()),
    path("api/v1/connections/", ConnectionsView.as_view()),
    path("api/v1/connections/<uuid:pk>/revoke/", RevokeConnectionView.as_view()),
]

urlpatterns += metadata_urlpatterns + [
    path("oauth/login/", LoginView.as_view(template_name="oauth/login.html"), name="oauth-login"),
    path(
        "oauth/",
        include(
            (
                [
                    path("authorize/", AuthorizationView.as_view(), name="authorize"),
                    path("token/", TokenView.as_view(), name="token"),
                    path("revoke_token/", RevokeTokenView.as_view(), name="revoke-token"),
                    path("register/", PublicRegistrationView.as_view(), name="dcr-register"),
                    path(
                        "register/<str:client_id>/",
                        DynamicClientRegistrationManagementView.as_view(),
                        name="dcr-register-management",
                    ),
                ],
                "oauth2_provider",
            )
        ),
    ),
]
