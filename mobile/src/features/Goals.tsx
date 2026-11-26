import React, { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Amount,
  Button,
  Empty,
  Icon,
  Muted,
  Progress,
  Screen,
  colors,
} from "../components/ui";
import { dashboardTheme as theme } from "../design/dashboard";
import { useGoalArt } from "../design/goalArt";
import { Goal } from "../lib/types";
import { useApp } from "../state/AppProvider";

export function goalIcon(
  name: string,
): React.ComponentProps<typeof Icon>["name"] {
  return /reserva|emerg[eê]ncia/i.test(name)
    ? "shield-checkmark-outline"
    : /moto|carro|ve[ií]culo|habilita/i.test(name)
      ? "car-outline"
      : "flag-outline";
}
function GoalCard({ goal }: { goal: Goal }) {
  const { art } = useGoalArt(goal.name, goal.id);
  const ratio = Number(goal.accumulated) / Number(goal.target);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver meta ${goal.name}`}
      onPress={() =>
        router.push({ pathname: "/goal", params: { id: goal.id } })
      }
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
    >
      {art && (
        <Image
          source={art.source}
          contentFit="cover"
          style={styles.cover}
          accessibilityLabel={`Paisagem de ${art.label}, imagem ilustrativa`}
        />
      )}
      <View
        style={[
          styles.content,
          !art && { flexDirection: "row", alignItems: "center" },
        ]}
      >
        {!art && (
          <View style={styles.icon}>
            <Icon name={goalIcon(goal.name)} size={27} color={colors.amber} />
          </View>
        )}
        <View style={{ flex: 1, gap: 12 }}>
          <Text style={styles.name}>{goal.name}</Text>
          <View
            style={{
              flexDirection: "row",
              gap: 4,
              flexWrap: "wrap",
              alignItems: "baseline",
            }}
          >
            <Amount value={goal.accumulated} size={16} />
            <Muted>de</Muted>
            <Amount value={goal.target} size={14} color={colors.muted} />
          </View>
          <View style={{ flexDirection: "row", gap: 15, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Progress value={ratio} />
            </View>
            <Text style={styles.percentage}>{Math.round(ratio * 100)}%</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
export default function Goals() {
  const { data, openForm } = useApp();
  const [filter, setFilter] = useState("all");
  const goals = (data?.goals || []).filter(
    (g) =>
      filter === "all" ||
      (filter === "done"
        ? Number(g.accumulated) >= Number(g.target)
        : Number(g.accumulated) < Number(g.target)),
  );
  return (
    <Screen
      title="Minhas metas"
      subtitle="Grandes planos, em progresso."
      showMonth={false}
    >
      <Button
        title="Nova meta"
        icon="add"
        onPress={() => openForm("create_goal")}
      />
      <View style={styles.filters}>
        {[
          ["all", "Todas"],
          ["active", "Em andamento"],
          ["done", "Concluídas"],
        ].map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === id }}
            onPress={() => setFilter(id)}
            style={[
              styles.filter,
              filter === id && { backgroundColor: colors.teal },
            ]}
          >
            <Text
              style={{
                fontFamily: theme.font.body,
                fontSize: 12,
                color: filter === id ? theme.color.onOlive : colors.ink,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 16 }}>
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} />
        ))}
      </View>
      {!goals.length && (
        <Empty
          title={
            filter === "done"
              ? "Seu próximo marco vem aí"
              : "Dê um destino aos seus planos"
          }
          detail={
            filter === "done"
              ? "Metas concluídas aparecerão aqui quando os aportes atingirem o valor-alvo."
              : "Crie uma meta ou escolha outro filtro."
          }
          action={
            filter !== "done" ? (
              <Button
                title="Criar primeira meta"
                onPress={() => openForm("create_goal")}
              />
            ) : undefined
          }
        />
      )}
      <Muted>O progresso considera apenas valores realmente reservados.</Muted>
      {(data?.goals.length || 0) > 1 && (
        <Button
          title="Redistribuir plano"
          secondary
          onPress={() => openForm("transfer_goal_plan")}
        />
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  add: {
    minWidth: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
    marginBottom: 8,
  },
  filter: {
    paddingHorizontal: 14,
    minHeight: 42,
    borderRadius: 24,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
    overflow: "hidden",
  },
  cover: { width: "100%", height: 145 },
  content: { padding: 17, gap: 14 },
  name: { fontFamily: theme.font.medium, fontSize: 18, color: colors.ink },
  percentage: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: colors.ink,
    minWidth: 30,
    textAlign: "right",
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light,
  },
});
