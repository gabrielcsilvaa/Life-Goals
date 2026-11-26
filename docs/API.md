# API v1

Base local: `http://127.0.0.1:8000`. Backend depende do PostgreSQL configurado; `/health/` verifica apenas o processo e informa `database: not_checked`.

## Autenticação

| Método | Rota | Uso |
| --- | --- | --- |
| POST | `/api/v1/auth/register/` | `username`, `display_name`, `password`; retorna access/refresh |
| POST | `/api/v1/auth/token/` | Login por username/password |
| POST | `/api/v1/auth/refresh/` | Renova e rotaciona o refresh token |
| POST | `/api/v1/auth/logout/` | Revoga o refresh token do usuário autenticado |

Nas outras rotas: `Authorization: Bearer ACCESS_TOKEN`. Tokens mobile não são tokens MCP. Access token expira em 15 minutos; refresh em sete dias, com blacklist e rotação. No mobile nativo o refresh fica no SecureStore; no preview web a sessão fica em memória e exige novo login após recarregar.

## Consultas

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/api/v1/snapshot/?month=2027-01` | Dashboard, contas, cartões, metas, orçamentos e recorte de lançamentos |
| GET | `/api/v1/transactions/?month=2027-01&limit=50&offset=0` | Histórico paginado; máximo 200 por página |
| GET | `/api/v1/command-schemas/` | JSON Schemas atuais dos comandos (Pydantic) |
| GET/POST | `/api/v1/connections/` | Listar/criar conexão MCP |
| POST | `/api/v1/connections/{uuid}/revoke/` | Revogar conexão própria |

## Comandos

`POST /api/v1/commands/{operation}/` com `Idempotency-Key: UUID_OU_CHAVE_UNICA`. Payloads proíbem campos desconhecidos e não aceitam `user_id` fornecido pelo cliente.

Operações implementadas:

- `create_account`, `create_category`, `update_category`
- `create_transaction`, `update_transaction`, `cancel_transaction`, `settle_transaction`
- `create_card`, `set_card_block`, `create_card_purchase`, `register_opening_invoice`, `pay_card_invoice`
- `create_recurring_expense`, `update_recurring_expense`, `generate_recurring_expenses`
- `create_goal`, `update_goal`, `set_goal_plan`, `transfer_goal_plan`, `allocate_goal_funds`
- `set_budget`, `load_example`

`create_goal` também aceita o par opcional `initial_plan_amount` e `initial_plan_month` (primeiro dia do mês). Meta e plano inicial são criados na mesma transação e compartilham a chave de idempotência. O plano não registra aporte ou reserva. Informar somente um desses campos é inválido. Não há alteração de modelo ou migração para esse fluxo.

Exemplo de despesa:

```json
{
  "kind": "expense",
  "description": "Almoço",
  "amount": "25.00",
  "category_id": "UUID_DA_CATEGORIA",
  "account_id": "UUID_DA_CONTA",
  "due_date": "2027-01-10",
  "paid_on": null
}
```

`paid_on: null` mantém previsão. Quando o usuário informar que houve pagamento, utilize data real não futura. A realização pode ser registrada posteriormente com `settle_transaction`, incluindo `entry_id`, `version`, `account_id`, `amount`, `paid_on`.

Atualização usa versão otimista. Cancelamento exige lançamento sem liquidações e sem vínculo com compra parcelada; preserva o histórico. Estornos de lançamentos já realizados serão uma operação específica futura.

Valores monetários são strings decimais em BRL; datas `AAAA-MM-DD`; competência sempre primeiro dia do mês. O frontend consulta meses com `AAAA-MM`.

Erros: 400 validação/domínio, 401 autenticação, 404 recurso inexistente ou de outro usuário, 409 conflito de versão/idempotência. Envelope: `{"error":{"code":"...","details":...}}`.
