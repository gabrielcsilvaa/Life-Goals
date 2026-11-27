import { demoOnly } from "../lib/api";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Heading, Icon, Muted, colors } from "../components/ui";
import { dashboardTheme as theme } from "../design/dashboard";
import { useApp } from "../state/AppProvider";

export default function SettingsHub() {
  const { data, mode, openForm } = useApp();
  const go = (section: string) =>
    router.push({ pathname: "/settings", params: { section } });
  const rows = [
    {
      title: "Contas e saldo inicial",
      detail: `${data?.accounts.length || 0} conta(s) cadastrada(s)`,
      icon: "wallet-outline" as const,
      action: () => go("accounts"),
    },
    {
      title: "Categorias",
      detail: "Organize receitas e despesas do seu jeito",
      icon: "pricetags-outline" as const,
      action: () => go("categories"),
    },
    {
      title: "Receitas",
      detail: "Registrar salário ou outras entradas",
      icon: "arrow-down-outline" as const,
      action: () =>
        data?.accounts.length && data.categories.length
          ? openForm("create_transaction", { kind: "income" })
          : go("accounts"),
    },
    {
      title: "Lançamentos fixos",
      detail: "Academia, celular e outras contas recorrentes",
      icon: "repeat-outline" as const,
      action: () =>
        router.push({
          pathname: "/planning",
          params: { section: "recurring" },
        }),
    },
    {
      title: "Cartões",
      detail: "Cadastrar cartões, compras e faturas",
      icon: "card-outline" as const,
      action: () =>
        router.push({ pathname: "/planning", params: { section: "cards" } }),
    },
    {
      title: "Orçamento do mês",
      detail: "Definir limites por categoria",
      icon: "pie-chart-outline" as const,
      action: () =>
        router.push({ pathname: "/planning", params: { section: "budget" } }),
    },
    {
      title: "Minha conta",
      detail:
        mode === "demo"
          ? "Criar conta ou entrar com meus dados"
          : data?.user.username || "",
      icon: "person-outline" as const,
      action: () => go("account"),
    },
    {
      title: "Conexões com IA",
      detail: "Opcional: gerenciar acessos pelo MCP",
      icon: "link-outline" as const,
      action: () => go("mcp"),
    },
  ];
  return (
    <Screen
      title="Configurar"
      subtitle="Deixe o Life Goals com a sua rotina."
      showMonth={false}
    >
      {demoOnly ? (
        <Muted>
          Preview isolado: apenas dados fictícios, sem acesso a contas reais.
        </Muted>
      ) : mode === "demo" ? (
        <View
          style={{
            gap: 13,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Heading title="Este é um espaço de exemplo" />
          <Muted>
            Itália, salário e despesas exibidos pertencem à demonstração. Sua
            conta pessoal começa vazia, sem importar esses valores.
          </Muted>
          <Button
            title="Começar com meus dados"
            onPress={() =>
              router.push({
                pathname: "/settings",
                params: { section: "account", register: "1" },
              })
            }
          />
          <Button
            title="Já tenho uma conta"
            secondary
            onPress={() => go("account")}
          />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Heading title={`Olá, ${data?.user.name.split(" ")[0] || "você"}`} />
          <Muted>Seus registros são salvos na sua conta no servidor.</Muted>
        </View>
      )}
      <View>
        {rows.map((row) => (
          <Pressable
            key={row.title}
            accessibilityRole="button"
            accessibilityLabel={row.title}
            onPress={row.action}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 15,
              minHeight: 86,
              borderBottomWidth: 1,
              borderColor: colors.line,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name={row.icon} color={colors.teal} size={24} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{
                  fontFamily: theme.font.medium,
                  fontSize: 16,
                  color: colors.ink,
                }}
              >
                {row.title}
              </Text>
              <Muted>{row.detail}</Muted>
            </View>
            <Icon name="chevron-forward" size={18} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
