# PostgreSQL local configurado

Instalação local isolada autorizada por Gabriel em 25/11/2026. PostgreSQL 18.7, banco/papel `lifegoals`, porta 5433 em 127.0.0.1. As migrações foram aplicadas. Nenhum dado de demonstração foi inserido no banco pessoal.

## Configuração efetiva

1. Binários EDB oficiais em `.local/postgres/pgsql`; cluster em `.local/postgres-data`. Sem Docker ou serviço global.
2. Papel da aplicação sem superusuário, sem criar bancos ou papéis; autenticação SCRAM. PostgreSQL só aceita conexões locais.
3. Todas as credenciais ficam em `backend/.env`, em campos separados `DB_*` e `POSTGRES_ADMIN_*`. As antigas cópias em `.local/database.json` e `.local/postgres-admin.password` foram migradas e removidas. Os arquivos `.env` e variantes não entram em commits; `.env.example` permanece sem segredos. A pasta `.local` tem ACL restrita ao usuário Windows.
4. A API atende ao telefone no Wi-Fi pela porta 8000. A URL está configurada em `mobile/.env.local`. O computador precisa estar ligado.

## Iniciar e verificar

Na raiz: `.\start.ps1` inicia banco, backend e Expo. Para somente banco/backend: `.\start.ps1 -BackendOnly`. Para somente frontend, execute `npx expo start --go --lan --port 8082` na pasta mobile. O comando geral preserva o banco e atualiza o IP local automaticamente.

O comando `.\.venv\Scripts\python.exe scripts\check_local_db.py` verifica cadastro, conta, despesa, plano inicial da meta, reserva, isolamento e idempotência no PostgreSQL real. Os registros da verificação são revertidos em transação; os dados pessoais são preservados.

Backup manual: `.\.venv\Scripts\python.exe scripts\backup_local_db.py`. Arquivos custom do pg_dump ficam em `.local/backups`; sua listagem é validada pelo pg_restore. Restauração completa ainda deve ser testada em um banco novo. Esses backups ficam no mesmo disco, sem cópia externa automática.

Se o IP mudar, execute `scripts/setup_local_db.py` com o Python da venv e reinicie API/Expo. O setup conserva o cluster e credenciais existentes.

Não é necessário enviar senha pelo chat. Podemos orientar a criação e preencher a configuração localmente sem exibir segredos.

## Referência de configuração e futuras instalações

1. Criar papel exclusivo da aplicação e banco `lifegoals` (nome sugerido, configurável).
2. Configurar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, segredo aleatório e hosts em `backend/.env`. `DATABASE_URL` continua opcional para ambientes que usam URL de conexão; a configuração local usa campos separados.
3. Executar `manage.py check`, `manage.py migrate --plan` e revisar o plano.
4. Executar `manage.py migrate` no banco vazio autorizado.
5. Iniciar Uvicorn na interface local e criar a conta pelo aplicativo.
6. Cadastrar saldo inicial e dados reais, ou importar o exemplo explicitamente.
7. Validar concorrência, isolamento e idempotência no PostgreSQL.
8. Fazer backup e testar restauração antes de depender dos registros.

Os testes PostgreSQL devem utilizar banco dedicado de testes. Nunca apontar uma suíte com permissão de criação/exclusão para um banco com dados pessoais importantes. A implantação de produção terá configuração distinta e HTTPS.
