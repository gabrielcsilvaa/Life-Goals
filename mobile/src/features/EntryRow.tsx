import { dashboardTheme as theme } from "../design/dashboard";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { cents, decimal, shortDate, today } from "../lib/money";
import { Entry } from "../lib/types";
import { useApp } from "../state/AppProvider";
import { Amount, Button, Icon, colors } from "../components/ui";

const statusText = {
  paid: "Realizado",
  partial: "Parcial",
  pending: "Previsto",
  canceled: "Cancelado",
};
export function EntryRow({
  entry,
  compact = false,
}: {
  entry: Entry;
  compact?: boolean;
}) {
  const { data, openForm } = useApp(),
    [expanded, setExpanded] = useState(false);
  const cat = data?.categories.find((c) => c.id === entry.category_id);
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderColor: colors.line,
        paddingVertical: 14,
        gap: 14,
        opacity: entry.status === "canceled" ? 0.55 : 1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detalhes: ${entry.description}`}
        onPress={() => setExpanded(!expanded)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 15,
            backgroundColor: colors.light,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Icon
            name={
              entry.kind === "income"
                ? "arrow-down-outline"
                : entry.card_id
                  ? "card-outline"
                  : /transporte|uber/i.test(cat?.name || entry.description)
                    ? "car-outline"
                    : /sa[uú]de|academia/i.test(cat?.name || entry.description)
                      ? "barbell-outline"
                      : /alimenta/i.test(cat?.name || "")
                        ? "restaurant-outline"
                        : "arrow-up-outline"
            }
            color={colors.amber}
            size={19}
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            style={{
              color: colors.ink,
              fontSize: 15,
              fontFamily: theme.font.medium,
            }}
          >
            {entry.description}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {cat?.name} · {shortDate(entry.due_date)}
            {entry.recurring
              ? entry.kind === "income"
                ? " · Receita fixa"
                : " · Despesa fixa"
              : ""}
            {entry.card_id
              ? ` · Cartão ${data?.cards.find((c) => c.id === entry.card_id)?.name || ""}`
              : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 5 }}>
          <Amount
            value={entry.kind === "expense" ? `-${entry.amount}` : entry.amount}
            size={compact ? 14 : 16}
            color={entry.kind === "income" ? colors.teal : colors.red}
          />
          <Text
            style={{
              color:
                entry.status === "paid"
                  ? colors.teal
                  : entry.status === "canceled"
                    ? colors.muted
                    : colors.amber,
              fontSize: 11,
            }}
          >
            {statusText[entry.status]}
          </Text>
        </View>
      </Pressable>
      {!compact && entry.status !== "canceled" && !entry.card_id && (
        <View style={{ flexDirection: "row", gap: 12, paddingLeft: 51 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Editar ${entry.kind === "income" ? "receita" : "despesa"}: ${entry.description}`}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
            onPress={() =>
              openForm(
                entry.status === "pending"
                  ? "update_transaction"
                  : "correct_transaction",
                {
                  entry_id: entry.id,
                  version: entry.version,
                  description: entry.description,
                  amount: entry.amount,
                  category_id: entry.category_id,
                  due_date: entry.due_date,
                },
              )
            }
          >
            <Icon name="create-outline" size={17} />
            <Text style={{ color: colors.teal, fontFamily: theme.font.body }}>
              Editar
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Excluir ${entry.kind === "income" ? "receita" : "despesa"}: ${entry.description}`}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
            onPress={() =>
              openForm("delete_transaction", {
                entry_id: entry.id,
                version: entry.version,
              })
            }
          >
            <Icon name="trash-outline" size={17} color={colors.red} />
            <Text style={{ color: colors.red, fontFamily: theme.font.body }}>
              Excluir
            </Text>
          </Pressable>
        </View>
      )}
      {expanded && (
        <View style={{ gap: 12, paddingLeft: compact ? 0 : 51 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Realizado: <Amount value={entry.settled_amount} size={12} />
            {entry.paid_on ? ` · ${shortDate(entry.paid_on)}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {!["paid", "canceled"].includes(entry.status) && (
              <Button
                title={
                  entry.kind === "income"
                    ? "Registrar recebimento"
                    : "Registrar pagamento"
                }
                secondary
                onPress={() =>
                  openForm("settle_transaction", {
                    entry_id: entry.id,
                    version: entry.version,
                    amount: decimal(
                      cents(entry.amount) - cents(entry.settled_amount),
                    ),
                    account_id: entry.account_id || data?.accounts[0]?.id || "",
                    paid_on: today(),
                  })
                }
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}
