---
name: "Life Goals — organização pessoal"
description: "Sistema creme e oliva estendido às telas financeiras conforme a nova referência do usuário."
colors:
  background: "#F7F0E8"
  surface: "#F0E7DC"
  olive: "#344A35"
  oliveSoft: "#647252"
  ink: "#29251F"
  muted: "#71685D"
  line: "#DED3C5"
  onOlive: "#FAF4E9"
  onOliveMuted: "#E4E6D7"
  action: "#747A50"
  sun: "#BD8429"
  error: "#96493E"
  balanceRule: "#B5BBA3"
  progressTrack: "#DCD4C7"
  checkBorder: "#9E927F"
  wideBackground: "#EDE4D8"
  scrim: "#29251F66"
typography:
  greeting:
    fontFamily: "DMSerifDisplay_400Regular_Italic"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: "53px"
  display:
    fontFamily: "DMSerifDisplay_400Regular"
    fontSize: "42px"
    fontWeight: 400
    lineHeight: "57px"
  headline:
    fontFamily: "DMSerifDisplay_400Regular"
    fontSize: "29px"
    fontWeight: 400
    lineHeight: "39px"
  body:
    fontFamily: "Inter_400Regular"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "23px"
  label:
    fontFamily: "Inter_400Regular"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  goal-title:
    fontFamily: "Inter_500Medium"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "22px"
  button:
    fontFamily: "Inter_500Medium"
    fontSize: "15px"
    fontWeight: 500
rounded:
  balance: "20px"
  goal: "12px"
  control: "8px"
  primary-button: "10px"
  sheet: "18px"
  add: "25px"
  check: "4px"
  progress: "3px"
spacing:
  gutter: "20px"
  small: "8px"
  group: "12px"
  section: "28px"
  card-padding: "24px"
components:
  button-primary:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.onOlive}"
    typography: "{typography.button}"
    rounded: "{rounded.primary-button}"
    padding: "14px"
  button-inline:
    textColor: "{colors.olive}"
    typography: "{typography.button}"
  button-icon:
    textColor: "{colors.ink}"
    size: "48px"
  button-add:
    backgroundColor: "{colors.action}"
    textColor: "{colors.onOlive}"
    rounded: "{rounded.add}"
    size: "50px"
  balance-card:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.onOlive}"
    rounded: "{rounded.balance}"
    padding: "24px"
  goal-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.goal}"
  month-selected:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.onOlive}"
    rounded: "{rounded.control}"
---
# Design System: Life Goals — organização pessoal

## Overview

**Creative North Star: "Referências aprovadas — organização pessoal"**

Sistema visual baseado nas referências aprovadas `../docs/design/approved-reference.png` e `../docs/design/screens-reference.png`. A entrega começou isolada no dashboard; o usuário autorizou em seguida estender o sistema às telas financeiras e seus formulários. As capturas entregues continuam disponíveis para revisão do usuário.

Creme quente, oliva profundo e contraste entre serifada editorial e texto funcional formam uma leitura pessoal e contínua do mês. O nome Life Goals é provisoriamente tipográfico; o farol é um recorte decorativo, sem função de logotipo ou mascote.

**Key Characteristics:**
- Uma coluna mobile, inclusive no preview desktop.
- Hierarquia serifada com informações funcionais em Inter.
- Profundidade por cor e recorte, sem sombras ou gradientes.
- Valores, pagamentos e reservas vinculados aos dados existentes.

## Colors

### Primary
Oliva profundo (`olive`) ancora o saldo e as ações de confirmação. `oliveSoft` indica o progresso das metas; `action` distingue a ação circular central. `onOlive` e `onOliveMuted` organizam a leitura sobre o card escuro.

### Secondary
`sun` é o acento pontual do ícone de saudação. `error` identifica mensagens de falha, sem substituir o texto explicativo.

### Neutral
`background` é o papel creme da tela; `surface` agrupa objetivo e feedback. `ink` é o texto principal e `muted` a informação auxiliar. `line` separa compromissos; `balanceRule`, `progressTrack` e `checkBorder` pertencem aos seus padrões específicos. `wideBackground` enquadra a coluna em telas largas e `scrim` separa o painel modal.

## Typography

**Display Font:** DM Serif Display regular e itálica, carregada localmente pelo pacote Expo Google Fonts, sob OFL. Os nomes de família registrados no app estão no frontmatter.

