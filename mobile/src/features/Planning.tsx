import { dashboardTheme as theme } from "../design/dashboard";
import { BudgetOverview } from "./BudgetOverview";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  Amount,
  Button,
  Card,
  Empty,
  Heading,
  Icon,
  Muted,
  Screen,
  colors,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import { cents, decimal } from "../lib/money";

export default function Planning() {
  const { data, openForm } = useApp();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [calculationExpanded, setCalculationExpanded] = useState(false);
  const budget = !section || section === "budget";
  return (
    <Screen
      title={
        section === "cards"
          ? "Meus cartões"
          : section === "recurring"
            ? "Lançamentos fixos"
            : "Orçamento"
      }
      subtitle={
        section === "cards"
          ? "Compras, parcelas e vencimentos."
          : section === "recurring"
            ? "As contas que fazem parte da sua rotina."
            : "Seu mês, com espaço para o que importa."
      }
    >
      {!!data && (
        <>
          {budget && <BudgetOverview />}
          {budget && <Button title={calculationExpanded ? "Recolher cálculo" : "Entenda o cálculo"} secondary onPress={() => setCalculationExpanded(!calculationExpanded)} />}
          {budget && calculationExpanded && (
            <Card>
              <Heading
                title="Como chegamos ao disponível"
                detail={`Data de corte: ${data.as_of.split("-").reverse().join("/")}`}
              />
              <Muted>{data.criteria}</Muted>
              {[
                ["Saldo registrado", data.summary.balance],
                ["Reservas já realizadas", data.summary.reserved],
                ["Contas pendentes e atrasadas", data.summary.unpaid],
                [
                  "Orçamento ainda não comprometido",
                  data.summary.budget_remaining,
                ],
                [
                  "Aportes planejados restantes",
                  data.summary.goal_plan_remaining,
                ],
              ].map(([label, value], index) => (
                <View
                  key={label}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 15,
                  }}
                >
                  <Text style={{ fontSize: 12, color: colors.muted, flex: 1 }}>
                    {index ? "− " : ""}
                    {label}
                  </Text>
                  <Amount value={value} size={15} />
                </View>
              ))}
              <View
                style={{
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderColor: colors.line,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }}
                >
                  Disponível para gastar
                </Text>
                <Amount
                  value={data.summary.available}
                  size={21}
                  color={
                    Number(data.summary.available) < 0
                      ? colors.red
                      : colors.teal
                  }
                />
              </View>
            </Card>
          )}
          {budget && (
            <Card>
              <Heading
                title="Orçamento por categoria"
                detail="Previsões variáveis, sem criar despesas realizadas"
                action={
                  <Button
                    title="Planejar"
                    icon="add"
                    secondary
                    onPress={() => openForm("set_budget")}
                  />
                }
              />
              {data.budgets.length ? (
                data.budgets.map((b) => (
                  <View
                    key={b.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: data.categories.find(
                          (c) => c.id === b.category_id,
                        )?.color,
                      }}
                    />
                    <Text style={{ flex: 1, color: colors.ink, fontSize: 13 }}>
                      {
                        data.categories.find((c) => c.id === b.category_id)
                          ?.name
                      }
                    </Text>
                    <Amount value={b.amount} size={15} />
                    <Button
                      title="Editar"
                      secondary
                      onPress={() =>
                        openForm("set_budget", {
                          category_id: b.category_id,
                          amount: b.amount,
                        })
                      }
                    />
                  </View>
                ))
              ) : (
                <Muted>
                  Defina um limite de planejamento para lazer, transporte ou
                  outras categorias.
                </Muted>
              )}
            </Card>
          )}
          {(section === "recurring" || !section) && (
            <Card>
              <Heading
                title="Receitas e despesas fixas"
                detail="Aparecem todo mês como pendentes, sem duplicar"
                action={
                  <Button
                    title="Adicionar lançamento fixo"
                    secondary
                    onPress={() => openForm("create_recurring_expense")}
                  />
                }
              />
              {data.recurring.map((r) => (
                <View
                  key={r.id}
                  style={{
                    gap: 12,
                    paddingBottom: 16,
                    borderBottomWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Icon name="repeat-outline" color={colors.teal} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.ink, fontSize: 13 }}>
                        {r.name}
                      </Text>
                      <Muted>
                        {r.kind === "income"
                          ? "Receita prevista"
                          : "Vencimento"}{" "}
                        {r.due_rule === "salary_fifth_business_day"
                          ? "no 5º dia útil"
                          : `no dia ${r.day}`}{" "}
                        · {r.active ? "Ativa" : "Pausada"} · Desde{" "}
                        {r.start_month
                          .slice(0, 7)
                          .split("-")
                          .reverse()
                          .join("/")}
                      </Muted>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Amount value={r.amount} size={16} />
                    <Button
                      title="Editar"
                      secondary
                      onPress={() =>
                        openForm("update_recurring_expense", {
                          recurring_id: r.id,
                          kind: r.kind || "expense",
                          due_rule: r.due_rule || "calendar_day",
                          name: r.name,
                          amount: r.amount,
                          category_id: r.category_id,
                          account_id: r.account_id,
                          day: r.day,
                          start_month: r.start_month,
                          end_month: r.end_month,
                          active: r.active,
                        })
                      }
                    />
                  </View>
                </View>
              ))}
            </Card>
          )}
          {(section === "cards" || !section) && (
            <Card>
              <Heading
                title="Meus cartões"
                detail="Bloqueio lógico e compromissos mensais"
                action={
                  <Button
                    title="Adicionar cartão"
                    secondary
                    onPress={() => openForm("create_card")}
                  />
                }
              />
              <View style={{ flexDirection: "row", gap: 15, flexWrap: "wrap" }}>
                {data.cards.map((c, i) => (
                  <View
                    key={c.id}
                    style={{
                      flex: 1,
                      minWidth: 225,
                      borderRadius: 14,
                      backgroundColor: i % 2 ? theme.color.surface : "#E7E5D6",
                      padding: 20,
                      gap: 16,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={{ color: colors.ink, fontWeight: "600" }}>
                        {c.name}
                      </Text>
                      <Icon
                        name={
                          c.blocked ? "lock-closed-outline" : "card-outline"
                        }
                        color={colors.ink}
                      />
                    </View>
                    <Muted>Compromissos no mês</Muted>
                    <Amount value={c.invoice_total} size={26} />
                    <Muted>
                      Fechamento dia {c.closing_day} · Vencimento dia{" "}
                      {c.due_day}
                    </Muted>
                    <Muted>
                      {c.blocked
                        ? "Bloqueado no aplicativo"
                        : "Disponível para novos registros"}
                    </Muted>
                    <View
                      style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                    >
                      <Button
                        title={c.blocked ? "Desbloquear" : "Bloquear"}
                        secondary
                        onPress={() =>
                          openForm("set_card_block", {
                            card_id: c.id,
                            blocked: !c.blocked,
                          })
                        }
                      />
                      <Button
                        title="Informar fatura atual"
                        secondary
                        onPress={() =>
                          openForm("register_opening_invoice", {
                            card_id: c.id,
                            due_date: `${data.month}-${String(Math.min(c.due_day, new Date(Number(data.month.slice(0, 4)), Number(data.month.slice(5)), 0).getDate())).padStart(2, "0")}`,
                          })
                        }
                      />
                      {!c.blocked && (
                        <Button
                          title="Adicionar despesa no cartão"
                          onPress={() =>
                            openForm("create_card_purchase", { card_id: c.id })
                          }
                        />
                      )}
                    </View>
                  </View>
                ))}
              </View>
              {!data.cards.length && (
                <Empty
                  title="Seu primeiro cartão"
                  detail="Acompanhe parcelas e vencimentos sem informar número do cartão."
                />
              )}
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                {data.cards
                  .filter(
                    (c) => Number(c.invoice_total) > Number(c.invoice_paid),
                  )
                  .map((c) => (
                    <Button
                      key={c.id}
                      title={`Pagar fatura · ${c.name}`}
                      secondary
                      onPress={() =>
                        openForm("pay_card_invoice", {
                          card_id: c.id,
                          amount: decimal(
                            cents(c.invoice_total) - cents(c.invoice_paid),
                          ),
                        })
                      }
                    />
                  ))}
              </View>
              <Muted>
                O pagamento reduz a conta e a dívida sem criar uma nova despesa.
                Registre apenas pagamentos já realizados.
              </Muted>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
