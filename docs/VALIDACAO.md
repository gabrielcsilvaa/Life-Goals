# Verificações da entrega — 25/11/2026

## Evidências executadas

| Verificação | Resultado |
| --- | --- |
| Pytest completo com `LIFEGOALS_RUN_UI=1` | 32 testes aprovados |
| Testes TypeScript de dinheiro e demonstração | 7 aprovados |
| Playwright padrão | 2 fluxos aprovados; fluxo com API é executado separadamente pelo pytest |
| Navegador → API Django → banco temporário | Login, despesa realizada de R$ 32, saldo de R$ 1.968 e logout aprovados |
| MCP HTTP | Autenticação, descoberta, escrita real, repetição, isolamento, escopos, expiração e revogação aprovados |
| Cliente MCP oficial por STDIO | Inicialização e descoberta do catálogo aprovadas |
| TypeScript | Sem erros |
| ESLint | Sem erros ou avisos na revisão final |
| Ruff | Sem erros; formatação conferida |
| Django system check | Sem problemas identificados |
| Migrações pendentes de geração | Nenhuma |
| Expo Doctor | 20 de 20 verificações aprovadas |
| Exportação web | Concluída |
| Exportação do bundle Android/Hermes | Concluída |
| npm audit | Zero vulnerabilidades conhecidas reportadas |

Os testes financeiros incluem parcelas e centavos, virada de ano, bloqueio lógico, pagamentos parciais, ausência de duplicidade, recorrências, alteração de planos e retirada de reservas. Os testes de navegador verificam criação, edição, cancelamento, persistência da demonstração, navegação responsiva e ausência de conexão MCP automática.

Foi corrigida a liberação do cabeçalho `Idempotency-Key` no CORS a partir do teste integrado. O gráfico web foi ajustado para evitar propriedades nativas encaminhadas ao DOM; a seleção é feita pela legenda acessível. As execuções de navegador e API usam pastas de artefatos distintas.

Há um aviso de depreciação da dependência Starlette nos testes: seu TestClient recomenda migração futura de httpx para httpx2. O SDK MCP instalado ainda utiliza httpx. Não há falha associada, e nenhuma supressão foi adicionada.

## Limites destas evidências

- Nenhum PostgreSQL persistente da aplicação foi criado, configurado ou migrado.
- Os testes de banco usam SQLite temporário em memória. Concorrência e bloqueios PostgreSQL ainda precisam de validação específica.
- A exportação Android gera o bundle JavaScript/Hermes; não é APK/AAB assinado e não comprova instalação em aparelho.
- Não foi realizado build nativo iOS nem publicação em lojas.
- Não foram criadas conexões reais nas contas Claude, Codex, ChatGPT ou outros clientes do usuário.
- OAuth ainda será implementado; o servidor atual usa tokens pessoais revogáveis.
- A aplicação não está publicada na internet e não possui integração bancária.

Consulte o [roadmap](ROADMAP.md) para o restante das fases e o [roteiro de PostgreSQL](BANCO.md) para a próxima etapa.
