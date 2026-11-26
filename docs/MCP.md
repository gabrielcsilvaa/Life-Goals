# MCP independente de fornecedor

MCP é o contrato entre o aplicativo e o cliente que executa ferramentas. O servidor não escolhe modelo e não contém SDKs de OpenAI, Anthropic ou DeepSeek. Funciona com clientes que implementem um transporte e autenticação compatíveis.

**Não significa conexão automática com qualquer modelo.** Um modelo precisa de um cliente capaz de descobrir ferramentas, executar chamadas e devolver resultados. Um cliente pode usar Claude, GPT, DeepSeek ou outro modelo e ainda assim ter limitações de transporte, OAuth, permissões ou plano comercial.

## Disponível nesta versão

- Streamable HTTP, endpoint `/mcp`, JSON-RPC e SDK oficial `mcp` Python.
- STDIO local com o mesmo catálogo e os mesmos serviços.
- Token pessoal revogável, armazenado no servidor somente como SHA-256 de segredo aleatório forte.
- Escopos `finance:read` e `finance:write`; expiração máxima de 90 dias (30 pela interface).
- Validação do token a cada chamada, identidade vinculada à conexão e usuário ativo.
- Auditoria de escritas com identificação da conexão.
- Resultados em texto JSON e `structuredContent`, para clientes com capacidades diferentes.

Ferramentas: `get_financial_summary`, `list_transactions`, `get_financial_goals`, `list_card_invoices`, `list_recurring_expenses`, `create_transaction`, `update_transaction`, `create_financial_goal`, `allocate_goal_funds`, `set_goal_plan`, `create_card_purchase`.

Todas as escritas exigem `idempotency_key`. Reutilize a mesma chave quando repetir a mesma intenção após falha de rede. Não há exclusão, reversão de pagamento, criação de token ou alteração de permissões exposta como ferramenta MCP.

## ChatGPT: OAuth e HTTPS

Execute `./start.ps1` para o aplicativo e, em outro terminal na raiz, `./start-mcp.ps1` para o MCP público. Antes do primeiro uso, instale `backend/requirements.txt` na `.venv` e aplique `backend/manage.py migrate` com o banco configurado.

O comando imprime a URL HTTPS terminada em `/mcp`; ela também fica em `.local/mcp-public.json` (arquivo ignorado pelo Git). No ChatGPT web, escolha **URL do servidor**, cole essa URL e selecione **OAuth**. Deixe Client ID e segredo vazios: o cliente usa registro dinâmico. Complete o login e o consentimento do Life Goals no navegador. O token pessoal exibido no aplicativo não é usado nesse fluxo.

A autenticação usa Django OAuth Toolkit 3.4.1, authorization code com PKCE S256 obrigatório, código de uso único (120 segundos), tokens vinculados ao recurso MCP, acesso de 15 minutos, renovação rotativa com detecção de reutilização e consentimento de até 30 dias. Segredos OAuth são armazenados com hash. Escopos padrão só permitem leitura; escrita exige consentimento para `finance:write`. `offline_access` permite a continuidade da conexão. Conexões OAuth aparecem na mesma lista do aplicativo; revogar ali invalida acesso e renovação.

O servidor público usa `config.public_asgi` em **127.0.0.1:8001**, com DEBUG desligado, cookies seguros, login e consentimento protegidos por CSRF, limites de requisição e logs de acesso desligados para não registrar códigos OAuth em URLs. A API mobile, cadastro de usuários e demais rotas não são expostas pelo túnel. O endereço público só admite MCP, descoberta OAuth e os endpoints de login, autorização, registro, token e revogação.

O túnel Cloudflare Quick Tunnel é temporário: o computador e os processos precisam permanecer ligados; ao recriar o túnel, o hostname muda e o ChatGPT precisa ser conectado novamente. Ele é adequado para homologação, não para disponibilidade permanente. Use `./scripts/Stop-McpPublic.ps1` para encerrar apenas o túnel e o processo público. O launcher verifica o SHA-256 da versão fixada do `cloudflared` antes de executar.

Para produção, use domínio estável e túnel nomeado ou hospedagem HTTPS, cache de rate limiting compartilhado entre processos, expurgo periódico de tokens expirados e monitoramento. Não desative OAuth para contornar erros de conexão.

## Token pessoal por HTTP

1. Com PostgreSQL configurado, entre no aplicativo.
2. Abra Configurações → Conexões com IA.
3. Dê um nome ao cliente e selecione permissões mínimas.
4. Crie e guarde o segredo exibido uma única vez.
5. Configure URL e header `Authorization: Bearer SEU_TOKEN` no cliente.

Configuração ilustrativa para clientes que aceitam este formato (confira a documentação do cliente):

```json
{
  "mcpServers": {
    "life-goals": {
      "url": "http://127.0.0.1:8000/mcp",
      "headers": { "Authorization": "Bearer SEU_TOKEN" }
    }
  }
}
```

Nunca comite o segredo. Em clientes com suporte a variáveis de ambiente, prefira essa opção. Para conexão remota use HTTPS e configure os hosts/origens permitidos; o servidor tem proteção contra DNS rebinding. Não exponha a porta local diretamente à internet.

## STDIO

O processo local precisa acessar o mesmo banco e a configuração do backend:

```powershell
cd .\backend
# Configure LIFEGOALS_MCP_TOKEN por um mecanismo seguro do cliente.
..\.venv\Scripts\python.exe -m integrations.stdio
```

No cliente, informe esse executável, os argumentos `-m integrations.stdio`, o diretório de trabalho `backend` e a variável de ambiente. Não passe o token como argumento da linha de comando. STDIO troca mensagens JSON-RPC pela entrada/saída padrão; não é uma interface de chat interativa.

## Compatibilidade: evidência e pendências

| Alvo | Evidência atual | Próxima validação |
| --- | --- | --- |
| Protocolo HTTP | Testes com initialize, tools/list, tools/call, escrita, repetição, expiração e revogação | Testar também com Inspector e conexão de rede real |
| Codex | Documentação oficial descreve STDIO, HTTP, bearer/OAuth | Conectar à instância configurada |
| Claude e clientes afins | Servidor usa protocolo padrão, sem dependências de fornecedor | Homologar nas versões escolhidas de cada cliente |
| GPT/DeepSeek por outro cliente | Depende do cliente que executa as ferramentas | Selecionar e testar o cliente |
| ChatGPT custom MCP | Disponibilidade sujeita à conta/plano e superfície; endpoint isolado não basta | OAuth/registro implementados; concluir login e teste na conta do usuário |

Não conectamos clientes à conta do usuário nesta entrega e não criamos tokens reais.

OAuth **ainda não implementado**. Tokens pessoais não substituem o fluxo de autorização OAuth exigido por alguns clientes. A próxima etapa será escolher componente/provedor de autorização compatível com a especificação, metadados de descoberta, PKCE e audiência do recurso, sem inventar um protocolo próprio.

Referências consultadas em 25/11/2026: [SDK oficial Python](https://github.com/modelcontextprotocol/python-sdk), [autorização MCP](https://modelcontextprotocol.io/specification/latest/basic/authorization), [Codex/MCP](https://learn.chatgpt.com/docs/extend/mcp), [ChatGPT custom MCP](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt). Revalidar requisitos dos clientes ao integrar.