**Body Font:** Inter regular e medium, carregada localmente pelo pacote Expo Google Fonts, sob OFL. As fontes e os ícones são carregados pelo layout raiz para todas as rotas, evitando troca de tipografia ou ícones ausentes ao navegar.

A saudação usa a variante itálica; seções e cifra principal usam a regular. Inter sustenta controles, legendas e cifras auxiliares com numerais tabulares. Cormorant foi comparada, mas o contraste delicado e a altura útil menor prejudicaram cifras pequenas. Fraunces apresentou formas mais expressivas e arredondadas que a referência.

Os papéis normativos constam no frontmatter. A cifra principal ajusta dinamicamente seu tamanho entre 23 e 42, com teto 32 em larguras inferiores a 360; considera o comprimento do valor e a largura disponível. A fonte do dispositivo serve como fallback se o carregamento falhar, com aviso visível.

## Layout

Uma coluna com largura máxima de 480 e margens laterais internas de 20. Em largura superior a 600, o fundo externo muda para o tom `wideBackground`; a composição permanece mobile. O topo respeita a área segura ou 28, o que for maior. Conteúdo tem respiro inferior de 24 e a navegação respeita a área segura inferior ou 12.

A escala exportada em `src/design/dashboard.ts` inclui os espaçamentos de 8, 12, 20 e 28; o dashboard implementado usa margem de seção de 20. Não confundir o token exportado `section` com uma medida aplicada universalmente. O card de saldo tem altura mínima de 215 e preenchimento de 24. O painel modal tem largura máxima de 440 e altura máxima de 85%.

## Elevation & Depth

Não há sombras ou gradientes. Superfícies tonais, divisores e recorte de imagem dão profundidade. O modal usa `scrim` translúcido e animação nativa `fade`; não há duração personalizada ou easing definido no código. Pressionar reduz a opacidade conforme o componente; não há animação de elevação.

## Shapes

O saldo e a prévia de objetivo usam cantos suaves distintos; seus raios e os dos controles estão no frontmatter. A ação central é circular, a marca de compromisso é um pequeno quadrado arredondado e o progresso é uma faixa de altura 6. O recorte dos cards contém suas imagens, sem bordas decorativas adicionais.

## Components

### Buttons
Ação primária oliva com texto claro, altura mínima de 48 e preenchimento de 14. Ação inline mantém texto e ícone oliva sobre o fundo. Botões de ícone têm área mínima de 48 por 48. A ação central usa diâmetro de 50 e fica desabilitada sem dados ou durante carregamento. O estado pressionado é comunicado por opacidade; estados hover específicos não foram implementados no React Native.

### Cards / Containers
Saldo usa oliva, cifra serifada e farol decorativo sem anúncio ao leitor de tela. O toque abre os critérios de cálculo. Prévia de objetivo usa a superfície secundária, título Inter medium e progresso com valor acessível. Os snippets do sidecar representam a geometria dos componentes, sem reproduzir valores de conta ou assets remotos.

### Navigation
Cinco posições de largura igual: início, lançamentos, registro central, metas e configurações. Planejamento fica acessível em configurações e no cálculo do dashboard. As quatro rotas usam controles de 52 por 52 centralizados nos seus slots; a ação central mantém diâmetro de 50. Rotas existentes são preservadas. Ícones Feather lineares recebem rótulos acessíveis; a seleção visual do início usa oliva. Ações de seção levam a lançamentos ou objetivos.

### Compromissos e mês
A lista apresenta até dois compromissos existentes, priorizando os de cartão e ordenando por vencimento. A marca preenchida corresponde a pagamento registrado; tocar numa pendência abre o formulário de pagamento, sem confirmar implicitamente. O seletor modal usa três colunas de meses e seleção oliva.

### Imagens e estados
`assets/dashboard/lighthouse.png` e `assets/dashboard/italy.png` são ilustrações raster autônomas geradas por IA com o recurso integrado image_gen; os prompts e a otimização com Expo image-utils estão em `assets/dashboard/provenance.json`. O farol é um recorte transparente decorativo. A imagem de arquitetura italiana é ilustrativa, não uma fotografia recebida de viagem do usuário. Ela aparece automaticamente em nomes reconhecidos como viagem para Europa/Itália; as demais capas seguem os destinos reconhecidos e podem ser escolhidas no detalhe da meta. Objetivos sem capa recebem um ícone apropriado. Assets são locais e não exigem rede para renderizar.

