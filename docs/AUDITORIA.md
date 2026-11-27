# Auditoria do Life Goals — 26/11/2026

## Resultado e escopo

Auditoria do monólito Django, API REST, serviços financeiros, recorrências, cartões, metas, OAuth/MCP e aplicativo Expo. A identidade visual creme/oliva e os componentes existentes foram preservados. A correção anterior da fatura inicial permanece intacta e coberta por regressões.

Os dados pessoais foram consultados em transação PostgreSQL explicitamente `READ ONLY`. Não foram usados como massa de teste, alterados, removidos ou unificados. Evidências financeiras privadas e saídas de scanners ficam em `.local/`, ignorada pelo Git.

## 1. Diagnóstico

| ID | Classificação / gravidade | Causa e impacto | Resultado |
| --- | --- | --- | --- |
| FIN-01 | Bug confirmado / alta | Ao abrir um mês futuro distante, a geração pulava os meses futuros intermediários. O disponível podia omitir obrigações e depender da ordem de navegação. | Geração contínua até o mês consultado; sem recebimentos ou pagamentos automáticos. |
| FIN-02 | Bug confirmado / alta | `update_transaction` aceitava lançamento avulso de cartão, mudando vencimento sem atualizar a fatura vinculada. | Edição genérica rejeitada para lançamentos de cartão, coerente com a interface e as correções existentes. |
| FIN-03 | Bug confirmado / alta | O bloqueio do usuário era liberado depois de gerar recorrências e antes de consultar todos os totais. Uma escrita simultânea podia misturar estados no resumo. | `snapshot` mantém a transação e o bloqueio do usuário até concluir todos os totais. |
| NET-01 | Bug confirmado / média | O tempo limite era encerrado após os cabeçalhos HTTP. Um corpo de resposta interrompido podia bloquear a operação. | Timeout inclui a leitura JSON; tratamento explícito de HTTP 204 e resposta inválida. |
| NET-02 | Risco técnico corrigido / alta | Respostas de uma sessão anterior podiam chegar depois da troca/saída de conta. | Validação de geração na API e no estado; respostas antigas não substituem a sessão atual. |
| UX-01 | Bug / média | Ao trocar o mês, os valores anteriores continuavam visíveis com o novo seletor enquanto a consulta carregava ou falhava. | Valores anteriores são retirados durante a troca; falhas têm recuperação por atualização. |
| UX-02 | Problema de UX / média | A criação de um registro zerava busca/filtros; sair da tela também perdia esse contexto. | Filtros por conta e mês preservados na sessão. Trocar de conta não reutiliza o contexto de outra pessoa. |
| UX-03 | Problema de UX / média | Minha conta tinha cabeçalho grande, retorno como link e endereço técnico exposto. | Cabeçalho compacto, retorno com ícone, perfil e preferências úteis; endereço em detalhes avançados. |
| UX-04 | Problema de UX / média | Qualquer data exibia explicações salariais; competências apareciam como dias e rótulos continham formatos internos. | Datas brasileiras, competência em MM/AAAA no web e atalho salarial apenas em receita. |
| UX-05 | Problema de UX / média | Fechar um formulário descartava imediatamente o preenchimento. | Confirmação de descarte no próprio painel, inclusive ao voltar no sistema. |
| UX-06 | Problema de UX / média | Disponível negativo podia ser confundido com saldo bancário negativo; a explicação começava por detalhes contábeis. | Saldo registrado e compromissos aparecem juntos; cálculo progressivo e projeção condicional separados. |
| UX-07 | Problema de UX / baixa | Campos monetários não formatavam a apresentação após edição. | Formatação brasileira ao sair do campo e ao abrir valores existentes, sem arredondar entradas inválidas. |
| QA-01 | Risco técnico / média | Parte dos testes de navegador usava textos/ações antigos; a conexão da thread MCP impedia remover o banco temporário PostgreSQL. | Expectativas atualizadas para ações atuais e conexão de testes encerrada na mesma thread. |

### Comportamentos esperados preservados

