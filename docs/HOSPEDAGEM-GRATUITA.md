# Render Free + Neon Free

O frontend real usa um projeto Vercel separado da demonstração. Render executa o contêiner Django ASGI e Neon mantém o PostgreSQL persistente. O banco local não deve ser alterado ou removido durante a transferência.

## Estado e pré-requisitos

- Projeto Neon `life-goals` confirmado no plano Free, PostgreSQL 18, inicialmente sem tabelas. Não habilitar plano pago, armazenamento extra ou cartão.
- Projeto Vercel `life-goals-app` criado separadamente de `life-goals-demo`. Criar o projeto não significa publicar um aplicativo com login funcional.
- Backup local criptografado e restauração em PostgreSQL temporário verificados antes de qualquer restauração no Neon. A chave desse backup está protegida pelo Windows; não substitui uma cópia de recuperação externa.
- Brevo Free escolhido pelo usuário para e-mail via HTTPS. Confirmar telefone, remetente e chave restrita ao envio. Chaves não devem ser colocadas em chats, código, bundle ou logs.
- A main continua exigindo **outro revisor**. O autor não pode aprovar o próprio PR; nenhuma automação deve contornar essa regra.

## Planos e limitações

Render deve ter `plan=free`, apenas uma instância, sem discos pagos, sem workers/cron pagos e sem cartão. Ele suspende a aplicação ociosa e pode levar cerca de um minuto para reativar. Conexões MCP podem cair nesse intervalo. Neon mantém o banco quando o Django é suspenso; ficar sem cota pode interromper o acesso. Gratuidade não fornece disponibilidade garantida.

O Neon Free tem recuperação limitada; manter backups criptografados independentes e testar restauração. Não usar o PostgreSQL gratuito do Render: ele expira. Nenhum upgrade automático deve ser habilitado.

Fontes: [Render Free](https://render.com/docs/free), [Neon](https://neon.com/pricing), [Brevo Free](https://www.brevo.com/products/transactional-email/).

## Código e deploy

O CI testa PRs e pushes em develop/main. O release só aceita CI aprovado de um push na main, confere se o SHA ainda é o atual, serializa as publicações e publica o frontend somente após a saúde do backend.

Para Render, configure `BACKEND_PROVIDER=render`. O serviço deve usar Docker, repositório Life-Goals, branch main, plano Free e autodeploy nativo desligado. `scripts/deploy_render.py` aciona o SHA aprovado pela API e aguarda o estado live. O perfil Django usa `RENDER_GIT_COMMIT` como versão quando APP_VERSION não está definido. Não fixar APP_VERSION antigo no painel.

Antes de acionar o backend, o workflow cria um dump do PostgreSQL 18, valida o catálogo, criptografa com age e retém somente o arquivo criptografado como artefato por 14 dias. Se backup, retenção ou gate de migrations falhar, não publica. A chave privada age deve ficar fora do GitHub; somente o destinatário público entra nas variables. O primeiro bootstrap e a transferência dos dados são operações separadas e revisadas, não uma migration automática sobre banco vazio.

O caminho SSH/Compose continua disponível para futura VPS; selecione outro BACKEND_PROVIDER e os parâmetros de SSH. Django e regras financeiras permanecem os mesmos.

### GitHub Environment production

| Tipo | Configuração |
| --- | --- |
| Variables | BACKEND_PROVIDER=render; RENDER_SERVICE_ID; BACKEND_ORIGIN; FRONTEND_ORIGIN; VERCEL_ORG_ID; VERCEL_PROJECT_ID; BACKUP_AGE_RECIPIENT |
| Secrets | RENDER_API_KEY com permissões limitadas; MIGRATION_DATABASE_URL direta; VERCEL_TOKEN restrito ao projeto |

Não usar o ID Vercel da demonstração no release real. A integração Git nativa da Vercel e o autodeploy nativo do Render ficam desligados para haver um único publicador.

### Render: ambiente privado

SECRET_KEY aleatória exclusiva do ambiente hospedado; DATABASE_URL do papel de runtime; FRONTEND_ORIGIN HTTPS; ALLOWED_HOSTS explícitos incluindo o host público e 127.0.0.1; MCP_PUBLIC_URL e OAUTH_PUBLIC_ORIGIN do backend; EMAIL_TRANSPORT=brevo; BREVO_API_KEY restrita; DEFAULT_FROM_EMAIL do remetente verificado. O papel runtime deve ter DML e uso de sequências, sem criação de schema/roles; migrations usam outro papel.

TLS usa verify-full e autoridades confiáveis do certifi, sem ignorar certificados. Preferir conexão direta para migrations/backups. Não publicar strings de conexão em variáveis EXPO_PUBLIC.

## Transferência e corte

1. Conferir origem e destino; o destino deve estar vazio. Fazer dump consistente com snapshot PostgreSQL e manter a origem intacta.
2. Criptografar a cópia, restaurar em ambiente isolado e comparar contagens e conteúdo de todas as tabelas.
3. Restaurar no Neon; conferir novamente antes das migrations. Aplicar somente o plano aditivo revisado. Não inventar e-mail para a conta legada.
4. Configurar papel runtime, segredos, e-mail e autenticação. Credenciais e sessões importadas precisam de revisão; a cópia não deve expor acessos administrativos genéricos.
5. Revalidar a origem imediatamente antes de liberar escritas remotas. Se houve novos registros desde o dump, interromper o corte e repetir a transferência de forma controlada. Não manter local e remoto aceitando escritas divergentes.
6. Validar login, CSRF, isolamento por usuário, persistência após reload, recuperação de conta, MCP e os saldos com a mesma data de corte. Não criar pagamentos para testar dados reais.

Enquanto esses itens não estiverem concluídos e o release não tiver sido validado, o endereço do projeto real não deve ser anunciado como pronto para login.

## Acompanhamento e falhas

Actions mostra os checks e o release; Render mostra build/saúde do backend; Neon mostra uso do banco. O script de deploy não imprime respostas de erro do provedor com potencial de conter informações sensíveis.

Falha anterior à promoção mantém o frontend anterior. Não reverter banco automaticamente. Uma migration pode impedir voltar ao código antigo; avaliar compatibilidade antes de rollback. O workflow `backup.yml` agenda backup diário criptografado às 04:17 UTC, com retenção de 14 dias. Ele só fica ativo após integração à main e configuração do ambiente. Validar a execução real, recuperação com a chave age e avisos de falha antes de considerar a rotina operacional. Agendamentos do GitHub podem atrasar ou ser desativados por inatividade; acompanhar execuções e manter também uma cópia externa independente.
