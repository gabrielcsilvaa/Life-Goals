import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import Svg, { Circle } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Amount, Button, Icon, Muted, colors } from "../components/ui";
import { Sheet } from "./dashboard/components";
import { dashboardTheme as theme } from "../design/dashboard";
import { travelArt, useGoalArt } from "../design/goalArt";
import { monthLabel } from "../lib/money";
import { useApp } from "../state/AppProvider";
import { goalIcon } from "./Goals";

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, openForm, month, hidden, error, notice } = useApp();
  const goal = data?.goals.find((g) => g.id === id);
  const { art, selected, save } = useGoalArt(goal?.name || "", id || "");
  const [panel, setPanel] = useState<"art" | "menu" | null>(null);
  const [artError, setArtError] = useState("");
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const back = () => router.replace("/goals");
  async function pick(cover: string) {
    if (saving) return;
    setSaving(true);
    setArtError("");
    try {
      await save(cover);
      setPanel(null);
    } catch {
      setArtError("Não foi possível salvar a capa. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }
  if (!goal)
    return (
      <View style={{ flex: 1, padding: 24, gap: 24, justifyContent: "center" }}>
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <Muted>{error || "Essa meta não está disponível nesta conta."}</Muted>
        )}
        <Button title="Voltar às metas" onPress={back} />
      </View>
    );
  const ratio = Math.max(
    0,
    Math.min(1, Number(goal.accumulated) / Number(goal.target)),
  );
  const history = goal.history || [];
  const maximum = Math.max(1, ...history.map((h) => Number(h.accumulated)));
  function edit() {
    setPanel(null);
    openForm("update_goal", {
      goal_id: goal!.id,
      name: goal!.name,
      target: goal!.target,
      target_date: goal!.target_date,
    });
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View
          style={{ height: art ? 280 : 155, backgroundColor: colors.light }}
        >
          {art ? (
            <Image
              source={art.source}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
              accessibilityLabel={`Paisagem de ${art.label}, imagem ilustrativa`}
            />
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Icon name={goalIcon(goal.name)} size={50} color={colors.teal} />
            </View>
          )}
          <View
            style={[styles.top, { paddingTop: Math.max(insets.top + 12, 18) }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar às metas"
              onPress={back}
              style={styles.topAction}
            >
              <Icon name="chevron-back" size={27} color={colors.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Opções da meta"
              onPress={() => setPanel("menu")}
              style={styles.topAction}
            >
              <Icon name="ellipsis-horizontal" size={25} color={colors.ink} />
            </Pressable>
          </View>
        </View>
        <View style={styles.body}>
          <Text accessibilityRole="header" style={styles.title}>
            {goal.name}
          </Text>
          <Muted>Um objetivo, um passo de cada vez.</Muted>
          <View style={styles.total}>
            <View style={{ flex: 1, gap: 8 }}>
              <Amount value={goal.accumulated} size={32} />
              <View
                style={{
                  flexDirection: "row",
                  gap: 5,
                  alignItems: "baseline",
                  flexWrap: "wrap",
                }}
              >
                <Muted>de</Muted>
                <Amount value={goal.target} size={17} color={colors.muted} />
              </View>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Progresso da meta"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(ratio * 100),
              }}
              style={styles.ring}
            >
              <Svg width={86} height={86} style={StyleSheet.absoluteFill}>
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
                  strokeLinecap={ratio > 0 ? "round" : "butt"}
                  transform="rotate(-90 43 43)"
                />
              </Svg>
              <Text style={styles.ringText}>{Math.round(ratio * 100)}%</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar prazo da meta"
            onPress={edit}
            style={styles.row}
          >
            <Icon name="calendar-outline" size={26} color={colors.ink} />
            <View style={{ flex: 1, gap: 5 }}>
              <Muted>Prazo</Muted>
              <Text style={styles.value}>
                {goal.target_date
                  ? new Intl.DateTimeFormat("pt-BR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(`${goal.target_date}T12:00:00`))
                  : "Sem data definida"}
              </Text>
            </View>
            <Icon name="chevron-forward" color={colors.ink} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Planejar aporte mensal"
            onPress={() =>
              openForm("set_goal_plan", {
                goal_id: goal.id,
                amount: goal.planned,
              })
            }
            style={styles.row}
          >
            <Icon name="locate-outline" size={28} color={colors.ink} />
            <View style={{ flex: 1, gap: 5 }}>
              <Muted>Aporte planejado · {monthLabel(month)}</Muted>
              <Amount value={goal.planned} size={18} />
            </View>
            <Icon name="chevron-forward" color={colors.ink} />
          </Pressable>
          <View style={{ gap: 18, marginTop: 25 }}>
            <Text style={styles.section}>Evolução</Text>
            <Muted>
              Saldo reservado ao fim de cada mês, até a data de corte.
            </Muted>
            {history.length ? (
              <View style={styles.chart}>
                {history.map((h) => (
                  <View
                    key={h.month}
                    accessibilityLabel={`${monthLabel(h.month)}: ${hidden ? "valor oculto" : h.accumulated + " reais"}`}
                    style={styles.barColumn}
                  >
                    <View style={styles.barSpace}>
                      <View
                        style={{
                          height: `${(Number(h.accumulated) / maximum) * 100}%`,
                          width: "72%",
                          backgroundColor:
                            h.month === month
                              ? colors.teal
                              : theme.color.oliveSoft,
                          borderTopLeftRadius: 5,
                          borderTopRightRadius: 5,
                        }}
                      />
                    </View>
                    <Text style={styles.month}>
                      {monthLabel(h.month).split(" ")[0].slice(0, 3)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Muted>
                O histórico de aportes não está disponível. Atualize os dados.
              </Muted>
            )}
            {Number(goal.accumulated) === 0 && (
              <Muted>Nenhum valor reservado até a data de corte.</Muted>
            )}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Muted>Reservado neste mês</Muted>
              <Amount value={goal.contributed} size={15} />
            </View>
            {!!notice && (
              <Text accessibilityRole="alert" style={{ color: colors.teal }}>
                {notice}
              </Text>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={{ color: colors.red }}>
                {error}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
      <View
        style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 18) }]}
      >
        <Button
          title="Registrar aporte"
          icon="add"
          onPress={() => openForm("allocate_goal_funds", { goal_id: goal.id })}
        />
      </View>
      {panel && (
        <Sheet
          title={panel === "art" ? "Capa da meta" : "Sua meta"}
          close={() => {
            if (!saving) setPanel(null);
          }}
        >
          {panel === "menu" ? (
            <View style={{ gap: 12 }}>
              <Button title="Editar meta" secondary onPress={edit} />
              <Button
                title="Excluir meta"
                danger
                onPress={() => {
                  setPanel(null);
                  openForm("delete_goal", { goal_id: goal.id });
                }}
              />
              <Button
                title="Escolher capa"
                secondary
                onPress={() => setPanel("art")}
              />
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 440 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 15 }}
            >
              <Muted>
                Imagens ilustrativas geradas. A escolha da capa fica salva neste
                dispositivo.
              </Muted>
              <View style={styles.gallery}>
                {travelArt.map((a) => (
                  <Pressable
                    key={a.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`Capa ${a.label}`}
                    accessibilityState={{ checked: selected === a.id }}
                    disabled={saving}
                    onPress={() => void pick(a.id)}
                    style={[
                      styles.artOption,
                      {
                        borderColor:
                          selected === a.id ? colors.teal : colors.line,
                      },
                    ]}
                  >
                    <Image
                      source={a.source}
                      contentFit="cover"
                      style={{ height: 78, width: "100%", borderRadius: 8 }}
                    />
                    <Text style={styles.artLabel}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Button
                title="Automática pelo nome"
                secondary
                disabled={saving}
                onPress={() => void pick("auto")}
              />
              <Button
                title="Sem imagem"
                secondary
                disabled={saving}
                onPress={() => void pick("none")}
              />
              {!!artError && (
                <Text accessibilityRole="alert" style={{ color: colors.red }}>
                  {artError}
                </Text>
              )}
            </ScrollView>
          )}
        </Sheet>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  topAction: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 24,
    backgroundColor: "#F7F0E8DD",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    backgroundColor: colors.bg,
    marginTop: -22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 9,
  },
  title: {
    fontFamily: theme.font.display,
    fontSize: 29,
    color: colors.ink,
    lineHeight: 36,
  },
  total: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    paddingVertical: 25,
  },
  ring: {
    height: 86,
    width: 86,
    justifyContent: "center",
    alignItems: "center",
  },
  ringText: { fontFamily: theme.font.medium, color: colors.ink, fontSize: 19 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderColor: colors.line,
    minHeight: 80,
  },
  value: { fontFamily: theme.font.medium, fontSize: 17, color: colors.ink },
  section: { fontFamily: theme.font.display, fontSize: 24, color: colors.ink },
  chart: { height: 135, flexDirection: "row", gap: 13 },
  barColumn: { flex: 1, alignItems: "center", gap: 9 },
  barSpace: {
    height: 105,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  month: { fontFamily: theme.font.body, color: colors.muted, fontSize: 11 },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 22,
    backgroundColor: colors.bg,
  },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  artOption: {
    width: "47%",
    borderWidth: 1,
    padding: 5,
    borderRadius: 12,
    gap: 8,
  },
  artLabel: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: colors.ink,
    paddingBottom: 4,
  },
});
