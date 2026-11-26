# Entrega e evolução

## Implementado nesta base

- Interface Expo com cinco áreas e navegação responsiva.
- Modo de demonstração persistido e separado da conta real.
- Cadastro, login, renovação de sessão e logout.
- Contas, categorias editáveis, receitas e despesas previstas/realizadas.
- Edição/cancelamento de compromissos abertos e liquidação parcial.
- Orçamento por categoria e despesas recorrentes mensais.
- Cartões, bloqueio lógico, parcelas com conservação de centavos, fatura inicial e pagamento parcial de fatura.
- Metas editáveis, plano mensal, redistribuição do plano, reservas e retiradas por conta.
- Dashboard com cálculo explicado, gráficos e filtros.
- API, migrações, validações, auditoria, idempotência e isolamento lógico.
- Adaptadores MCP HTTP e STDIO, autenticação por token pessoal e ferramentas iniciais.

## Próximo marco: funcionamento com PostgreSQL

Criar/configurar o banco com Gabriel, aplicar migrações, validar fluxo real aplicativo → API → banco → aplicativo. Executar cenários concorrentes com PostgreSQL e backups. Homologar instalação nativa Android/iOS; o preview web e o build Expo não comprovam testes em aparelhos.

## Integração com clientes de IA

OAuth com provedor/componente compatível, Inspector e homologação em clientes escolhidos (Codex, Claude e cliente para modelos adicionais). Verificar planos e limitações do ChatGPT no momento da conexão. Ampliar catálogo a partir de casos reais, com confirmações verificáveis para ações sensíveis.

## Melhorias financeiras antes de uso amplo

- Estornos e correções de registros liquidados com trilha explícita.
- Taxas/juros de cartão, fechamento/reabertura de faturas e alterações de calendário.
- Transferências entre contas acompanhadas e conciliação manual detalhada.
- Tela de histórico de aportes e auditoria por objeto (os registros já existem no backend).
- Recorrências de receitas e periodicidades além de mensal.
- Filtragem semanal/diária e formas de pagamento mais detalhadas.
- Fila persistente de tentativas após falhas de rede, sem considerar operação pendente como concluída.
- Recuperação de senha, verificação de contato e administração de sessões/dispositivos.
- Tema escuro, refinamento de acessibilidade e identidade de ícone/splash próprios para distribuição.

## Fases seguintes

Tarefas/checklists/notas independentes de finanças; notificações; investimentos manuais; planejamento de viagens; integrações financeiras oficiais. Não há integração bancária, execução de transferências ou compra de ativos nesta base.
