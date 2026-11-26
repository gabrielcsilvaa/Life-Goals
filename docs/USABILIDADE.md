# Primeiro uso pessoal — 25/11/2026

Pedido: tornar utilizáveis os cadastros e configurações, preservando a identidade visual. Gabriel autorizou configurar somente PostgreSQL e escolheu instalação local isolada no Windows.

## Caminhos implementados

- Dashboard: demonstração identificada, Configurar meu aplicativo e guia de conta financeira/saldo, categoria e primeira receita.
- Adicionar, com texto visível na navegação: despesa, receita, meta de viagem, outra meta, despesa fixa ou compra no cartão. Dependências faltantes levam ao cadastro correto.
- Metas: Nova meta visível; viagem tem destino, capa, alvo, plano opcional do mês e prazo. Plano e meta são criados atomicamente sem alterar reservas reais.
- Configurar: páginas separadas para contas, categorias, receitas, despesas fixas, cartões, orçamento, conta e IA. Conexão técnica fica recolhida.
- Datas nativas e DD/MM/AAAA na web; pago/recebido exige escolha e data. Erros aparecem acima das ações, preservando entradas.
- Proteção de sequência: bloquear comandos concorrentes e fechar somente o formulário que iniciou a operação.

## Banco e execução

PostgreSQL 18.7 migrado, papel exclusivo sem superusuário, porta local 5433. Credenciais privadas e dados em `.local`/`backend/.env`, fora do controle de versão. API na porta8000 para o Wi-Fi; Expo Go em8082. O IP é configurado localmente pelo launcher. O computador precisa estar ligado. Ver BANCO.md para iniciar e fazer backup.

## Evidências

- 36 testes backend passaram; teste integrado opcional executado separadamente passou, cobrindo dois fluxos de navegador/API.
- 8 testes TypeScript passaram; 7 testes E2E padrão passaram. Os dois E2E de API são executados pelo teste integrado acima.
- Fluxo de primeiro uso: cadastro vazio → saldo500 → categoria → receita recebida1000 → meta com plano300 → despesa paga25 → disponível1175. Valores exclusivamente de teste.
- Checagem separada no PostgreSQL real passou com cadastro, despesa, meta/plano, reserva, idempotência e isolamento. Todos os registros temporários foram revertidos.
- Backup pg_dump criado e sua listagem validada. Restauração completa ainda não homologada.
- Typecheck, lint, Ruff e Expo Doctor20/20 passaram; bundles web/Android/iOS exportados.
- Capturas em artifacts/usability a320/390/1440. Revisão independente confirmou correções de cabeçalhos, rótulo Adicionar e linhas de recorrência.

As capturas e a revisão são de Expo Web. O usuário testa a prévia no iPhone; isso ainda não equivale a homologação nativa completa pelo agente.
