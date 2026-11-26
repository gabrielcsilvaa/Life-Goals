import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  Amount,
  Button,
  Empty,
  Icon,
  Screen,
  Muted,
  colors,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import { getTransactionPage } from "../lib/api";
import { Entry, Snapshot } from "../lib/types";
import { dashboardTheme as theme } from "../design/dashboard";
import { shortDate, today } from "../lib/money";
import { EntryRow } from "./EntryRow";

export default function Transactions() {
  const { data, openForm, transactionView, setTransactionView } = useApp();
  const { filter, query, category } = transactionView;
  const setFilter = (filter: string) => setTransactionView({ filter });
  const setQuery = (query: string) => setTransactionView({ query });
  const setCategory = (category: string) => setTransactionView({ category });
  const [older, setOlder] = useState<{
    snapshot: Snapshot;
    entries: Entry[];
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false),
    [pageError, setPageError] = useState("");
  const extra = useMemo(
    () => (older?.snapshot === data ? older?.entries || [] : []),
    [older, data],
  );
  async function loadMore() {
    if (!data || loadingMore) return;
    const current = data;
    setLoadingMore(true);
    setPageError("");
    try {
      const page = await getTransactionPage(
        current.month,
        current.entries.length + extra.length,
      );
      setOlder((previous) => ({
        snapshot: current,
        entries: [
          ...(previous?.snapshot === current ? previous.entries : []),
          ...page.results,
        ],
      }));
    } catch (e) {
      setPageError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar mais registros.",
      );
    } finally {
      setLoadingMore(false);
    }
  }
  const rows = useMemo(
    () =>
      [...(data?.entries || []), ...extra]
        .filter(
          (e) =>
            (filter === "canceled"
              ? e.status === "canceled"
              : e.status !== "canceled") &&
            (filter === "all" ||
              filter === "canceled" ||
              (filter === "pending"
                ? ["pending", "partial"].includes(e.status)
                : filter === "card"
                  ? !!e.card_id
                  : e.kind === filter)) &&
            (!category || category === e.category_id) &&
            e.description
              .toLocaleLowerCase("pt-BR")
              .includes(query.toLocaleLowerCase("pt-BR")),
        )
        .sort((a, b) => b.due_date.localeCompare(a.due_date)),
    [data, extra, filter, query, category],
  );
  const dates = [...new Set(rows.map((e) => e.due_date))];
  return (
    <Screen
      title="Lançamentos"
      subtitle="Sua movimentação do mês."
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar lançamento"
          onPress={() => openForm("create_transaction")}
          style={{
            minWidth: 44,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="add" size={27} color={colors.ink} />
        </Pressable>
      }
    >
      {!!data && (
        <>
          <View
            style={{
              flexDirection: "row",
              padding: 18,
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 16,
              gap: 20,
            }}
          >
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{
                  fontFamily: theme.font.body,
                  fontSize: 13,
                  color: colors.teal,
                }}
              >
                Entradas recebidas
              </Text>
              <Amount
                value={data.summary.income_received}
                size={20}
                color={colors.teal}
              />
            </View>
            <View
              style={{
                flex: 1,
                gap: 6,
                borderLeftWidth: 1,
                borderColor: colors.line,
                paddingLeft: 18,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.font.body,
                  fontSize: 13,
                  color: colors.red,
                }}
              >
                Saídas pagas
              </Text>
              <Amount
                value={data.summary.expense_paid}
                size={20}
                color={colors.red}
              />
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 6 }}
          >
            {[
              ["all", "Todos"],
              ["income", "Receitas"],
              ["expense", "Despesas"],
              ["card", "Cartão"],
              ["pending", "Pendentes"],
              ["canceled", "Excluídos"],
            ].map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === key }}
                onPress={() => setFilter(key)}
                style={{
                  paddingHorizontal: 13,
                  minHeight: 42,
                  justifyContent: "center",
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: filter === key ? colors.teal : colors.line,
                  backgroundColor: filter === key ? colors.teal : colors.bg,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: theme.font.body,
                    color: filter === key ? theme.color.onOlive : colors.ink,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Icon name="search-outline" size={19} />
            <TextInput
              accessibilityLabel="Buscar lançamentos"
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar lançamento"
              placeholderTextColor={colors.muted}
              style={{
                paddingVertical: 12,
                fontFamily: theme.font.body,
                color: colors.ink,
                flex: 1,
                fontSize: 14,
              }}
            />
          </View>
          {!!query && (
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[
                { id: "", name: "Todas as categorias" },
                ...data.categories,
              ].map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  onPress={() => setCategory(c.id)}
                  style={{ minHeight: 40, justifyContent: "center" }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: category === c.id ? colors.teal : colors.muted,
                    }}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <View>
            {dates.map((date) => (
              <View key={date} style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontFamily: theme.font.medium,
                    fontSize: 15,
                    color: colors.ink,
                    marginBottom: 2,
                  }}
                >
                  {date === today() ? "Hoje" : shortDate(date)}
                </Text>
                {rows
                  .filter((e) => e.due_date === date)
                  .map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
              </View>
            ))}
          </View>
          {!rows.length && (
            <Empty
              title="Nenhum lançamento neste recorte"
              detail="Experimente outro filtro ou adicione um lançamento."
              action={
                <Button
                  title="Adicionar lançamento"
                  onPress={() => openForm("create_transaction")}
                />
              }
            />
          )}
          {data.entry_count > data.entries.length + extra.length && (
            <View style={{ gap: 12 }}>
              <Muted>
                Filtros aplicados aos {data.entries.length + extra.length}{" "}
                registros carregados de {data.entry_count}.
              </Muted>
              <Button
                title={
                  loadingMore ? "Carregando…" : "Carregar mais lançamentos"
                }
                disabled={loadingMore}
                secondary
                onPress={() => void loadMore()}
              />
            </View>
          )}
          {!!pageError && (
            <Text accessibilityRole="alert" style={{ color: colors.red }}>
              {pageError}
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}
