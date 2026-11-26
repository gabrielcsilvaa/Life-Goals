import { fifthBusinessDay } from "../lib/businessDays";
import React, { useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Icon, colors } from "./ui";
import { dashboardTheme as theme } from "../design/dashboard";
import { today } from "../lib/money";

export function DateField({
  label,
  value,
  onChange,
  optional = false,
  monthOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  monthOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const display = valid ? value.split("-").reverse().join("/") : value;
  const selected = valid
    ? new Date(`${value}T12:00:00`)
    : new Date(`${today()}T12:00:00`);
  const fifth = fifthBusinessDay((valid ? value : today()).slice(0, 7));
  return (
    <View style={{ gap: 8 }}>
      {Platform.OS === "web" ? (
        <TextInput
          accessibilityLabel={label}
          value={display}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={colors.muted}
          onChangeText={(text) => {
            const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
            onChange(
              match
                ? `${match[3]}-${match[2]}-${monthOnly ? "01" : match[1]}`
                : text,
            );
          }}
          style={{
            minHeight: 52,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 13,
            padding: 14,
            color: colors.ink,
            fontFamily: theme.font.body,
            fontSize: 15,
          }}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => setOpen(!open)}
          style={{
            minHeight: 52,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 13,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Icon name="calendar-outline" color={colors.amber} />
          <Text
            style={{
              flex: 1,
              color: colors.ink,
              fontFamily: theme.font.body,
              fontSize: 15,
            }}
          >
            {valid
              ? new Intl.DateTimeFormat("pt-BR", {
                  day: monthOnly ? undefined : "numeric",
                  month: "long",
                  year: "numeric",
                }).format(selected)
              : "Escolher data"}
          </Text>
          <Icon name="chevron-down" size={17} />
        </Pressable>
      )}
      {Platform.OS !== "web" && open && (
        <DateTimePicker
          value={selected}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          themeVariant="light"
          onChange={(event, date) => {
            if (Platform.OS !== "ios") setOpen(false);
            if (event.type !== "dismissed" && date) {
              const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(monthOnly ? 1 : date.getDate()).padStart(2, "0")}`;
              onChange(iso);
            }
          }}
        />
      )}
      {!monthOnly && (
        <View style={{ gap: 4 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Selecionar 5º dia útil: ${fifth.split("-").reverse().join("/")}`}
            onPress={() => onChange(fifth)}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                backgroundColor: theme.color.olive,
                borderRadius: 8,
                padding: 7,
              }}
            >
              <Text
                style={{
                  color: theme.color.onOlive,
                  fontFamily: theme.font.medium,
                }}
              >
                {Number(fifth.slice(8))}
              </Text>
            </View>
            <Text
              style={{
                color: colors.ink,
                fontFamily: theme.font.body,
                fontSize: 12,
              }}
            >
              ● 5º dia útil · {fifth.split("-").reverse().join("/")}
            </Text>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
            Referência salarial: inclui sábado e exclui domingos e feriados
            nacionais. Feriados locais podem mudar a data.
          </Text>
        </View>
      )}
      {optional && !!value && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Limpar ${label}`}
          onPress={() => onChange("")}
          style={{ minHeight: 40, justifyContent: "center" }}
        >
          <Text
            style={{
              fontFamily: theme.font.body,
              fontSize: 12,
              color: colors.muted,
            }}
          >
            Deixar sem data
          </Text>
        </Pressable>
      )}
    </View>
  );
}
