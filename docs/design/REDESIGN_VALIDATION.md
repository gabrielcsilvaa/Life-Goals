# Life Goals — telas financeiras

Entrega de 25/11/2026. Referências: approved-reference.png e screens-reference.png.

## Implementação
Dashboard preservado, navegação uniforme. Lançamentos, metas, detalhe da meta, registro/edição em painel inferior, orçamento/recorrências/cartões e configurações usam o mesmo sistema creme/oliva.

Capas ilustrativas: Europa, África, Ásia, América do Norte, América do Sul, Oceania e Antártida. Opções da meta → Escolher capa. A preferência é local por conta/servidor/dispositivo e não é sincronizada pelo backend ou MCP. Proveniência e prompts em mobile/assets/travel/provenance.json.

Snapshot Goal.history é uma extensão aditiva: seis meses de reservas efetivas acumuladas, com retiradas e data de corte. Não há alteração de modelo ou migração. Nenhum banco persistente foi criado.

## Evidências
- 32 testes backend passaram; 1 teste opcional de navegador executado separadamente passou com API Django e SQLite efêmero.
- 8 testes TypeScript passaram.
- 5 fluxos E2E passaram; teste API foi pulado nesta execução e validado separadamente acima.
- Após correção final de legenda e link, o fluxo de telas/capas foi reexecutado e passou.
- TypeScript e lint passaram; Expo exportou web, Android e iOS.
- Capturas em artifacts/redesign, larguras 320/390/1440. Revisão independente: duas correções materiais resolvidas, disposição ship restrita ao Expo Web.
- Sem instalação ou validação em aparelho/emulador iOS/Android. Exportação de bundles não é distribuição de aplicativo nativo.

A prévia é http://127.0.0.1:8081/ e depende do servidor local em execução. Valores de exemplo permanecem previsões e reservas reais zero; não copiamos os resultados financeiros ilustrados nas referências.
