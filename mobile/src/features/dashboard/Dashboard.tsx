import { GettingStarted } from "../GettingStarted";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dashboardTheme as theme } from "../../design/dashboard";
import { cents, decimal, monthLabel, shortDate } from "../../lib/money";
import { useApp } from "../../state/AppProvider";
import {
  Action,
  BottomNavigation,
  Cash,
  GoalPreview,
  Icon,
  MonthCommitment,
  Sheet,
} from "./components";
import { s } from "./styles";

const c = theme.color;
export default function Dashboard() {
  const {
    data,
    month,
    setMonth,
    mode,
    loading,
    error,
    notice,
    hidden,
    setHidden,
    reload,
    openForm,
  } = useApp();
  const [panel, setPanel] = useState<"month" | "balance" | "demo" | null>(null);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const insets = useSafeAreaInsets(),
    { width } = useWindowDimensions();
  const summary = data?.summary;
  const commitments = (data?.entries || [])
    .filter((e) => e.kind === "expense" && e.status !== "canceled")
    .sort(
      (a, b) =>
        Number(!!b.card_id) - Number(!!a.card_id) ||
        a.due_date.localeCompare(b.due_date),
    )
    .slice(0, 2);
  const goal = data?.goals[0];
  const waitingIncome =
    summary && cents(summary.income_expected) > cents(summary.income_received);
  return (
    <View style={[s.stage, width > 600 && s.wideStage]}>
      <View testID="dashboard-redesign" style={s.app}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.content,
            { paddingTop: Math.max(insets.top, 28) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={loading && !!data}
              onRefresh={() => void reload()}
              tintColor={c.olive}
            />
          }
        >
          <View style={s.header}>
            <View style={s.greetingRow}>
              <Text accessibilityRole="header" style={s.greeting}>
                oi, {data?.user.name.split(" ")[0] || "você"}
              </Text>
              <Icon name="sun" size={31} color={c.sun} />
            </View>
            <View style={s.headerUtilities}>
              <Action
                label={hidden ? "Mostrar valores" : "Ocultar valores"}
                icon={hidden ? "eye-off" : "eye"}
                onPress={() => setHidden(!hidden)}
              />
            </View>
            <View style={s.monthRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Selecionar mês: ${monthLabel(month)}`}
                onPress={() => {
                  setYear(Number(month.slice(0, 4)));
                  setPanel("month");
                }}
                style={({ pressed }) => [
                  s.monthControl,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={s.monthText}>
                  {monthLabel(month).replace(" de ", " ")}
                </Text>
                <Icon name="chevron-down" size={19} />
              </Pressable>
              {mode === "demo" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sobre a demonstração"
                  onPress={() => setPanel("demo")}
                  style={s.demoControl}
                >
                  <Text style={s.demoLabel}>Demonstração</Text>
                </Pressable>
              )}
            </View>
          </View>
          <GettingStarted />
          {!!error && (
            <View accessibilityRole="alert" style={s.message}>
              <Text style={s.messageText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void reload()}
                style={s.retry}
              >
                <Text style={s.retryText}>Tentar novamente</Text>
              </Pressable>
            </View>
          )}
          {!data || !summary ? (
            <View style={s.loadingData}>
              {loading ? (
                <ActivityIndicator color={c.olive} />
              ) : (
                <Text style={s.body}>Não foi possível carregar este mês.</Text>
              )}
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Entender cálculo disponível"
                onPress={() => setPanel("balance")}
                style={({ pressed }) => [
                  s.balance,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Image
                  source={require("../../../assets/dashboard/lighthouse.png")}
                  contentFit="contain"
                  contentPosition="bottom right"
                  style={s.lighthouse}
                  accessible={false}
                />
                <View style={s.balanceText}>
                  <Text style={s.balanceLabel}>disponível para gastar</Text>
                  <Cash value={summary.available} display />
                  <View style={s.balanceRule} />
                  <View style={s.balanceBreakdown}>
                    <View style={s.balanceColumn}>
                      <Text style={s.balanceCaption}>
                        saldo{"\n"}registrado
                      </Text>
                      <Cash
                        value={summary.balance}
                        style={[
                          s.balanceAmount,
                          width < 360 && { fontSize: 12 },
                        ]}
                      />
                    </View>
                    <View style={s.balanceDivider} />
                    <View style={s.balanceColumn}>
                      <Text style={s.balanceCaption}>
                        compromissos{"\n"}em aberto
                      </Text>
                      <Cash
                        value={summary.unpaid}
                        style={[
                          s.balanceAmount,
                          width < 360 && { fontSize: 12 },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </Pressable>
              {cents(summary.available) < 0 && (
                <Text style={s.explanation}>
                  {waitingIncome
                    ? "Faltam recursos para cobrir os compromissos. Receitas previstas ainda não entraram no saldo."
                    : "Os compromissos superam o valor livre. Isso não significa que sua conta bancária esteja negativa."}
                </Text>
              )}
              <View style={s.section}>
                <View style={s.sectionHeading}>
                  <Text accessibilityRole="header" style={s.sectionTitle}>
                    meu mês
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Ver todos os lançamentos"
                    onPress={() => router.push("/transactions")}
                    style={s.iconAction}
                  >
                    <Icon name="arrow-right" />
                  </Pressable>
                </View>
                {commitments.length ? (
                  commitments.map((e) => (
                    <MonthCommitment key={e.id} entry={e} />
                  ))
                ) : (
                  <View style={s.empty}>
                    <Text style={s.body}>Nenhum compromisso neste mês.</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openForm("create_transaction")}
                      style={s.inlineAction}
                    >
                      <Text style={s.inlineActionText}>
                        Adicionar lançamento
                      </Text>
                      <Icon name="plus" size={18} color={c.olive} />
                    </Pressable>
                  </View>
                )}
              </View>
              <View style={s.section}>
                <View style={s.sectionHeading}>
                  <Text accessibilityRole="header" style={s.sectionTitle}>
                    objetivos
                  </Text>
                  <Action
                    label="Ver todos os objetivos"
                    icon="arrow-right"
                    onPress={() => router.push("/goals")}
                  />
                </View>
                {goal ? (
                  <GoalPreview goal={goal} />
                ) : (
                  <View style={s.empty}>
                    <Text style={s.body}>Qual é o seu próximo objetivo?</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openForm("create_goal")}
                      style={s.inlineAction}
                    >
                      <Text style={s.inlineActionText}>Criar um objetivo</Text>
                      <Icon name="plus" size={18} color={c.olive} />
                    </Pressable>
                  </View>
                )}
              </View>
              {!!notice && (
                <Text accessibilityRole="alert" style={s.feedback}>
                  {notice}
                </Text>
              )}
            </>
          )}
        </ScrollView>
        <BottomNavigation />
        {panel === "month" && (
          <Sheet title="escolher mês" close={() => setPanel(null)}>
            <View style={s.yearRow}>
              <Action
                label="Ano anterior"
                icon="chevron-left"
                onPress={() => setYear((y) => y - 1)}
              />
              <Text style={s.year}>{year}</Text>
              <Action
                label="Próximo ano"
                icon="chevron-right"
                onPress={() => setYear((y) => y + 1)}
              />
            </View>
            <View style={s.monthGrid}>
              {Array.from({ length: 12 }, (_, i) => {
                const value = `${year}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={monthLabel(value)}
                    accessibilityState={{ selected: month === value }}
                    onPress={() => {
                      setMonth(value);
                      setPanel(null);
                    }}
                    style={({ pressed }) => [
                      s.monthOption,
                      month === value && s.monthSelected,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        s.monthOptionText,
                        month === value && { color: c.onOlive },
                      ]}
                    >
                      {monthLabel(value).split(" de ")[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Sheet>
        )}
        {panel === "balance" && summary && (
          <Sheet title="seu disponível" close={() => setPanel(null)}>
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={s.criteriaContent}
            >
              <Text style={s.body}>
                Saldo registrado é o dinheiro informado nas contas. O disponível
                desconta compromissos, reservas e planos; pode ser negativo
                mesmo com saldo positivo.
              </Text>
              {[
                ["Saldo em contas", summary.balance],
                ["Reservado para objetivos", summary.reserved],
                ["Compromissos em aberto", summary.unpaid],
                ["Orçamento restante", summary.budget_remaining],
                ["Aportes planejados restantes", summary.goal_plan_remaining],
              ].map(([label, value], i) => (
                <View key={label} style={s.criterion}>
                  <Text style={s.criterionLabel}>
                    {i ? "− " : ""}
                    {label}
                  </Text>
                  <Cash value={value} />
                </View>
              ))}
              <View style={s.criterion}>
                <Text style={[s.body, { fontFamily: theme.font.medium }]}>
                  Disponível para gastar
                </Text>
                <Cash value={summary.available} />
              </View>
              <View style={s.criterion}>
                <Text style={s.criterionLabel}>Receitas ainda previstas</Text>
                <Cash
                  value={decimal(
                    cents(summary.income_expected) -
                      cents(summary.income_received),
                  )}
                />
              </View>
              {summary.projected_available !== undefined && (
                <View style={s.criterion}>
                  <Text style={s.criterionLabel}>
                    Se receber o previsto do mês
                  </Text>
                  <Cash value={summary.projected_available} />
                </View>
              )}
              <Text style={s.explanation}>
                Receitas previstas não são saldo recebido. Valores registrados
                até {shortDate(data!.as_of)}.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPanel(null);
                  router.push("/planning");
                }}
                style={s.primaryButton}
              >
                <Text style={s.primaryButtonText}>Ver planejamento</Text>
              </Pressable>
            </ScrollView>
          </Sheet>
        )}
        {panel === "demo" && (
          <Sheet title="dados de exemplo" close={() => setPanel(null)}>
            <Text style={s.body}>
              Você está explorando uma demonstração. Suas alterações ficam neste
              dispositivo e não entram na conta real.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setPanel(null);
                router.push("/settings");
              }}
              style={s.primaryButton}
            >
              <Text style={s.primaryButtonText}>Conectar minha conta</Text>
            </Pressable>
          </Sheet>
        )}
      </View>
    </View>
  );
}
