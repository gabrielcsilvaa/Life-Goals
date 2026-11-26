import { router } from "expo-router";
import React from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { ExpenseChart, HistoryChart } from "../components/Charts";
import {
  Amount,
  Button,
  Card,
  Empty,
  Heading,
  Icon,
  Label,
  Muted,
  Progress,
  Screen,
  colors,
} from "../components/ui";
import { money } from "../lib/money";
import { useApp } from "../state/AppProvider";
import { EntryRow } from "./EntryRow";

export default function Dashboard() {
  const { data, openForm, hidden } = useApp();
  const wide = useWindowDimensions().width > 1100;
  const summary = data?.summary;
  return (
    <Screen
      title={`Olá, ${data?.user.name.split(" ")[0] || "você"}`}
      subtitle="Um olhar para hoje. Mais espaço para o amanhã."
      action={
        <Button
          title="Novo lançamento"
          icon="add"
          onPress={() => openForm("create_transaction")}
        />
      }
    >
      {!!data && !!summary && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <View
              style={{
                flex: 1.5,
                minWidth: 250,
                borderRadius: 18,
                backgroundColor: "#186F61",
                padding: 26,
                gap: 18,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  right: -60,
                  top: -55,
                  width: 235,
                  height: 235,
                  borderRadius: 125,
                  borderWidth: 35,
                  borderColor: "#FFFFFF08",
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#D1E9DD", fontSize: 12 }}>
                  Disponível para gastar
                </Text>
                <Icon name="wallet-outline" size={21} color="#C0E0CF" />
              </View>
              <Amount value={summary.available} size={36} color="white" />
              <Text style={{ color: "#D1E9DD", fontSize: 11, lineHeight: 18 }}>
                {Number(summary.available) < 0
                  ? "O planejamento precisa de atenção. A renda prevista ainda não é saldo disponível."
                  : "Depois de proteger seus compromissos, orçamento e metas."}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Entender cálculo disponível"
                onPress={() => router.push("/planning")}
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <Text
                  style={{ color: "white", fontSize: 11, fontWeight: "500" }}
                >
                  Entender meu planejamento
                </Text>
                <Icon name="arrow-forward" size={15} color="white" />
              </Pressable>
            </View>
            <Card
              style={{
                flex: 1,
                minWidth: 220,
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Label>Receitas do mês</Label>
                <Icon name="arrow-down-circle-outline" color={colors.teal} />
              </View>
              <Amount value={summary.income_received} size={27} />
              <View style={{ gap: 6 }}>
                <Muted>
                  Recebido de {hidden ? "••••" : money(summary.income_expected)}{" "}
                  previsto
                </Muted>
                <Progress
                  value={
                    Number(summary.income_expected)
                      ? Number(summary.income_received) /
                        Number(summary.income_expected)
                      : 0
                  }
                />
              </View>
            </Card>
            <Card
              style={{
                flex: 1,
                minWidth: 220,
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Label>Despesas do mês</Label>
                <Icon name="arrow-up-circle-outline" color="#BD8A6D" />
              </View>
              <Amount value={summary.expense_paid} size={27} />
              <View style={{ gap: 6 }}>
                <Muted>
                  Pago de {hidden ? "••••" : money(summary.expense_expected)}{" "}
                  comprometido
                </Muted>
                <Progress
                  value={
                    Number(summary.expense_expected)
                      ? Number(summary.expense_paid) /
                        Number(summary.expense_expected)
                      : 0
                  }
                  color="#C9AB8B"
                />
              </View>
            </Card>
          </View>
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              gap: 20,
              alignItems: "stretch",
            }}
          >
            <Card style={{ flex: 1.7 }}>
              <Heading
                title="Seu dinheiro em movimento"
                detail="Entradas e saídas efetivamente registradas"
              />
              <HistoryChart rows={data.history} />
            </Card>
            <Card style={{ flex: 1 }}>
              <Heading
                title="Para onde está indo"
                detail="Pagamentos e parcelas reconhecidas no mês"
              />
              <ExpenseChart rows={data.category_expenses} />
            </Card>
          </View>
          <View style={{ flexDirection: wide ? "row" : "column", gap: 20 }}>
            <Card style={{ flex: 1.5 }}>
              <Heading
                title="Próximos compromissos"
                detail="Acompanhe o que ainda precisa ser pago"
                action={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ver todos os lançamentos"
                    onPress={() => router.push("/transactions")}
                  >
                    <Text style={{ color: colors.teal, fontSize: 11 }}>
                      Ver todos ↗
                    </Text>
                  </Pressable>
                }
              />
              {data.upcoming.length ? (
                <View>
                  {data.upcoming.slice(0, 4).map((e) => (
                    <EntryRow key={e.id} entry={e} compact />
                  ))}
                </View>
              ) : (
                <Empty
                  title="Tudo em dia por aqui"
                  detail="Novas contas previstas aparecerão neste espaço."
                />
              )}
            </Card>
            <Card style={{ flex: 1 }}>
              <Heading
                title="Planos que ganham forma"
                detail="Dinheiro reservado, um passo de cada vez"
              />
              {data.goals.length ? (
                data.goals.slice(0, 3).map((g, i) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ver meta ${g.name}`}
                    key={g.id}
                    onPress={() => router.push("/goals")}
                    style={{ gap: 12, paddingVertical: 8 }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          padding: 8,
                          borderRadius: 10,
                          backgroundColor: i % 2 ? "#F3EDDF" : colors.light,
                        }}
                      >
                        <Icon
                          name={
                            i % 2
                              ? "shield-checkmark-outline"
                              : "airplane-outline"
                          }
                          color={i % 2 ? colors.amber : colors.teal}
                          size={20}
                        />
                      </View>
                      <Text
                        style={{
                          color: colors.ink,
                          fontSize: 13,
                          fontWeight: "500",
                          flex: 1,
                        }}
                      >
                        {g.name}
                      </Text>
                      <Text style={{ color: colors.teal, fontSize: 11 }}>
                        {Math.round(
                          (Number(g.accumulated) / Number(g.target)) * 100,
                        )}
                        %
                      </Text>
                    </View>
                    <Progress
                      value={Number(g.accumulated) / Number(g.target)}
                    />
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Amount value={g.accumulated} size={12} />
                      <Muted>de {hidden ? "••••" : money(g.target)}</Muted>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Empty
                  title="Qual é o seu próximo plano?"
                  detail="Dê nome ao que você quer conquistar."
                  action={
                    <Button
                      title="Criar meta"
                      secondary
                      onPress={() => openForm("create_goal")}
                    />
                  }
                />
              )}
            </Card>
          </View>
        </>
      )}
    </Screen>
  );
}
