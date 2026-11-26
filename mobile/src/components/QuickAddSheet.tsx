import React from "react";
import { acceptsCategory } from "../lib/categoryRules";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Sheet, Icon } from "../features/dashboard/components";
import { dashboardTheme as theme } from "../design/dashboard";
import { useApp } from "../state/AppProvider";

export function QuickAddSheet() {
  const { openForm, closeForm, data } = useApp();
  const ready = (kind: "income" | "expense") =>
    !!data?.accounts.length &&
    !!data?.categories.some((c) => acceptsCategory(c, kind));
  const options = [
    {
      title: "Despesa",
      detail: "Registrar um gasto ou uma conta a pagar",
      icon: "arrow-up-right" as const,
      action: () =>
        ready("expense")
          ? openForm("create_transaction", { kind: "expense" })
          : configure(),
    },
    {
      title: "Receita",
      detail: "Salário, renda extra ou valor a receber",
      icon: "arrow-down-left" as const,
      action: () =>
        ready("income")
          ? openForm("create_transaction", { kind: "income" })
          : configure(),
    },
    {
      title: "Meta de viagem",
      detail: "Escolher destino e quanto quer juntar",
      icon: "map-pin" as const,
      action: () => openForm("create_goal", { goal_type: "travel" }),
    },
    {
      title: "Outra meta",
      detail: "Reserva de emergência, veículo ou outro plano",
      icon: "target" as const,
      action: () => openForm("create_goal", { goal_type: "other" }),
    },
    {
      title: "Despesa fixa",
      detail: "Uma conta que se repete todo mês",
      icon: "repeat" as const,
      action: () =>
        ready("expense") ? openForm("create_recurring_expense") : configure(),
    },
    {
      title: "Compra no cartão",
      detail: "À vista na fatura ou parcelada",
      icon: "credit-card" as const,
      action: () =>
        data?.cards.some((c) => !c.blocked)
          ? openForm("create_card_purchase")
          : configure("cards"),
    },
  ];
  function configure(
    section = data?.accounts.length ? "categories" : "accounts",
  ) {
    closeForm();
    router.push({ pathname: "/settings", params: { section } });
  }
  return (
    <Sheet title="O que vamos adicionar?" close={closeForm}>
      <ScrollView
        style={{ maxHeight: 520, flexShrink: 1 }}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        {options.map((option) => (
          <Pressable
            key={option.title}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            onPress={option.action}
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: 15,
              alignItems: "center",
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderColor: theme.color.line,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name={option.icon} color={theme.color.olive} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: theme.font.medium,
                  fontSize: 16,
                  color: theme.color.ink,
                }}
              >
                {option.title}
              </Text>
              <Text
                style={{
                  fontFamily: theme.font.body,
                  fontSize: 12,
                  lineHeight: 18,
                  color: theme.color.muted,
                }}
              >
                {option.detail}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} />
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}