- Salário previsto não é receita recebida. O quinto dia útil salarial inclui sábado e exclui domingos e feriados nacionais; calendários locais permanecem uma decisão de produto.
- Recebimentos e pagamentos antecipados movimentam caixa na data efetiva; a competência da obrigação permanece sua data de vencimento.
- Pagamentos parciais reduzem somente o restante aberto. Compras no cartão e pagamento de fatura não subtraem duas vezes do saldo.
- Cartão bloqueado impede novas compras, mas preserva parcelas existentes, faturas e pagamentos.
- Meta, plano mensal, reserva efetiva e retirada continuam objetos distintos. Planejamento não produz dinheiro reservado.
- Cancelar ocorrência não faz sua recorrência recriá-la; pausar uma regra não apaga compromissos já gerados.
- Uma regra ativa e outra pausada, inclusive com nomes iguais, não são automaticamente uma duplicação. Nenhum valor real foi corrigido por suposição.
- Criar conta continua sem importar a demonstração. Categorias iniciais são organização, não lançamentos fictícios.

## 2. Prioridades e decisões

1. Reproduzir perdas de integridade e escrever regressões antes de alterar os serviços.
2. Manter o bloqueio por usuário e a idempotência compartilhada entre REST e MCP.
3. Corrigir falhas de rede e isolamento de sessão sem repetir operações já salvas.
4. Preservar contexto de navegação e proteger o preenchimento.
5. Simplificar conta e explicações, mantendo o design aprovado.

Não foram adicionados microsserviços, bibliotecas de UI ou dependências de execução. Scanners usados na auditoria ficaram em ferramentas locais ignoradas pelo Git.

## 3. Implementação e contratos

### Backend

- `backend/finance/services.py`: recorrências futuras contínuas e restrição de edição de cartão.
- `backend/finance/queries.py`: transação do resumo e campo monetário aditivo `summary.projected_available`.
- `backend/tests/test_audit_finance.py`: reprodução dos bugs, pagamentos/recebimentos antecipados parciais e projeção sem dinheiro inventado.
- `backend/tests/test_concurrency.py`: quatro cenários reais de concorrência PostgreSQL, sem usar SQLite para comprovar bloqueios.
- `backend/tests/test_mcp.py`: consultas MCP e limpeza da conexão assíncrona do ambiente de testes.
- `backend/tests/test_browser_flow.py`: primeiro uso e persistência pela API de teste.

O novo campo de projeção soma ao disponível apenas a parcela ainda não recebida das receitas previstas do mês. É uma hipótese explícita, não um saldo bancário. Campos existentes, nomes, argumentos, escopos e autenticação das ferramentas MCP foram preservados.

### Aplicativo

- `mobile/src/state/AppProvider.tsx`: contexto de filtros, invalidação de sessão, troca de mês sem valores antigos e atualização periódica da conta ativa a cada 60 segundos, além da atualização ao retornar ao app.
- `mobile/src/lib/api.ts` e `transport.ts`: duração completa da requisição, respostas HTTP vazias e proteção contra respostas antigas.
- `mobile/src/lib/formats.ts`: apresentação de datas e dinheiro sem alterar a precisão financeira.
- `mobile/src/lib/demo.ts`: previsões contínuas, separação entre projeção e saldo e mesma restrição de edição de cartão no simulador.
- `Settings.tsx`, `Planning.tsx`, `Transactions.tsx`, `GettingStarted.tsx`, `dashboard/Dashboard.tsx`: hierarquia, contexto e textos de uso.
- `CommandSheet.tsx`, `DateField.tsx`, `ui.tsx`: proteção de rascunhos, datas contextualizadas, teclado e cabeçalhos compactos.

Os filtros são preservados durante a sessão, por conta e mês; não são uma preferência persistida em servidor. A regra financeira principal continua no backend; a demonstração é uma simulação local identificada e não envia comandos financeiros à API.

## 4. Validação

