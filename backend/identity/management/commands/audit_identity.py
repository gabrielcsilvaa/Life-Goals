"""Read-only legacy identity preflight; reports IDs and counts, never addresses."""

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

from identity.models import User


class Command(BaseCommand):
    help = "Audita identidade antes da migração; não altera registros."

    def handle(self, **options):
        seen, missing, conflicts, invalid = {}, [], [], []
        for pk, email in User.objects.values_list("pk", "email"):
            if not email:
                missing.append(pk)
                continue
            normalized = email.strip().lower()
            try:
                validate_email(normalized)
            except ValidationError:
                invalid.append(pk)
            if normalized in seen:
                conflicts.extend([seen[normalized], pk])
            seen[normalized] = pk
        self.stdout.write(
            f"Sem e-mail: {len(missing)}. Inválidos: {len(invalid)}. IDs em conflito: {len(set(conflicts))}."
        )
        if conflicts or invalid:
            raise CommandError("Há identidades que exigem revisão; nenhuma foi alterada.")
