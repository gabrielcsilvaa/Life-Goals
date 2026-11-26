import React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  Amount,
  Button,
  Icon,
  Muted,
  Progress,
  colors,
} from "../components/ui";
import { dashboardTheme as theme } from "../design/dashboard";
import { cents, decimal } from "../lib/money";
import { useApp } from "../state/AppProvider";

export function BudgetOverview() {
  const { data, openForm, hidden } = useApp();
  if (!data) return null;
  const planned =
    cents(data.summary.expense_expected) + cents(data.summary.budget_remaining);
  const ratio = planned
    ? Math.min(1, cents(data.summary.expense_paid) / planned)
    : 0;
  const groups = data.categories
    .map((category) => {
      const entries = data.entries.filter(
        (e) =>
          e.category_id === category.id &&
          e.kind === "expense" &&
          e.status !== "canceled",
      );
      const expected = entries.reduce((sum, e) => sum + cents(e.amount), 0);
      const budget = data.budgets.find((b) => b.category_id === category.id);
      return {
        category,
        expected: Math.max(expected, budget ? cents(budget.amount) : 0),
        paid: entries.reduce((sum, e) => sum + cents(e.settled_amount), 0),
      };
    })
    .filter((g) => g.expected > 0)
    .sort((a, b) => b.expected - a.expected);
  return (
    <View style={{ gap: 25 }}>
      <View
        style={{
          padding: 22,
          backgroundColor: colors.light,
          borderRadius: 20,
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, gap: 10 }}>
          <Text
            style={{
              fontFamily: theme.font.body,
              fontSize: 16,
              color: colors.ink,
            }}
          >
            Pago no mês
          </Text>
          <Amount value={data.summary.expense_paid} size={29} />
          <Muted>
            de{" "}
            {hidden
              ? "••••"
              : new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(planned / 100)}{" "}
            planejados
          </Muted>
        </View>
        <View
          accessibilityLabel={`${Math.round(ratio * 100)}% do planejamento pago`}
          style={{
            height: 86,
            width: 86,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={86} height={86} style={{ position: "absolute" }}>
            <Circle
              cx={43}
              cy={43}
              r={36}
              stroke={theme.color.progressTrack}
              strokeWidth={8}
              fill="none"
            />
            <Circle
              cx={43}
              cy={43}
              r={36}
              stroke={colors.teal}
              strokeWidth={8}
              fill="none"
              strokeDasharray={`${226.195 * ratio} 226.195`}
              transform="rotate(-90 43 43)"
            />
          </Svg>
          <Text
            style={{
              fontFamily: theme.font.medium,
              fontSize: 19,
              color: colors.ink,
            }}
          >
            {Math.round(ratio * 100)}%
          </Text>
        </View>
      </View>
      <View style={{ gap: 24 }}>
        {groups.map(({ category, expected, paid }) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={`Planejar ${category.name}`}
            onPress={() =>
              openForm("set_budget", {
                category_id: category.id,
                amount: decimal(expected),
              })
            }
            style={{ flexDirection: "row", gap: 16, alignItems: "center" }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: colors.light,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name={
                  /transporte/i.test(category.name)
                    ? "car-outline"
                    : /sa[uú]de/i.test(category.name)
                      ? "barbell-outline"
                      : /cart[aã]o/i.test(category.name)
                        ? "card-outline"
                        : "ellipsis-horizontal"
                }
                color={colors.amber}
              />
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: theme.font.body,
                    color: colors.ink,
                    fontSize: 16,
                    flex: 1,
                  }}
                >
                  {category.name}
                </Text>
                <Amount value={decimal(expected)} size={15} />
              </View>
              <Progress value={expected ? paid / expected : 0} />
            </View>
          </Pressable>
        ))}
      </View>
      <Muted>
        Os valores por categoria são planejados. As barras mostram o que já foi
        pago. Metas são acompanhadas separadamente.
      </Muted>
      <Button
        title="Adicionar gasto"
        icon="add"
        onPress={() => openForm("create_transaction")}
      />
    </View>
  );
}
