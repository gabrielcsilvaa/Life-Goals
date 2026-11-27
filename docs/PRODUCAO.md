# Produção, PWA e CI/CD

Para a configuração atual solicitada de Render Free + Neon Free e a separação da demo, consulte [Hospedagem gratuita](HOSPEDAGEM-GRATUITA.md). As seções abaixo registram a preparação inicial e o caminho portátil para VPS.

## Estado da entrega

Implementação na branch `feature/pwa-secure-auth-production`, criada da `develop`, no [PR 1](https://github.com/gabrielcsilvaa/Life-Goals/pull/1). A `main` não foi alterada. Não foi contratado serviço nem realizado deploy público. Não foram aplicadas as novas migrations ao banco pessoal.

O preview local usa exclusivamente dados fictícios e recusa conexões com contas reais. A Vercel ainda não tem sessão CLI nem projeto vinculado neste ambiente. Backend, PostgreSQL hospedado, SMTP e domínio ainda precisam ser escolhidos. O fluxo de produção está preparado, mas sua execução externa não está homologada.

## Diagnóstico confirmado

- Expo Router/React Native Web exporta o aplicativo existente; não foi necessário reescrever a interface. A identidade visual editorial foi preservada.
- O cadastro antigo aceitava e-mail opcional e a interface não o tratava como identidade principal. A consulta somente leitura encontrou uma conta legada sem e-mail. Nenhum endereço foi inventado ou atribuído a essa conta.
- A sessão web anterior reutilizava tokens persistidos no navegador. Agora usa sessões Django em cookies HttpOnly, com proteção CSRF inclusive no login e cadastro anônimos.
- Contas, lançamentos, recorrências, cartões, pagamentos, metas, aportes e planejamento já pertencem ao backend PostgreSQL. O snapshot é uma projeção; o navegador não é o banco financeiro.
- Não havia exportação PWA com atualização controlada nem pipeline completo. Foram adicionados manifest, ícones, service worker restrito a arquivos estáticos, verificação do bundle e workflows.
- MCP/OAuth continua no Django ASGI, com usuários, escopos, revogação, idempotência e auditoria existentes. Não há chave genérica para todos os usuários.

Riscos ainda dependentes de infraestrutura: comportamento dos cookies através do proxy real da Vercel, emissão SMTP, certificados, restauração do backup criptografado, limites do provedor, instalação em aparelhos físicos e execução real do release.

## Arquitetura

```text
Navegador/PWA --HTTPS--> frontend estático Vercel
                          /api/* --HTTPS--> Django ASGI em contêiner persistente
Cliente MCP --------HTTPS/OAuth/PKCE------> /mcp e /oauth do Django
                                             |
                                             +-- PostgreSQL persistente, TLS verify-full
                                             +-- SMTP com TLS
```

O frontend usa `/api` na mesma origem. O adaptador da Vercel encaminha a API ao backend; os cookies `__Host-` não têm domínio explícito. A API direta atende native/MCP. Django permanece um processo ASGI persistente, sem conversão para funções serverless. `dist` é portátil; `.vercel/output` é somente o adaptador de publicação.

Para a primeira hospedagem, use um serviço de contêiner persistente compatível com ASGI e PostgreSQL persistente, ou uma VPS quando houver orçamento. Não é necessário comprar agora. Não use um serviço que suspenda o banco ou destrua volumes sem avaliar perda de dados, latência e limites de conexões. `CONN_MAX_AGE=60`; pooling só deve ser acrescentado após medir a carga e conferir compatibilidade com transações.

## Identidade e autenticação

`identity.User` mantém sua chave primária e relacionamentos. E-mail é validado e normalizado com `strip().lower()`, com unicidade no PostgreSQL por `Lower(Trim(email))`, excluindo vazios legados. Novos cadastros exigem nome, e-mail e senha. Django mantém os hashes de senha; não há senha em texto puro.

Campos adicionais: `updated_at`, `email_verified_at`, `pending_email`, `preferences`. A migration primeiro verifica e-mails inválidos/duplicados e interrompe sem modificá-los. O comando `audit_identity` informa contagens sem listar endereços. Contas antigas sem e-mail podem entrar com seu usuário e vincular um endereço mediante senha atual e confirmação por e-mail.

Web: sessão Django no PostgreSQL, cookie HttpOnly/Secure/SameSite=Lax em produção, expiração de sete dias e logout que invalida a sessão. Um indicador booleano local permite tentar restaurar a sessão; não contém credencial. Native: JWT e SecureStore preservados. A redefinição de senha invalida sessões antigas e revoga tokens JWT/MCP/OAuth.

Recuperação retorna mensagem genérica para contas existentes ou inexistentes. Tokens usam os geradores consolidados do Django, expiram em uma hora e são invalidados após uso. Links levam o token no fragmento da URL; a interface o remove ao ler, evitando enviá-lo em caminhos de requisição. Produção exige confirmação de e-mail e SMTP TLS. Desenvolvimento usa caixa de e-mail em memória e não envia mensagens reais.

Tentativas são limitadas por contadores compartilhados no PostgreSQL, com identificadores protegidos por HMAC. Agende a remoção de contadores antigos e `clearsessions`; monitore abuso distribuído e, quando houver domínio, configure também limites na borda. Não habilite logs de corpo de requisição, senha, token, cookie ou snapshot financeiro.

## PWA

```powershell
cd mobile
npm ci
$env:EXPO_PUBLIC_DEMO_ONLY='true'
npm run build:pwa
npm run check:pwa
npx playwright test --config playwright.pwa.config.ts
node scripts/serve-pwa.mjs
```

O servidor local de validação usa a porta 8091. O modo demo recusa a API e oculta ações de conexão real. Para build real, defina `EXPO_PUBLIC_DEMO_ONLY=false`, `BACKEND_ORIGIN=https://...` e `APP_COMMIT` com o SHA. `BACKEND_ORIGIN` é usado no adaptador do servidor, não como segredo no bundle. Não coloque credenciais em qualquer variável `EXPO_PUBLIC_*`.

Manifest: Life Goals, standalone, ícones 192/512, maskable e Apple touch icon. O worker não guarda API, OAuth, MCP, POST nem HTML autenticado. Guarda somente arquivos estáticos permitidos e uma tela offline segura. Não existe sincronização financeira offline. A versão nova aguarda confirmação; a atualização é adiada durante formulários/operações.

Instalação depende de HTTPS e do navegador: Android/desktop pelo menu de instalação, iOS Safari por Compartilhar → Adicionar à Tela de Início. Os testes automatizados verificam metadados e comportamento do worker, mas não substituem instalação física Android/iOS. Splash do iOS e outros detalhes variam com o sistema.

## CI e proteções reais

`.github/workflows/ci.yml` roda em PRs para develop/main e pushes nessas branches. Instala dependências por lockfiles/hashes, verifica TypeScript, ESLint, testes de frontend, exportação PWA, Django, migrations, Ruff, testes PostgreSQL isolados, integração de navegador, MCP/OAuth, backup/restauração de dados fictícios, vulnerabilidades, segredos e build Docker. O job agregado `ci-required` falha se qualquer dependência falhar.

Proteções configuradas no GitHub: PR obrigatório e `ci-required` aprovado e atualizado; sem force push/exclusão, administradores incluídos, conversas resolvidas e histórico linear. Em 27/11/2026, o proprietário autorizou o fluxo solo: zero revisões humanas obrigatórias e sem aprovação separada do último push. Develop exige o check. O ambiente `production` aceita somente main. Actions usa permissões mínimas e actions fixadas por SHA.

A execução inicial [45878110552](https://github.com/gabrielcsilvaa/Life-Goals/actions/runs/45878110552) validou frontend, segurança e Docker, e falhou em duas expectativas antigas dos testes de navegador. O PR ficou `BLOCKED` e `ci-required` falhou, confirmando o bloqueio real de uma alteração com testes falhando. As expectativas foram corrigidas e uma nova execução deve ficar verde antes da integração.

## Release

`.github/workflows/release.yml` reage somente ao CI bem-sucedido de um push na main, usa o SHA testado e serializa releases. A integração Git nativa da Vercel está desativada em `vercel.json`, evitando dois publicadores.

1. Constrói/publica imagem versionada no GHCR.
2. Conecta ao host por SSH com chave e host conhecido fixado.
3. Executa backup, auditoria de identidade, gate de migrations aditivas e migrations.
4. Sobe o backend e verifica `/ready/` com o SHA esperado.
5. Somente então gera o PWA real, cria deployment Vercel sem promover domínio, valida `version.json`, promove e verifica a URL pública.

Sem configuração, o release falha antes de publicar. PRs não recebem segredos de produção. O workflow não foi executado contra hospedagem real: não há destino contratado/configurado. Antes do primeiro deploy, confirme repositório, branch, projeto Vercel e ambiente; não considere os cenários de promoção/rollback homologados apenas pela existência do YAML.

GitHub Environment `production`, sem fornecer valores em chats:

| Tipo | Nomes |
| --- | --- |
| Secrets | `VERCEL_TOKEN`, `BACKEND_SSH_KEY`, `BACKEND_SSH_KNOWN_HOSTS` |
| Variables | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `BACKEND_SSH_HOST`, `BACKEND_SSH_USER`, `BACKEND_ORIGIN`, `FRONTEND_ORIGIN` |

Use credenciais restritas ao projeto/host. Se a imagem GHCR for privada, configure pull autenticado no host com credencial somente leitura. Não exponha o Docker socket a usuários sem confiança. O usuário de deploy tem privilégio elevado por operar Docker; use conta dedicada e acesso SSH restrito.

## Preparação do host e PostgreSQL

Modelo sem valores reais: `deploy/backend.env.example`. Armazene `/opt/lifegoals/backend.env` com acesso restrito e papel PostgreSQL de runtime com DML somente. Crie `migration.env` separado com papel dono do schema. Configure SECRET_KEY aleatória, SMTP, hosts explícitos, URLs públicas e TLS do banco. Monte a CA em `/opt/lifegoals/certs/postgres-ca.pem`, legível pelo UID 10001 do contêiner. Não use certificado autoassinado sem a CA confiável correspondente.

Instale Docker/Compose, Nginx, certificados HTTPS e ferramentas PostgreSQL da mesma versão principal do banco. Use `deploy/compose.yml`, `deploy/nginx.conf`, `scripts/check_migration_plan.py` e um `backup.sh` privado/executável no diretório do host. Exponha somente 80/443 e SSH restrito; a porta ASGI fica no loopback. O proxy precisa substituir os cabeçalhos encaminhados, pois Django confia no cabeçalho HTTPS.

Antes de migrations: backup criptografado, restauração em banco isolado e `audit_identity`; revise `migrate --plan`. O gate recusa operações não aprovadas e bootstrap inicial automático. A primeira criação de um banco vazio exige revisão explícita e o parâmetro de bootstrap do script; não desabilite o gate em banco real. A migration de identidade não foi aplicada ao banco pessoal nesta entrega.

Administração: execute `python manage.py createsuperuser` interativamente usando a imagem e o ambiente de migration em terminal confiável; não passe senhas em argumentos nem commit. Cadastre e verifique o endereço do administrador. Remova privilégios temporários após bootstrap.

## Backups e recuperação

`scripts/backup_database.py` usa `pg_dump` custom, valida o catálogo com `pg_restore --list` e criptografa com `age`. Requer `BACKEND_ENV_FILE`, `BACKUP_DIR` persistente privado e `BACKUP_AGE_RECIPIENT` público. Guarde a chave privada de recuperação fora do servidor. O backup atual lê `DB_HOST/PORT/NAME/USER/PASSWORD`; se a aplicação usa DATABASE_URL, configure também esses campos no ambiente exclusivo de backup. Não escreva credenciais no wrapper `backup.sh`.

Prepare um wrapper que execute esse script em um ambiente Python com as dependências, agende diariamente por systemd/cron, mantenha por exemplo 14 cópias diárias e cópia externa criptografada. Esses agendamentos, retenção e armazenamento externo ainda não estão provisionados. Falha deve gerar alerta sem anexar dados.

Restauração: em ambiente isolado, descriptografe com `age --decrypt` para diretório privado, restaure com `pg_restore --no-owner --no-acl --exit-on-error` em banco vazio de teste, confira contagens, integridade, saldos e acesso por usuário. Apague o arquivo temporário após o ensaio. Nunca teste sobre o banco de produção. O teste automatizado restaura apenas um dump fictício; o ciclo age/offsite precisa de ensaio na infraestrutura escolhida.

## Falhas, logs e rollback

Consulte a aba Actions → CI/Release → job com falha. Não registre conteúdo de requisições autenticadas; os filtros de produção ocultam dados conhecidos e detalhes de exceção, mas não substituem revisão de qualquer novo log. `/health/` mostra versão; `/ready/` verifica banco e migrations sem expor configurações. Acrescente monitoramento externo e alertas antes da publicação real.

O script do backend tenta restaurar a imagem anterior se startup/saúde local falhar. Nunca reverte banco automaticamente. Se uma migration falhar, interrompe antes de promover o frontend; investigue o estado transacional. Falha da saúde pública após deploy requer intervenção e revalidação do proxy. No frontend, uma falha antes da promoção mantém o domínio anterior; falha após promoção deve usar `vercel rollback <deployment-anterior> --yes` após identificar a versão conhecida e verificar sua compatibilidade com o backend. Esse rollback externo ainda não foi ensaiado.

## Custos e migração futura

Nenhum custo foi assumido. Desenvolvimento, build e preview local funcionam sem contratação. Vercel Hobby pode custar US$ 0 para uso pessoal elegível, sujeito a limites; não fornece o backend persistente descrito aqui. PostgreSQL, processo ASGI, e-mail, domínio, backup externo e monitoramento terão limites/custos próprios. Não há estimativa total confiável antes da escolha desses serviços. Consulte os preços vigentes: [Vercel](https://vercel.com/pricing), [limites Hobby](https://vercel.com/docs/plans/hobby), [Hostinger VPS](https://www.hostinger.com/br/servidor-vps). Não foi escolhida uma oferta promocional nem autorizado pagamento.

Para migrar à Hostinger: preparar VPS e HTTPS; instalar o mesmo Compose; provisionar PG com TLS e backup; restaurar dump em banco novo; preservar SECRET_KEY/credenciais necessárias e relacionamentos; conferir contagens/saldos/usuários; apontar URLs/vars para o novo host; executar preview com dados fictícios; planejar janela de escrita e transferência final; validar saúde e autenticação antes de trocar DNS. Nunca manter dois bancos aceitando escritas divergentes. O Django, as contas e as regras financeiras não precisam ser reescritos.

## Pendências para liberação

- Nova execução CI completamente verde e revisão do PR.
- Escolha e confirmação de destinos, sem obrigação de contratar agora.
- Vinculação Vercel e preview HTTPS isolado; validar proxy, cookies, CSRF e headers reais.
- Backend/PG/SMTP separados de desenvolvimento, credenciais mínimas, TLS, backups/alertas e ensaio de restauração.
- Instalação Android/iOS, recuperação por e-mail real de teste, atualização instalada e falhas de rede em aparelho.
- Execução real do release e ensaio de falhas, promoção e rollback com dados fictícios antes da produção.
