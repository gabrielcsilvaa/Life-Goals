import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { money } from "../lib/money";
import { Snapshot } from "../lib/types";
import { useApp } from "../state/AppProvider";
import { Muted, colors } from "./ui";

export function ExpenseChart({
  rows,
}: {
  rows: Snapshot["category_expenses"];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const { hidden } = useApp();
  const total = rows.reduce((n, r) => n + Number(r.amount), 0),
    circumference = 2 * Math.PI * 56;
  return (
    <View style={{ gap: 20 }}>
      <View
        style={{
          alignSelf: "center",
          width: 156,
          height: 156,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Svg
          width={156}
          height={156}
          viewBox="0 0 156 156"
          style={{ position: "absolute" }}
        >
          <Circle
            cx={78}
            cy={78}
            r={56}
            stroke="#EDF2EF"
            strokeWidth={16}
            fill="none"
          />
          {rows.map((row, index) => {
            const segment = (Number(row.amount) / total) * circumference;
            const start = rows
              .slice(0, index)
              .reduce(
                (n, r) => n + (Number(r.amount) / total) * circumference,
                0,
              );
            return (
              <Circle
                key={row.category_id}
                cx={78}
                cy={78}
                r={56}
                fill="none"
                stroke={row.color}
                strokeWidth={selected === row.category_id ? 20 : 16}
                strokeDasharray={`${Math.max(0, segment - 3)} ${circumference - Math.max(0, segment - 3)}`}
                strokeDashoffset={-start}
                transform="rotate(-90 78 78)"
              />
            );
          })}
        </Svg>
        <Text style={{ color: colors.muted, fontSize: 10 }}>
          {selected
            ? rows.find((r) => r.category_id === selected)?.name
            : "Despesas reconhecidas"}
        </Text>
        <Text
          style={{
            fontSize: 19,
            color: colors.ink,
            fontWeight: "600",
            marginTop: 6,
          }}
        >
          {hidden
            ? "••••"
            : money(
                selected
                  ? rows.find((r) => r.category_id === selected)?.amount || 0
                  : total,
              )}
        </Text>
      </View>
      {rows.length ? (
        rows.map((row) => (
          <Pressable
            key={row.category_id}
            accessibilityRole="button"
            accessibilityLabel={`Ver categoria ${row.name}`}
            onPress={() =>
              setSelected(selected === row.category_id ? null : row.category_id)
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
              padding: 4,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                backgroundColor: row.color,
                borderRadius: 4,
              }}
            />
            <Text style={{ flex: 1, color: colors.muted, fontSize: 12 }}>
              {row.name}
            </Text>
            <Text style={{ color: colors.ink, fontSize: 12 }}>
              {hidden ? "••••" : money(row.amount)}
            </Text>
          </Pressable>
        ))
      ) : (
        <Muted>
          Seus gastos aparecerão aqui após os primeiros registros realizados ou
          compras no cartão.
        </Muted>
      )}
    </View>
  );
}
export function HistoryChart({ rows }: { rows: Snapshot["history"] }) {
  const [selected, setSelected] = useState<Snapshot["history"][number] | null>(
    null,
  );
  const { hidden } = useApp();
  const maximum = Math.max(
    1,
    ...rows.flatMap((r) => [Number(r.income), Number(r.expense)]),
  );
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-around",
          height: 154,
          borderBottomWidth: 1,
          borderColor: colors.line,
        }}
      >
        {rows.map((row) => (
          <Pressable
            key={row.month}
            accessibilityRole="button"
            accessibilityLabel={`Movimentos de ${row.month}`}
            onPress={() => setSelected(row)}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              paddingBottom: 10,
            }}
          >
            <View
              style={{
                height: 112,
                flexDirection: "row",
                alignItems: "flex-end",
                gap: 5,
              }}
            >
              <View
                style={{
                  width: 12,
                  height: Math.max(3, (Number(row.income) / maximum) * 100),
                  backgroundColor: colors.teal,
                  borderRadius: 3,
                }}
              />
              <View
                style={{
                  width: 12,
                  height: Math.max(3, (Number(row.expense) / maximum) * 100),
                  backgroundColor: "#C7DCD1",
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={{ color: colors.muted, fontSize: 10 }}>
              {
                [
                  "jan",
                  "fev",
                  "mar",
                  "abr",
                  "mai",
                  "jun",
                  "jul",
                  "ago",
                  "set",
                  "out",
                  "nov",
                  "dez",
                ][Number(row.month.slice(5)) - 1]
              }
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Text style={{ color: colors.teal, fontSize: 11 }}>● Recebido</Text>
        <Text style={{ color: "#799684", fontSize: 11 }}>● Pago</Text>
      </View>
      <Muted>
        {selected
          ? `${selected.month}: ${hidden ? "valores ocultos" : `${money(selected.income)} recebido · ${money(selected.expense)} pago`}`
          : "Toque em um mês para consultar os movimentos realizados."}
      </Muted>
    </View>
  );
}
