import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Link, router, usePathname } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dashboardTheme as theme } from "../../design/dashboard";
import { useGoalArt } from "../../design/goalArt";
import { cents, decimal, money, shortDate, today } from "../../lib/money";
import { Entry, Goal } from "../../lib/types";
import { useApp } from "../../state/AppProvider";
import { s } from "./styles";

const c = theme.color;
type Glyph = React.ComponentProps<typeof Feather>["name"];
export function Icon({
  name,
  size = 22,
  color = c.ink,
}: {
  name: Glyph;
  size?: number;
  color?: string;
}) {
  return <Feather name={name} size={size} color={color} accessible={false} />;
}
export function Action({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: Glyph;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.iconAction, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
export function Cash({
  value,
  display = false,
  style,
}: {
  value: string;
  display?: boolean;
  style?: React.ComponentProps<typeof Text>["style"];
}) {
  const { hidden } = useApp();
  const { width } = useWindowDimensions();
  const formatted = hidden ? "••••" : money(value);
  const displaySize = Math.max(
    23,
    Math.min(
      width < 360 ? 32 : 42,
      (Math.min(width, 480) - 110) / (formatted.length * 0.53),
    ),
  );
  return (
    <Text
      style={[
        display ? s.heroValue : s.cash,
        style,
        display && { fontSize: displaySize },
      ]}
      numberOfLines={display ? 1 : undefined}
      adjustsFontSizeToFit={display}
      minimumFontScale={0.55}
    >
      {formatted}
    </Text>
  );
}
export function BottomNavigation() {
  const path = usePathname();
  const { openForm, loading, data, busy } = useApp();
  const insets = useSafeAreaInsets();
  const items = [
    { path: "/" as const, label: "Visão geral", icon: "home" as Glyph },
    {
      path: "/transactions" as const,
      label: "Lançamentos",
      icon: "list" as Glyph,
    },
    { path: "/goals" as const, label: "Minhas metas", icon: "target" as Glyph },
    {
      path: "/settings" as const,
      label: "Configurações",
      icon: "user" as Glyph,
    },
  ];
  function destination(item: (typeof items)[number]) {
    return (
      <View key={item.path} style={s.addSlot}>
        <Link href={item.path} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.path === path }}
            style={({ pressed }) => [
              s.navGlyph,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <Icon
              name={item.icon}
              size={24}
              color={item.path === path ? c.olive : c.muted}
            />
            <Text
              style={{
                fontFamily: theme.font.body,
                fontSize: 10,
                lineHeight: 12,
                color: item.path === path ? c.olive : c.muted,
                marginTop: 4,
              }}
            >
              {item.path === "/"
                ? "Início"
                : item.path === "/transactions"
                  ? "Registros"
                  : item.path === "/goals"
                    ? "Metas"
                    : "Ajustes"}
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  }
  return (
    <View
      style={[s.navigation, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      {destination(items[0])}
      {destination(items[1])}
      <View style={s.addSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar"
          accessibilityHint="Escolher despesa, receita, meta ou compra no cartão"
          disabled={loading || !data || busy}
          onPress={() => openForm("quick_add")}
          style={({ pressed }) => [
            s.navGlyph,
            { opacity: loading || !data ? 0.5 : pressed ? 0.65 : 1 },
          ]}
        >
          <View style={s.addButton}>
            <Icon name="plus" size={27} color={c.onOlive} />
          </View>
          <Text
            style={{
              fontFamily: theme.font.body,
              fontSize: 10,
              lineHeight: 12,
              marginTop: 4,
              color: c.muted,
            }}
          >
            Adicionar
          </Text>
        </Pressable>
      </View>
      {destination(items[2])}
      {destination(items[3])}
    </View>
  );
}
export function GoalPreview({ goal }: { goal: Goal }) {
  const { hidden } = useApp();
  const { art } = useGoalArt(goal.name, goal.id);
  const travel = !!art;
  const ratio = Math.min(
    1,
    Math.max(0, Number(goal.accumulated) / Number(goal.target)),
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver meta ${goal.name}`}
      onPress={() =>
        router.push({ pathname: "/goal", params: { id: goal.id } })
      }
      style={({ pressed }) => [s.goal, { opacity: pressed ? 0.7 : 1 }]}
    >
      {travel ? (
        <Image
          source={art!.source}
          contentFit="cover"
          style={s.goalImage}
          accessibilityLabel={`Paisagem de ${art!.label}, imagem ilustrativa da viagem`}
        />
      ) : (
        <View style={s.goalFallback}>
          <Icon name="target" size={32} color={c.olive} />
        </View>
      )}
      <View style={s.goalInformation}>
        <View style={s.goalNameRow}>
          <Text style={s.goalName}>{goal.name}</Text>
          {travel && <Icon name="send" size={17} color={c.oliveSoft} />}
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Progresso de ${goal.name}`}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.round(ratio * 100),
          }}
          style={s.progressTrack}
        >
          <View style={[s.progressFill, { width: `${ratio * 100}%` }]} />
        </View>
        <Text style={s.goalValues}>
          {hidden ? "••••" : money(goal.accumulated)}
          <Text style={s.goalTarget}>
            {" "}
            de {hidden ? "••••" : money(goal.target)}
          </Text>
        </Text>
      </View>
    </Pressable>
  );
}
export function MonthCommitment({ entry }: { entry: Entry }) {
  const { data, openForm } = useApp();
  const paid = entry.status === "paid";
  const card = data?.cards.find((card) => card.id === entry.card_id);
  const title = card
    ? `${paid ? "Fatura" : "Pagar fatura"} · ${card.name}`
    : `${paid ? "" : "Pagar "}${entry.description}`;
  function open() {
    if (paid) {
      router.push("/transactions");
      return;
    }
    openForm("settle_transaction", {
      entry_id: entry.id,
      version: entry.version,
      amount: decimal(cents(entry.amount) - cents(entry.settled_amount)),
      account_id: entry.account_id || data?.accounts[0]?.id || "",
      paid_on: today(),
    });
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        paid
          ? `Ver pagamento: ${entry.description}`
          : `Registrar pagamento: ${entry.description}`
      }
      accessibilityHint="Abre os detalhes. Nenhum pagamento é registrado sem sua confirmação."
      onPress={open}
      style={({ pressed }) => [s.commitment, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[s.check, paid && s.checked]}>
        {paid && <Icon name="check" size={18} color={c.onOlive} />}
      </View>
      <View style={s.commitmentCopy}>
        <Text style={[s.commitmentTitle, paid && { color: c.muted }]}>
          {title}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Cash
          value={
            paid
              ? entry.amount
              : decimal(cents(entry.amount) - cents(entry.settled_amount))
          }
          style={s.commitmentAmount}
        />
        <Text style={s.commitmentDetail}>
          {paid ? "Pago" : shortDate(entry.due_date)}
        </Text>
      </View>
    </Pressable>
  );
}
export function Sheet({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={close}>
      <View style={s.scrim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar fundo do painel"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={s.sheet}>
          <View style={s.sheetHeading}>
            <Text style={s.sectionTitle}>{title}</Text>
            <Action label="Fechar painel" icon="x" onPress={close} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
