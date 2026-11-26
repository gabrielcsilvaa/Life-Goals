# Life Goals

<!-- impeccable:product-schema 1 -->

## Platform
adaptive

## Users and purpose
Aplicativo pessoal mobile para acompanhar dinheiro, compromissos e objetivos. Gabriel é o primeiro usuário; cada conta deve manter seus próprios dados. O usuário consulta o mês, registra receitas/despesas e acompanha reservas efetivas.

## Stack
Expo 58, React Native, TypeScript e Expo Router. Django, PostgreSQL e MCP ficam separados do frontend. O preview web serve à revisão; não define uma interface de site.

## Capabilities and constraints
O dashboard utiliza AppProvider e o contrato Snapshot existente. Pagamentos e aportes exigem operações específicas; uma intenção não é uma movimentação realizada. MCP é opcional e independente de fornecedor. O módulo de tarefas ainda não foi implementado; não inventar tarefas ou conclusões.

## Uso pessoal e configuração
Em 25/11/2026 o usuário autorizou configurar somente PostgreSQL, optando por instalação local isolada no Windows. Não criar outro modo de finanças pessoais armazenadas apenas no celular. A conta pessoal usa a API e o PostgreSQL, começa vazia e guia o cadastro de conta financeira, saldo, categoria e receita. O usuário define seus próprios dados de acesso ao Life Goals, separados da conta Expo usada no desenvolvimento. A demonstração permanece isolada e identificada. Prioridade: criação de viagens/despesas e configurações por finalidade, preservando o visual aprovado.

## Brand commitments (visual)
Nome Life Goals, tratamento tipográfico provisório. Referências visuais aprovadas pelo usuário em 25/11/2026: `../docs/design/approved-reference.png` e `../docs/design/screens-reference.png`. Após a entrega isolada do dashboard, o usuário autorizou explicitamente estender o sistema a lançamentos, metas, detalhe da meta, formulários, orçamento e configurações, incluindo capas dos demais continentes. Sem mascote ou logotipo definitivo. Briefing e referência prevalecem sobre padrões estéticos das skills.

## Evidence on hand
Dados reais da conta via API; demonstração explicitamente separada e identificada. Nenhum valor realizado deve ser copiado da imagem de referência. O banco persistente ainda será configurado com o usuário.
