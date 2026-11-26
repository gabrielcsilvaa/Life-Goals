import { demoOnly } from "../lib/api";
import { acceptsCategory } from "../lib/categoryRules";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Icon, Muted, colors } from "../components/ui";
import { dashboardTheme as theme } from "../design/dashboard";
import { useApp } from "../state/AppProvider";

export function GettingStarted() {
  const { data, mode, openForm, busy } = useApp();
  const [hidden, setHidden] = React.useState(false);
  if (hidden) return null;
  const empty =
    mode === "live" &&
    (!data?.accounts.length ||
      !data.categories.length ||
      (!data.entry_count && !data.goals.length));
  if (mode === "demo")
    return (
      <View
        style={{
          gap: 10,
          paddingVertical: 15,
          borderBottomWidth: 1,
          borderColor: colors.line,
          marginBottom: 22,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text
            style={{
              flex: 1,
              fontFamily: theme.font.medium,
              fontSize: 16,
              color: colors.ink,
            }}
          >
            Você está explorando um exemplo
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dispensar orientação"
            onPress={() => setHidden(true)}
            style={{
              minHeight: 44,
              minWidth: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Icon name="close" size={19} />
          </Pressable>
        </View>
        <Muted>
          Configure sua conta para criar suas próprias despesas e metas.
        </Muted>
        {!demoOnly && (
          <Button
            title="Configurar meu aplicativo"
            onPress={() =>
              router.push({
                pathname: "/settings",
                params: { section: "account", register: "1" },
              })
            }
          />
        )}
      </View>
    );
  if (!empty) return null;
  const steps = [
    {
      title: "Informar meu saldo atual",
      detail: "Saldo que você já tem hoje; não conta como uma nova receita.",
      done: !!data?.accounts.length,
      action: () => openForm("create_account", { name: "Conta principal" }),
    },
    {
      title: "Categorias para receitas e despesas",
      detail:
        "Transporte, alimentação e outras. Você pode criar categorias específicas em Ajustes.",
      done: !!data?.categories.length,
      action: () => openForm("create_category"),
    },
    {
      title: "Registrar minha primeira receita",
      detail: "Diferencie dinheiro recebido do que ainda espera receber.",
      done: !!data?.entries.some((e) => e.kind === "income"),
      action: () => {
        if (!data?.accounts.length) {
          openForm("create_account", { name: "Conta principal" });
          return;
        }
        if (!data.categories.some((c) => acceptsCategory(c, "income"))) {
          router.push({
            pathname: "/settings",
            params: { section: "categories" },
          });
          return;
        }
        openForm("create_transaction", {
          kind: "income",
          category_id:
            data.categories.find((c) => !c.archived && c.name === "Salário")
              ?.id ||
            data.categories.find((c) => acceptsCategory(c, "income"))?.id ||
            "",
        });
      },
    },
  ];
  return (
    <View style={{ gap: 14, paddingVertical: 18, marginBottom: 20 }}>
      <Text
        style={{
          fontFamily: theme.font.display,
          fontSize: 25,
          color: colors.ink,
        }}
      >
        Vamos configurar seu mês
      </Text>
      <Muted>
        Sua conta começou vazia. Estes passos já deixam o app pronto para usar.
      </Muted>
      {steps.map((step, i) => (
        <Pressable
          key={step.title}
          disabled={busy || (step.done && i !== 2)}
          accessibilityRole="button"
          accessibilityLabel={step.title}
          onPress={step.action}
          style={{
            flexDirection: "row",
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: colors.line,
            opacity: step.done ? 0.6 : 1,
          }}
        >
          <Icon
            name={step.done ? "checkmark-circle" : "ellipse-outline"}
            color={colors.teal}
          />
          <View style={{ flex: 1, gap: 5 }}>
            <Text
              style={{
                fontFamily: theme.font.medium,
                fontSize: 15,
                color: colors.ink,
              }}
            >
              {step.title}
            </Text>
            <Muted>{step.detail}</Muted>
          </View>
          {!step.done && <Icon name="chevron-forward" size={18} />}
        </Pressable>
      ))}
    </View>
  );
}