Preservar estados vazios, carregamento, falha com repetição, demonstração identificada, ocultação de valores, saldo negativo explicado, nomes longos, cifras grandes e confirmação das operações. Não há campo de texto novo no dashboard; os formulários compartilham painel inferior creme, campos contornados, opções recolhidas em seletores e ação Salvar em oliva.

## Primeiro uso e descoberta das ações
Após teste no iPhone, o usuário apontou caminhos escondidos. Preservar os tokens e a identidade; corrigir os fluxos:

- Demonstração identificada e CTA “Configurar meu aplicativo”. A conta pessoal começa vazia no PostgreSQL, sem importar exemplos.
- Conta financeira/saldo → categoria → primeira receita. Desabilitar o próximo comando enquanto o anterior está sendo salvo e fechar apenas o formulário que iniciou a operação.
- Navegação com rótulos. “Adicionar” abre Despesa, Receita, Meta de viagem, Outra meta, Despesa fixa e Compra no cartão; lista rolável em telas menores.
- Metas têm botão de texto “Nova meta”. Viagem pede destino, capa, alvo, planejamento opcional do mês e prazo. Meta e plano inicial são salvos atomicamente, sem criar reservas.
- Datas: seletor nativo; web mostra DD/MM/AAAA. Pagamento/recebimento é uma escolha explícita e exige data.
- Configurar separa contas, categorias, receitas, recorrências, cartões, orçamento, conta e IA. URL do servidor fica recolhida em configuração de conexão.
- Capturas de modais aguardam animações terminarem; um fade intermediário não comprova o resultado final.

## Do's and Don'ts

### Do:
- **Do** preservar o mesmo sistema em todas as rotas autorizadas pelo usuário.
- **Do** usar valores do Snapshot e distinguir previsão de recebimento realizado.
- **Do** usar reservas efetivas no progresso dos objetivos e confirmar operações financeiras.
- **Do** preservar rótulos acessíveis, ocultação de valores e áreas de toque dos controles.

### Don't:
- **Don't** reintroduzir sidebar SaaS ou estilos antigos nas rotas financeiras.
- **Don't** copiar cifras da referência nem simular receita recebida, pagamentos ou aportes.
- **Don't** apresentar imagens geradas como fotografias de viagens do usuário.
- **Don't** criar moldura de telefone, status bar falsa, tarefas fictícias, mascote ou logotipo definitivo.


## Extensão autorizada — 25/11/2026
O usuário pediu explicitamente aplicar o novo modelo às demais telas, após a entrega isolada do dashboard. Referência adicional: `../docs/design/screens-reference.png`. A identidade e os tokens existentes são preservados; não há nova direção visual.

- Lançamentos: cabeçalho serifado, seletor mensal, entradas recebidas/saídas pagas, filtros horizontais, busca e grupos por vencimento. Previsões mantêm status visível, edição e realização explícita.
- Metas: filtros Todas/Em andamento/Concluídas, capa somente quando apropriada, acumulado real, alvo e progresso. Toque abre rota `/goal?id=...`.
- Detalhe: capa ampla, valor acumulado, progresso, prazo editável, planejamento mensal e evolução real de seis meses. Zeros permanecem zero; o gráfico inclui retiradas e não utiliza aportes planejados. A API adiciona `Goal.history` ao snapshot, sem alteração de modelos ou migração.
- Capas: Europa + África, Ásia, América do Norte, América do Sul, Oceania e Antártida. Fotografia ilustrativa gerada por IA, com proveniência em `assets/travel/provenance.json`. Escolha em Opções da meta → Escolher capa; automática por nome ou Sem imagem. A preferência é local ao dispositivo e isolada por conta/servidor; não é sincronizada com o backend/MCP.
- Formulários: painel inferior com alça, creme, títulos serifados, campos contornados e segmentação Despesa/Receita. Categoria exige escolha explícita ao criar um lançamento. Realização em branco continua sendo previsão; nenhuma interação visual realiza pagamentos por conta própria.
- Orçamento, recorrências, cartões e configurações utilizam o mesmo shell sem sidebar, com todos os comandos anteriores preservados.

Validação visual em Edge/Expo Web a 320, 390 e 1440px. Bundles nativos exportados não substituem teste em aparelho iOS/Android.
