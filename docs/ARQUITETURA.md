# Arquitetura

## Decisões

Monólito modular Django + DRF, PostgreSQL e Expo/TypeScript. API e MCP são adaptadores dos serviços em `backend/finance/services.py`; rotinas agendadas também devem chamar esses serviços. Django ASGI e o SDK oficial MCP compartilham o processo Uvicorn. Não há dependência de uma API de LLM no backend.

`Entry` reúne o lançamento e seu compromisso nesta primeira versão. `CashMovement` registra cada liquidação parcial. O vínculo entre eles substitui uma tabela intermediária de liquidação enquanto cada movimento liquida um único compromisso. `CardInvoice` reúne parcelas; um pagamento de fatura cria movimentos vinculados às parcelas, atomicamente. Essa simplificação mantém as distinções financeiras sem duplicar entidades que ainda teriam relação 1:1. Uma futura conciliação bancária com rateios pode introduzir alocações sem mudar os serviços públicos.

`GoalPlan` e `Budget` contêm intenção. `GoalAllocation` contém reservas e retiradas reais sobre saldos existentes. Reservar dinheiro não cria despesa nem altera saldo de conta; identifica uma parte indisponível para gasto livre.

## Invariantes

1. Receita prevista não altera saldo. Despesa prevista cria obrigação, mas não movimento.
2. Cada movimento liquidado tem conta, valor e data. Pagamentos parciais somam até o valor do compromisso.
3. Parcela cria compromisso e dívida, sem retirar dinheiro da conta. Sua quitação reduz dívida e caixa, sem gerar nova despesa.
4. Compras parceladas conservam o total em centavos. O restante é distribuído nas primeiras parcelas.
5. Cada cartão tem no máximo uma fatura por competência. A primeira data é informada e validada; não presumimos o processamento interno da operadora.
6. Nubank bloqueado é um estado interno. Pagamentos existentes continuam permitidos.
7. Saldo de meta deriva das alocações; não há campo livre de acumulado para divergir do histórico.
8. Planos mensais podem ser alterados ou redistribuídos; as operações e seus valores ficam na auditoria.
9. Uma ocorrência recorrente é única por regra e mês. Cancelá-la não permite recriá-la silenciosamente.
10. Alterar uma regra afeta apenas ocorrências ainda não geradas. Alterar um compromisso gerado é uma ação separada.
11. Cancelamento preserva o registro. Lançamentos realizados ou parcelas não são apagados/editados pelo fluxo simples.
12. Dinheiro usa `Decimal`/`NUMERIC`. O cliente envia strings decimais; cálculos da demonstração usam centavos inteiros.
13. Movimentações realizadas não podem estar no futuro nem anteceder a abertura da conta.
14. Alocações de metas retroativas anteriores a outros movimentos são rejeitadas nesta versão para preservar o histórico disponível.

## Cálculo de disponibilidade

Data de corte = menor entre hoje (fuso do usuário) e o fim do mês consultado. Considera:

`saldo registrado − reservas efetivas − compromissos abertos até o fim do mês − orçamento de categoria ainda não comprometido − aportes planejados restantes`.

Compromissos incluem atrasos de meses anteriores. Orçamento restante desconta despesas já registradas na categoria para não duplicá-las. Aportes realizados consomem o plano do mês; não são subtraídos duas vezes. Receitas futuras são mostradas separadamente e não entram no disponível.

Gráfico de fluxo = entradas e saídas efetivas por data de movimento. Gráfico de categoria = pagamentos diretos e parcelas de compras no mês de vencimento. Essas visões têm bases diferentes e são identificadas na interface.

## Isolamento e concorrência

Cada entidade pertence a um usuário. A identidade vem de JWT ou conexão MCP validada. Referências são buscadas com proprietário e ID; UUID não é uma permissão. Listagens, resumos e auditoria devem ser filtrados da mesma forma.

Comandos iniciam uma transação e bloqueiam a linha do proprietário (`select_for_update`). Isso serializa escritas da mesma pessoa e permite paralelismo entre pessoas, uma estratégia simples para este domínio. PostgreSQL deve ser usado para validar esse comportamento antes de liberar contas reais. Restrições de unicidade completam a proteção contra duplicidades.

A chave de idempotência é única por usuário e registra operação, hash do payload normalizado e resultado. Repetição recupera o resultado; outra entrada com a mesma chave gera 409. O cliente mantém a chave ao repetir uma falha de rede durante a sessão. Reiniciar o aplicativo após uma resposta incerta ainda exige conferir o histórico; uma fila persistente de operações não está implementada.

## Evolução

Índices por usuário/período, agregação SQL e paginação nas listagens. O dashboard retorna até 200 lançamentos e informa o total. O histórico completo tem endpoint paginado; a interface permite carregar páginas adicionais. Filtros locais indicam quando há registros ainda não carregados.

Não há cache de saldo, fila distribuída ou event sourcing. Auditoria não substitui logs operacionais: registra operações com dados financeiros necessários, sob o mesmo isolamento. Não registrar tokens, senhas ou payloads financeiros completos em logs de infraestrutura.

Antes da produção: HTTPS, política de recuperação de conta, monitoramento, backup restaurado, limitação de requisições MCP no proxy, política de dados e confirmação externa para ferramentas destrutivas. Nenhuma ferramenta destrutiva é exposta pelo MCP nesta versão.
