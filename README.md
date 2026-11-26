<div align="center">

# Life Goals

**Suas finanças de hoje, seus planos para o futuro.**

Aplicativo de organização financeira pessoal com Expo, Django e integração opcional com IA via MCP.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-5.2-092E20?logo=django&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-58-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

[Começar](#começar) · [Arquitetura](docs/ARQUITETURA.md) · [API](docs/API.md) · [MCP](docs/MCP.md) · [Segurança](docs/SEGURANCA.md)

</div>

![Referência visual do Life Goals com dados ilustrativos](docs/design/approved-reference.png)

*Referência visual do produto; valores ilustrativos.*

## O que você pode fazer

- Acompanhar receitas, despesas, saldos e orçamento mensal.
- Organizar cartões, compras parceladas, faturas e recorrências.
- Planejar metas e viagens, distinguindo valores planejados de reservas realizadas.
- Usar uma demonstração isolada ou conectar uma conta real à API.
- Autorizar clientes de IA por OAuth com PKCE ou token pessoal, com escopos de leitura e escrita e revogação.

A interface funciona sem IA. O MCP compartilha as regras financeiras do backend e não depende de um fornecedor de modelos. Registrar uma operação não efetua pagamentos bancários.

## Estrutura

```text
Life-Goals/
├── backend/       # Django, API REST, domínio financeiro, OAuth e MCP
├── mobile/        # Expo Router, React Native, TypeScript e testes
├── docs/          # Arquitetura, operação, validação e segurança
├── scripts/       # Inicialização Windows, banco local e backup
├── start.ps1      # Banco + API + Expo no ambiente local preparado
└── start-mcp.ps1  # Conexão pública temporária do MCP/OAuth
```

## Começar

Requisitos: Python 3.12, Node.js 24 e npm. Para a conta real, configure também PostgreSQL. Os comandos abaixo partem da raiz do projeto.

### Explorar a demonstração

```powershell
git clone https://github.com/gabrielcsilvaa/Life-Goals.git
cd Life-Goals/mobile
npm ci
npm run web
```

Abra o endereço apresentado pelo Expo e selecione a demonstração. Ela funciona sem backend, contém dados fictícios e guarda alterações apenas no dispositivo. Esses registros não são importados automaticamente para a conta real.

### Preparar a API

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
Copy-Item backend/.env.example backend/.env
Copy-Item mobile/.env.example mobile/.env.local
```

Preencha `backend/.env` com `SECRET_KEY` aleatória, credenciais PostgreSQL, hosts e origens permitidas. Não deixe os campos secretos vazios. É possível gerar uma chave localmente com `python -c "import secrets; print(secrets.token_urlsafe(64))"`.

```powershell
.\.venv\Scripts\python.exe backend/manage.py check
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe -m uvicorn config.asgi:application --app-dir backend --host 127.0.0.1 --port 8000
```

Em outro terminal, execute `npm run web` em `mobile/`. Para um celular físico, configure `EXPO_PUBLIC_API_URL` com o endereço LAN do computador e permita acesso à API na rede local. Use HTTP somente no desenvolvimento; produção exige HTTPS.

### Ambiente Windows com PostgreSQL isolado

Os launchers dependem dos binários PostgreSQL em `.local/postgres/pgsql/bin` e do ambiente Python preparado. Esses binários e o banco não são distribuídos pelo repositório. Consulte [BANCO.md](docs/BANCO.md) antes da primeira execução.

```powershell
.\start.ps1
# Apenas banco e API:
.\start.ps1 -BackendOnly
```

O launcher preserva o cluster existente. Alterar uma senha no `.env` não altera automaticamente a senha no PostgreSQL.

## Verificação

```powershell
# Raiz do repositório
.\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini backend/tests
.\.venv\Scripts\python.exe backend/manage.py check --settings=config.test_settings
.\.venv\Scripts\python.exe backend/manage.py makemigrations --check --dry-run --settings=config.test_settings
.\.venv\Scripts\python.exe -m ruff check backend
.\.venv\Scripts\python.exe -m ruff format --check backend
python scripts/check_secrets.py

cd mobile
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build:web
```

Os testes Python usam SQLite temporário em memória, sem acessar os dados pessoais. Concorrência e bloqueios PostgreSQL precisam de validação própria. Os testes de navegador exigem a configuração descrita em [VALIDACAO.md](docs/VALIDACAO.md).

## Segurança e privacidade

Credenciais reais, bancos, backups, logs, capturas de execução e chaves de assinatura ficam fora do Git. Os arquivos `.env.example` documentam a configuração sem conter segredos reais. Nunca coloque senhas ou tokens em variáveis `EXPO_PUBLIC_*`: elas entram no aplicativo distribuído.

Consulte a [revisão de segurança e seus limites](docs/SEGURANCA.md). A verificação automatizada reduz o risco de publicar credenciais, mas não garante ausência de todas as vulnerabilidades.

## Documentação

| Guia | Conteúdo |
| --- | --- |
| [Arquitetura](docs/ARQUITETURA.md) | Módulos e invariantes financeiras |
| [API](docs/API.md) | Autenticação e comandos |
| [MCP](docs/MCP.md) | Integração opcional com clientes de IA |
| [Banco](docs/BANCO.md) | Instalação local, operação e backup |
| [Roadmap](docs/ROADMAP.md) | Próximas fases e limitações |
| [Validação](docs/VALIDACAO.md) | Cenários e evidências anteriores |
| [Segurança](docs/SEGURANCA.md) | Revisão anterior à publicação |
| [Auditoria e melhorias](docs/AUDITORIA.md) | Bugs corrigidos, UX, testes e limites de validação |

## Estado do projeto

Base funcional em desenvolvimento. A conta real começa vazia. Homologação em aparelhos, restauração de backup e preparação completa de produção ainda precisam ser validadas. A concorrência foi exercitada em PostgreSQL isolado; veja o relatório de auditoria. Tarefas, notas e investimentos estão previstos para fases futuras.
