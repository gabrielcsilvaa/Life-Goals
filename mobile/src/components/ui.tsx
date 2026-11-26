import { dashboardTheme as theme } from "../design/dashboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { monthLabel, money, shiftMonth } from "../lib/money";
import { useApp } from "../state/AppProvider";

export const colors = {
  bg: theme.color.background,
  card: theme.color.background,
  ink: theme.color.ink,
  muted: theme.color.muted,
  line: theme.color.line,
  teal: theme.color.olive,
  light: theme.color.surface,
  red: theme.color.error,
  amber: "#896332",
};
export function Icon({
  name,
  size = 21,
  color = colors.muted,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Button({
  title,
  onPress,
  icon,
  secondary = false,
  disabled = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Icon>["name"];
  secondary?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && { backgroundColor: "#F2E3DA" },
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={18}
          color={danger ? colors.red : secondary ? colors.teal : "white"}
        />
      )}
      <Text
        style={[
          s.buttonText,
          secondary && { color: colors.teal },
          danger && { color: colors.red },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}
export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={s.muted}>{children}</Text>;
}
export function Amount({
  value,
  size = 24,
  color = colors.ink,
}: {
  value: string;
  size?: number;
  color?: string;
}) {
  const { hidden } = useApp();
  return (
    <Text
      style={{
        color,
        fontSize: size,
        fontFamily: theme.font.medium,
        fontVariant: ["tabular-nums"],
        letterSpacing: -0.5,
      }}
    >
      {hidden ? "••••" : money(value)}
    </Text>
  );
}
export function Heading({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const stacked = !!action && width < 440;
  return (
    <View
      style={[
        s.heading,
        stacked && { flexDirection: "column", alignItems: "stretch", gap: 14 },
      ]}
    >
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 5 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {detail && <Muted>{detail}</Muted>}
      </View>
      {action}
    </View>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name="leaf-outline" color={colors.teal} size={28} />
      </View>
      <Text style={s.sectionTitle}>{title}</Text>
      <Muted>{detail}</Muted>
      {action}
    </View>
  );
}
export function Progress({
  value,
  color = colors.teal,
}: {
  value: number;
  color?: string;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={s.track}
    >
      <View
        style={{
          height: 6,
          borderRadius: 4,
          backgroundColor: color,
          width: `${Math.min(100, Math.max(0, value * 100))}%`,
        }}
      />
    </View>
  );
}
export function MonthPicker() {
  const { month, setMonth } = useApp();
  return (
    <View style={s.month}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
        onPress={() => setMonth(shiftMonth(month, -1))}
        style={s.monthArrow}
      >
        <Icon name="chevron-back" color={colors.ink} />
      </Pressable>
      <Text style={s.monthText}>
        {monthLabel(month).replace(/^./, (first) => first.toUpperCase())}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
        onPress={() => setMonth(shiftMonth(month, 1))}
        style={s.monthArrow}
      >
        <Icon name="chevron-forward" color={colors.ink} />
      </Pressable>
    </View>
  );
}
export function Screen({
  title,
  subtitle,
  children,
  action,
  showMonth = true,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  showMonth?: boolean;
}) {
  const { mode, error, notice, loading, data, reload, hidden, setHidden } =
    useApp();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={[
        s.screen,
        { paddingTop: Math.max(insets.top + 20, 38) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.pageHeading}>
        <View style={{ gap: 8, flex: 1 }}>
          <Text accessibilityRole="header" style={s.pageTitle}>
            {title}
          </Text>
          <Muted>{subtitle}</Muted>
        </View>
        {action}
      </View>
      {showMonth && <MonthPicker />}
      {!!error && (
        <View accessibilityRole="alert" style={s.error}>
          <Text style={{ color: colors.red }}>{error}</Text>
          <Button
            title="Tentar novamente"
            secondary
            onPress={() => void reload()}
          />
        </View>
      )}
      {!!notice && (
        <Text accessibilityRole="alert" style={s.notice}>
          {notice}
        </Text>
      )}
      {!data ? (
        <View style={{ padding: 40, gap: 15 }}>
          <ActivityIndicator color={colors.teal} />
          <Muted>
            {loading
              ? "Organizando seus dados…"
              : "Dados indisponíveis. Tente atualizar."}
          </Muted>
        </View>
      ) : (
        children
      )}
      <View style={s.footer}>
        <Text style={s.footnote}>
          {mode === "demo" ? "Demonstração" : "Conta conectada"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hidden ? "Mostrar valores" : "Ocultar valores"}
          onPress={() => setHidden(!hidden)}
          style={s.monthArrow}
        >
          <Icon name={hidden ? "eye-off-outline" : "eye-outline"} size={19} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atualizar dados"
          onPress={() => void reload()}
          style={s.monthArrow}
        >
          <Icon name="refresh-outline" size={19} />
        </Pressable>
      </View>
    </ScrollView>
  );
}
export const s = StyleSheet.create({
  screen: {
    padding: 22,
    gap: 22,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 110,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 18,
  },
  button: {
    backgroundColor: colors.teal,
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
  },
  secondary: { backgroundColor: colors.light },
  buttonText: {
    flexShrink: 1,
    textAlign: "center",
    color: theme.color.onOlive,
    fontFamily: theme.font.medium,
    fontSize: 15,
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: colors.muted,
    fontWeight: "500",
  },
  muted: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionTitle: {
    fontSize: 24,
    fontFamily: theme.font.display,
    color: colors.ink,
  },
  pageHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  pageTitle: {
    color: colors.ink,
    fontSize: 33,
    fontFamily: theme.font.display,
    letterSpacing: -0.8,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 10,
    letterSpacing: 1.7,
    fontWeight: "700",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 13 },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  month: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthText: {
    fontSize: 14,
    fontFamily: theme.font.medium,
    color: colors.ink,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F4EDDF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, color: "#6E7368", fontWeight: "600" },
  demoBanner: {
    padding: 12,
    backgroundColor: "#FBF7EC",
    borderRadius: 10,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
  },
  demoText: { flex: 1, color: "#8D784B", fontSize: 11, lineHeight: 17 },
  error: { padding: 14, backgroundColor: "#F2E3DA", borderRadius: 10 },
  success: { padding: 14, backgroundColor: colors.light, borderRadius: 10 },
  empty: { alignItems: "center", padding: 22, gap: 12 },
  emptyIcon: { backgroundColor: colors.light, borderRadius: 30, padding: 15 },
  track: {
    height: 6,
    backgroundColor: theme.color.progressTrack,
    borderRadius: 4,
    overflow: "hidden",
  },
  footer: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "center",
    alignItems: "center",
    paddingTop: 10,
  },
  footnote: {
    fontSize: 11,
    color: colors.muted,
    flexShrink: 1,
    fontFamily: theme.font.body,
  },
  notice: { fontSize: 13, color: colors.teal, fontFamily: theme.font.body },
  monthArrow: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