| Verificação | Resultado |
| --- | --- |
| Suíte backend em PostgreSQL temporário | **84 aprovados**, 3 testes de navegador reservados para execução separada. Inclui quatro testes reais de concorrência. |
| Navegador → Django → banco isolado | **3 aprovados**: login e operações, cadastro/primeiro uso e OAuth com consentimento. |
| Lógica mobile | **29 aprovados**. |
| Suíte geral Playwright | **24 aprovados**, 3 fluxos de API executados separadamente. |
| Novos cenários de UX e rede | **7 aprovados**, incluindo os dois casos adicionais de atualização falha. Os cinco primeiros também fazem parte da suíte geral. |
| TypeScript e lint Expo | Aprovados. |
| Django check e verificação de migrações | Sem problemas; nenhuma migração nova necessária. |
| Ruff lint e formatação | Aprovados. |
| Exportação web de produção | Aprovada em `mobile/dist/`, sem versionar o build. |
| npm audit | Nenhuma vulnerabilidade conhecida reportada, incluindo dependências de desenvolvimento. |
| pip-audit | Nenhuma vulnerabilidade conhecida nos pacotes diretos fixados examinados. |
| Gitleaks e comparação com segredos locais | Nenhum vazamento detectado nos arquivos candidatos ao Git. |

Capturas reais foram inspecionadas em 320, 390 e 1440 px e ficam em `artifacts/audit/`, fora do Git. A captura do cálculo espera o encerramento da animação do modal para não confundir transparência transitória com defeito de layout. Esses resultados são do Edge; não representam execução nativa em dispositivos.

O aviso de depreciação `httpx`/Starlette permanece restrito ao cliente de testes. Backend e processo MCP foram recarregados depois da validação, preservando o endereço da integração. A comparação de todos os registros financeiros e eventos de auditoria da conta antes/depois confirmou que o reinício não modificou os dados pessoais.

A suíte PostgreSQL usa um banco temporário com nome exclusivo `test_lifegoals_audit_*`, separado do banco pessoal. O encerramento do teste verifica que esse banco foi removido.

Para repetir a suíte PostgreSQL, configure exclusivamente `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD` e `TEST_DB_NAME` no ambiente. O papel de testes precisa criar/remover o banco temporário; use um nome novo com prefixo `test_lifegoals_audit_`. A configuração rejeita nomes fora desse prefixo e não usa as credenciais pessoais como fallback.

```powershell
.\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini backend/tests --ds=config.postgres_test_settings
# Navegador com API e banco temporário:
$env:LIFEGOALS_RUN_UI = '1'
.\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini backend/tests/test_browser_flow.py backend/tests/test_oauth_browser.py
Remove-Item Env:LIFEGOALS_RUN_UI
```

As credenciais de teste não devem ser commitadas. `config.test_settings` permanece o padrão SQLite em memória para a suíte rápida.

## 5. Riscos restantes e decisões de produto

- Não há emulador Android nem simulador iOS disponíveis neste Windows. Teclado físico/virtual, gestos nativos, seletor nativo de datas e safe areas precisam de homologação em aparelhos. As capturas são do Edge em viewports mobile e desktop.
- HTTP e DEBUG nos launchers são configuração de desenvolvimento em LAN. Produção exige configuração própria com HTTPS, hosts e origens corretos. Não há controle de desenvolvimento azul no código do produto; ferramentas do Expo em desenvolvimento não equivalem à versão exportada.
- Rate limits baseados no cache local não são compartilhados entre múltiplos processos. Cache compartilhado e limite de borda devem ser definidos na implantação de produção.
- A leitura de meses materializa previsões recorrentes, conforme a arquitetura existente. Agora inclui meses intermediários; nenhuma dessas previsões gera movimentação real. Alterações posteriores de regras continuam valendo apenas para ocorrências ainda não geradas.
- A data inicial da compra é confirmada pelo usuário. A sugestão de vencimento não consulta o banco emissor do cartão.
- A atualização por IA torna-se visível no próximo refresh, retorno ao app ou intervalo de atualização. Não foi introduzido canal de sincronização em tempo real.
- Acesso web continua em memória. Reabrir a página exige login; persistir credenciais no navegador exige uma decisão de arquitetura/autenticação própria.
- Testes e scanners reduzem risco, mas não substituem pentest, restauração de backup ou homologação de produção. A auditoria Python de dependências cobre os pacotes diretos fixados em `requirements.txt`; não é inventário completo de dependências transitivas.

Referências consultadas: documentação do [Expo 58](https://docs.expo.dev/versions/v58.0.0/), [navegação Expo Router](https://docs.expo.dev/router/basics/navigation/), [AppState](https://reactnative.dev/docs/appstate) e [KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview).
