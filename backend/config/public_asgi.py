import os

os.environ["DJANGO_SETTINGS_MODULE"] = "config.public_settings"
from config.asgi import application as internal_application
from integrations.public_boundary import PublicBoundary

application = PublicBoundary(internal_application)
