from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    display_name = models.CharField(max_length=80, blank=True)
    timezone = models.CharField(max_length=64, default="America/Sao_Paulo")
