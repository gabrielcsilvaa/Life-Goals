import { formatMoneyInput } from "../lib/formats";
import { suggestedCardDueDate } from "../lib/cardDates";
import { fifthBusinessDay } from "../lib/businessDays";
import { acceptsCategory } from "../lib/categoryRules";
import { QuickAddSheet } from "./QuickAddSheet";
import { GoalSetupFields } from "./GoalSetupFields";
import { DateField } from "./DateField";
import { useGoalArtStore } from "../design/goalArt";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { normalizeMoney, today } from "../lib/money";
import { Payload, Snapshot } from "../lib/types";
import { useApp } from "../state/AppProvider";
import { Button, Icon, colors } from "./ui";
import { dashboardTheme as theme } from "../design/dashboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Field = {
  key: string;
  label: string;
  type?: "money" | "number" | "date" | "choice";
  optional?: boolean;
  choices?: { value: string; label: string }[];
  value?: string;
  min?: number;
  max?: number;
};
type Definition = {
  title: string;
  description: string;
  fields: Field[];
  submit?: string;
};
function definition(
  operation: string,
  data: Snapshot,
  month: string,
): Definition {
  const select = (
    key: string,
    label: string,
    choices: { id: string; name: string }[],
  ): Field => ({
    key,
    label,
    type: "choice",
    choices: choices.map((c) => ({ value: c.id, label: c.name })),
  });
  const amount: Field = { key: "amount", label: "Valor (R$)", type: "money" };
  const description: Field = {
    key: "description",
    label: "Descrição",
    optional: true,
  };
  const name: Field = { key: "name", label: "Nome" };
  const category = select(
    "category_id",
    "Categoria",
    data.categories.filter((c) => !c.archived),
  );
  category.value = "";
  const account = select("account_id", "Conta", data.accounts);
  const goal = select("goal_id", "Meta", data.goals);
  const monthField: Field = {
    key: "month",
    label: "Competência (AAAA-MM-01)",
    type: "date",
    value: `${month}-01`,
  };
  const due: Field = {
    key: "due_date",
    label: "Data / vencimento (AAAA-MM-DD)",
    type: "date",
    value: month === today().slice(0, 7) ? today() : `${month}-01`,
  };
  const actual: Field = {
    key: "paid_on",
    label: "Realizado em (AAAA-MM-DD)",
    type: "date",
    value: today(),
  };
  const definitions: Record<string, Definition> = {
    load_example: {
      title: "Adicionar planejamento de exemplo?",
      description:
        "Disponível apenas em conta vazia. Cria previsões editáveis para 2027, categorias, cartões e metas com saldo realizado zero. Os valores-alvo das metas e datas de vencimento são sugestões de demonstração.",
      fields: [],
      submit: "Adicionar exemplo editável",
    },
    create_transaction: {
      title: "Registrar lançamento",
      description:
        "Registre uma previsão ou um movimento realizado. Deixe a realização em branco para manter como previsto.",
      fields: [
        {
          key: "kind",
          label: "Tipo",
          type: "choice",
          choices: [
            { value: "expense", label: "Despesa" },
            { value: "income", label: "Receita" },
          ],
        },
        amount,
        description,
        { ...category, value: "" },
        account,
        due,
        { ...actual, value: "", optional: true },
      ],
    },
    update_transaction: {
      title: "Editar lançamento",
      description: "Atualiza a previsão e preserva o histórico de alterações.",
      fields: [description, amount, category, due],
    },
    cancel_transaction: {
      title: "Cancelar lançamento?",
      description:
        "O compromisso deixará de entrar no orçamento. O registro será preservado no histórico como cancelado.",
      fields: [],
      submit: "Confirmar cancelamento",
    },
    settle_transaction: {
      title: "Registrar realização",
      description:
        "Confirme o valor e a data em que você recebeu ou pagou. Esta ação registra o fato no aplicativo; não faz um pagamento no banco.",
      fields: [amount, account, actual],
    },
    create_account: {
      title: "Adicionar conta",
      description:
        "Informe o saldo conhecido na data de abertura do acompanhamento.",
      fields: [
        name,
        {
          key: "opening_balance",
          label: "Saldo inicial (R$)",
          type: "money",
          value: "0,00",
        },
        {
          key: "opening_date",
          label: "Acompanhando desde (AAAA-MM-DD)",
          type: "date",
          value: today(),
        },
      ],
    },
    create_category: {
      title: "Nova categoria",
      description: "Organize seus lançamentos do seu jeito.",
      fields: [
        name,
        {
          key: "kind",
          label: "Usar esta categoria em",
          type: "choice",
          value: "expense",
          choices: [
            { value: "expense", label: "Despesas" },
            { value: "income", label: "Receitas" },
            { value: "both", label: "Ambas" },
          ],
        },
        { key: "color", label: "Cor da categoria", value: "#344A35" },
      ],
    },
    create_goal: {
      title: "Criar uma meta",
      submit: "Criar meta",
      description:
        "Criar uma meta não reserva dinheiro. Você poderá planejar e registrar aportes depois.",
      fields: [
        name,
        { key: "target", label: "Quanto quer juntar? (R$)", type: "money" },
        {
          key: "initial_plan_amount",
          label: "Quanto pretende guardar neste mês? (R$)",
          type: "money",
          optional: true,
        },
        {
          key: "target_date",
          label: "Data-alvo (AAAA-MM-DD)",
          type: "date",
          optional: true,
        },
      ],
    },
    set_goal_plan: {
      title: "Planejar aporte",
      description:
        "Defina a intenção para este mês. O acumulado só muda quando houver uma reserva efetiva.",
      fields: [goal, amount, monthField],
    },
    allocate_goal_funds: {
      title: "Reservar para uma meta",
      description:
        "Separe dinheiro já existente na conta. A reserva reduz o disponível para gastar e não é uma despesa.",
      fields: [
        goal,
        account,
        amount,
        {
          key: "direction",
          label: "Operação",
          type: "choice",
          choices: [
            { value: "reserve", label: "Reservar" },
            { value: "withdraw", label: "Retirar reserva" },
          ],
        },
        {
          key: "occurred_on",
          label: "Data realizada (AAAA-MM-DD)",
          type: "date",
          value: today(),
        },
      ],
    },
    transfer_goal_plan: {
      title: "Redistribuir planejamento",
      description:
        "Mova a intenção de aporte entre metas. Nenhum dinheiro será movimentado.",
      fields: [
        select("from_goal_id", "Da meta", data.goals),
        select("to_goal_id", "Para a meta", data.goals),
        amount,
        monthField,
      ],
    },
    set_budget: {
      title: "Planejar uma categoria",
      description:
        "O orçamento reserva espaço para gastos do mês. Lançamentos nessa categoria consomem esse planejamento, sem duplicá-lo.",
      fields: [category, amount, monthField],
    },
    create_card: {
      title: "Adicionar cartão",
      description:
        "Cadastre o calendário do cartão. Nenhum dado bancário sensível é necessário.",
      fields: [
        name,
        {
          key: "closing_day",
          label: "Dia de fechamento",
          type: "number",
          min: 1,
          max: 31,
        },
        {
          key: "due_day",
          label: "Dia de vencimento",
          type: "number",
          min: 1,
          max: 31,
        },
      ],
    },
    set_card_block: {
      title: "Alterar bloqueio lógico",
      description:
        "O bloqueio impede novas compras apenas dentro deste aplicativo. Não altera o cartão no banco.",
      fields: [],
    },
    create_card_purchase: {
      title: "Despesa no cartão",
      description:
        "Escolha o cartão usado na despesa. Informe 1 parcela para compra à vista ou a quantidade de parcelas. Confira o vencimento sugerido na fatura do banco.",
      fields: [
        select(
          "card_id",
          "Cartão",
          data.cards.filter((c) => !c.blocked),
        ),
        category,
        description,
        { key: "total", label: "Valor total (R$)", type: "money" },
        {
          key: "installments",
          label: "Número de parcelas",
          type: "number",
          value: "1",
          min: 1,
          max: 120,
        },
        {
          key: "purchased_on",
          label: "Data da compra (AAAA-MM-DD)",
          type: "date",
          value: today(),
        },
        {
          key: "first_due_date",
          label: "Primeiro vencimento (AAAA-MM-DD)",
          type: "date",
          value: `${month}-10`,
        },
      ],
    },
    create_recurring_expense: {
      title: "Adicionar lançamento fixo",
      description:
        "Cria compromissos mensais. Nenhum pagamento é registrado automaticamente.",
      fields: [
        {
          key: "kind",
          label: "Tipo",
          type: "choice",
          value: "expense",
          choices: [
            { value: "expense", label: "Despesa" },
            { value: "income", label: "Receita" },
          ],
        },
        { ...name, optional: true },
        amount,
        category,
        account,
        {
          key: "day",
          label: "Dia de vencimento",
          type: "number",
          min: 1,
          max: 31,
        },
        {
          key: "start_month",
          label: "Primeiro mês (AAAA-MM-01)",
          type: "date",
          value: `${month}-01`,
        },
        {
          key: "end_month",
          label: "Último mês (AAAA-MM-01)",
          type: "date",
          optional: true,
        },
      ],
    },
    generate_recurring_expenses: {
      title: "Gerar compromissos do mês",
      description:
        "Cria somente ocorrências que ainda não existem. Repetir esta operação não duplica as despesas.",
      fields: [monthField],
    },
    pay_card_invoice: {
      title: "Registrar pagamento da fatura",
      description:
        "Informe um pagamento já realizado. Ele será distribuído entre os compromissos da fatura, sem criar outra despesa.",
      fields: [
        select("card_id", "Cartão", data.cards),
        account,
        amount,
        monthField,
        actual,
      ],
    },
    register_opening_invoice: {
      title: "Informar fatura atual",
      description:
        "Informe o total que você já deve e o vencimento. Não cadastre novamente as compras incluídas nesse valor. Depois, registre novas compras em Adicionar despesa > Cartão. Esta ação mantém a fatura pendente.",
      fields: [
        select("card_id", "Cartão", data.cards),
        category,
        { ...amount, label: "Valor da fatura atual (R$)" },
        due,
      ],
    },
  };
  if (operation === "update_category")
    return {
      ...definitions.create_category,
      title: "Editar categoria",
      description:
        "Alterar nome ou cor preserva os vínculos e o histórico financeiro.",
      fields: [...definitions.create_category.fields],
    };
  if (operation === "correct_transaction")
    return {
      ...definitions.update_transaction,
      title: "Corrigir lançamento realizado",
      description:
        "Ao salvar, o valor realizado e o saldo serão corrigidos. O histórico da correção será preservado.",
      submit: "Salvar correção",
    };
  if (operation === "delete_transaction")
    return {
      title: "Excluir lançamento?",
      description:
        "O lançamento sairá da lista e qualquer valor recebido ou pago será estornado no saldo do aplicativo. O histórico será preservado. Em lançamentos fixos, somente esta ocorrência será excluída.",
      fields: [],
      submit: "Confirmar exclusão",
    };
  if (operation === "delete_goal")
    return {
      title: "Excluir esta meta?",
      description:
        "A meta e seus aportes planejados serão removidos. Metas com histórico de aportes não podem ser excluídas. Esta ação não movimenta dinheiro.",
      fields: [],
      submit: "Confirmar exclusão",
    };
  if (operation === "update_goal")
    return {
      ...definitions.create_goal,
      title: "Editar meta",
      submit: "Salvar alterações",
      fields: definitions.create_goal.fields.filter(
        (f) => f.key !== "initial_plan_amount",
      ),
      description:
        "Atualize o objetivo. O dinheiro reservado e o histórico de aportes serão preservados.",
    };
  if (operation === "update_recurring_expense")
    return {
      ...definitions.create_recurring_expense,
      title: "Editar recorrência",
      description:
        "Altera somente ocorrências ainda não geradas. Os compromissos existentes mantêm seus valores.",
    };
  return (
    definitions[operation] || { title: "Operação", description: "", fields: [] }
  );
}

export function CommandSheet() {
  const { form, data, month } = useApp();
  if (!form || !data) return null;
  if (form.operation === "quick_add") return <QuickAddSheet />;
  return (
    <CommandForm
      key={form.id}
      form={form}
      config={definition(form.operation, data, month)}
    />
  );
}
function CommandForm({
  form,
  config,
}: {
  form: { operation: string; defaults?: Payload };
  config: Definition;
}) {
  const { closeForm, run, busy, error, notify, month, data, openForm } =
    useApp();
  const { save: saveCover } = useGoalArtStore();
  const [goalType, setGoalType] = useState(
    String(form.defaults?.goal_type || "travel"),
  );
  const [destination, setDestination] = useState("");
  const [cover, setCover] = useState("");
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [salaryFifth, setSalaryFifth] = useState(
    form.defaults?.due_rule === "salary_fifth_business_day",
  );
  const [realized, setRealized] = useState(
    form.operation === "correct_transaction" &&
      Number(
        data?.entries.find((e) => e.id === form.defaults?.entry_id)
          ?.settled_amount || 0,
      ) > 0,
  );
  const operation = form.operation;
  const insets = useSafeAreaInsets();
  const [expandedChoice, setExpandedChoice] = useState<string | null>(
    form.operation === "create_card_purchase" ? "card_id" : null,
  );
  const [localError, setLocalError] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of config.fields)
      initial[f.key] = String(
        form.defaults?.[f.key] ??
          f.value ??
          (f.type === "choice" ? f.choices?.[0]?.value : "") ??
          "",
      );
    for (const f of config.fields)
      if (f.type === "money") initial[f.key] = formatMoneyInput(initial[f.key]);
    return initial;
  });
  const transactionKind =
    operation === "create_transaction"
      ? values.kind
      : ["update_transaction", "correct_transaction"].includes(operation)
        ? data?.entries.find((e) => e.id === form.defaults?.entry_id)?.kind ||
          "expense"
        : String(values.kind || "expense");
  const fields = config.fields.map((field) =>
    field.key === "category_id"
      ? {
          ...field,
          choices: field.choices?.filter((choice) => {
            const category = data?.categories.find(
              (c) => c.id === choice.value,
            );
            return category && acceptsCategory(category, transactionKind);
          }),
        }
      : field.key === "account_id" &&
          [
            "create_transaction",
            "create_recurring_expense",
            "update_recurring_expense",
          ].includes(operation)
        ? {
            ...field,
            label:
              transactionKind === "income"
                ? "Em qual conta vai entrar?"
                : "Pagar com qual conta?",
          }
        : field.key === "due_date" && transactionKind === "income"
          ? { ...field, label: "Previsão de recebimento (AAAA-MM-DD)" }
          : field.key === "paid_on" && transactionKind === "income"
            ? { ...field, label: "Recebido em (AAAA-MM-DD)" }
            : field,
  );
  const normalizedFields = fields.map((field) => ({
    ...field,
    label:
      field.type === "date"
        ? field.label.replace(/\s*\(AAAA[^)]*\)/g, "")
        : field.label,
  }));
  const initialDraft = useRef(
    JSON.stringify({
      values,
      destination,
      cover,
      goalType,
      repeatMonthly,
      salaryFifth,
      realized,
    }),
  );
  const [confirmClose, setConfirmClose] = useState(false);
  function requestClose() {
    if (busy) return;
    const current = JSON.stringify({
      values,
      destination,
      cover,
      goalType,
      repeatMonthly,
      salaryFifth,
      realized,
    });
    if (current !== initialDraft.current) setConfirmClose(true);
    else closeForm();
  }
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    Keyboard.dismiss();
    setLocalError("");
    try {
      const payload: Payload = { ...form!.defaults };
      delete payload.goal_type;
      if (
        ["create_recurring_expense", "update_recurring_expense"].includes(
          operation,
        )
      )
        payload.due_rule = salaryFifth
          ? "salary_fifth_business_day"
          : "calendar_day";
      for (const field of normalizedFields) {
        const value = (
          operation === "create_goal" &&
          field.key === "name" &&
          goalType === "travel"
            ? destination.trim()
              ? `Viagem para ${destination.trim()}`
              : ""
            : field.key === "day" && salaryFifth
              ? "5"
              : values[field.key] || ""
        ).trim();
        if (
          !value &&
          (!field.optional ||
            (operation === "create_transaction" &&
              field.key === "paid_on" &&
              realized))
        )
          throw new Error(
            operation === "create_goal" &&
              field.key === "name" &&
              goalType === "travel"
              ? "Informe o destino da viagem."
              : `Preencha: ${field.label.replace(/ \(.*\)/, "")}.`,
          );
        if (!value && field.optional) {
          payload[field.key] =
            field.key === "description" ||
            (field.key === "name" &&
              ["create_recurring_expense", "update_recurring_expense"].includes(
                operation,
              ))
              ? ""
              : null;
          continue;
        }
        if (field.type === "money") payload[field.key] = normalizeMoney(value);
        else if (field.type === "number") {
          const number = Number(value);
          if (
            !Number.isInteger(number) ||
            number < (field.min ?? 1) ||
            number > (field.max ?? 100000)
          )
            throw new Error(`Confira ${field.label.toLowerCase()}.`);
          payload[field.key] = number;
        } else if (field.type === "date") {
          const parsed = new Date(`${value}T12:00:00Z`);
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== value
          )
            throw new Error(`Data inválida: ${field.label}.`);
          if (
            ["month", "start_month", "end_month"].includes(field.key) &&
            !value.endsWith("-01")
          )
            throw new Error(
              "A competência precisa usar o primeiro dia do mês.",
            );
          payload[field.key] = value;
        } else payload[field.key] = value;
      }
      if (operation === "create_transaction" && !realized)
        payload.paid_on = null;
      if (operation === "correct_transaction") payload.realized = realized;
      const categoryField = normalizedFields.find(
        (f) => f.key === "category_id",
      );
      if (
        categoryField &&
        !categoryField.choices?.some((c) => c.value === payload.category_id)
      )
        throw new Error(
          `Escolha uma categoria de ${transactionKind === "income" ? "receita" : "despesa"}.`,
        );
      if (["correct_transaction", "delete_transaction"].includes(operation))
        payload.confirmed = true;
      if (operation === "create_card") payload.blocked = false;
      if (operation === "create_goal") {
        if (payload.initial_plan_amount != null)
          payload.initial_plan_month = `${month}-01`;
        else delete payload.initial_plan_amount;
      }
      const recurringPayload = {
        kind: payload.kind,
        due_rule: salaryFifth ? "salary_fifth_business_day" : "calendar_day",
        name:
          payload.description ||
          data?.categories.find((c) => c.id === payload.category_id)?.name ||
          (transactionKind === "income" ? "Receita fixa" : "Despesa fixa"),
        amount: payload.amount,
        category_id: payload.category_id,
        account_id: payload.account_id,
        day: Number(String(payload.due_date).slice(8)),
        start_month: String(payload.due_date).slice(0, 7) + "-01",
      };
      const result = await run(
        operation === "create_transaction" && repeatMonthly
          ? "create_recurring_expense"
          : operation,
        operation === "create_transaction" && repeatMonthly
          ? recurringPayload
          : payload,
      );
      if (
        ["create_transaction", "create_recurring_expense"].includes(operation)
      ) {
        const targetMonth = String(
          operation === "create_transaction"
            ? payload.due_date
            : payload.start_month,
        ).slice(0, 7);
        notify(
          `${transactionKind === "income" ? "Receita" : "Despesa"}${repeatMonthly || operation === "create_recurring_expense" ? " fixa" : ""} salva para ${targetMonth.split("-").reverse().join("/")}.${targetMonth !== month ? ` Você continua em ${month.split("-").reverse().join("/")}; use o seletor de mês para ver o lançamento.` : ""}`,
        );
      }
      if (operation === "create_card") {
        notify(`Cartão salvo: ${String(payload.name)}.`);
        router.push({ pathname: "/planning", params: { section: "cards" } });
      }
      if (operation === "register_opening_invoice") {
        notify("Fatura atual registrada como pendente.");
        router.push({ pathname: "/planning", params: { section: "cards" } });
      }
      if (operation === "create_card_purchase")
        notify("Despesa registrada na fatura do cartão.");
      if (operation === "delete_goal") router.replace("/goals");
      if (operation === "create_goal" && result?.id) {
        if (cover) {
          try {
            await saveCover(String(result.id), cover);
          } catch {
            notify(
              "Meta criada. Não foi possível salvar a capa; escolha novamente no detalhe.",
            );
          }
        }
        router.push({ pathname: "/goal", params: { id: String(result.id) } });
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Não foi possível salvar.";
      setLocalError(message);
      if (Platform.OS !== "web")
        Alert.alert("Não foi possível salvar", message);
    } finally {
      submitting.current = false;
    }
  }
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!busy) requestClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 22) }]}
        >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={styles.title}>
                {operation === "create_transaction"
                  ? transactionKind === "income"
                    ? "Registrar receita"
                    : "Registrar despesa"
                  : config.title}
              </Text>
              {operation !== "create_transaction" && (
                <Text style={styles.description}>{config.description}</Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar formulário"
              disabled={busy}
              onPress={requestClose}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="close" size={25} />
            </Pressable>
          </View>
          {["correct_transaction", "delete_transaction"].includes(
            operation,
          ) && (
            <Text style={[styles.label, { marginBottom: 12 }]}>
              {
                data?.entries.find((e) => e.id === form.defaults?.entry_id)
                  ?.description
              }
            </Text>
          )}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flexShrink: 1 }}
            contentContainerStyle={styles.fields}
          >
            {operation === "create_transaction" &&
              transactionKind === "expense" && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.label}>
                    Como quer registrar esta despesa?
                  </Text>
                  <View style={styles.choices}>
                    <View style={[styles.choice, styles.selected]}>
                      <Text style={{ color: theme.color.onOlive }}>
                        Conta / dinheiro
                      </Text>
                    </View>
                    <Button
                      title={
                        data?.cards.some((c) => !c.blocked)
                          ? "Cartão"
                          : "Cadastrar cartão"
                      }
                      secondary
                      onPress={() =>
                        openForm(
                          data?.cards.some((c) => !c.blocked)
                            ? "create_card_purchase"
                            : "create_card",
                          data?.cards.some((c) => !c.blocked)
                            ? {
                                description: values.description,
                                total: values.amount,
                                category_id: values.category_id,
                                purchased_on: today(),
                                first_due_date: data.cards.find(
                                  (c) => !c.blocked,
                                )
                                  ? suggestedCardDueDate(
                                      data.cards.find((c) => !c.blocked)!,
                                      today(),
                                    )
                                  : values.due_date,
                              }
                            : undefined,
                        )
                      }
                    />
                    <Button
                      title="Despesa fixa"
                      secondary
                      onPress={() =>
                        openForm("create_recurring_expense", {
                          name: values.description,
                          amount: values.amount,
                          category_id: values.category_id,
                          account_id: values.account_id,
                          day: Number(values.due_date?.slice(8) || 1),
                          start_month: `${month}-01`,
                        })
                      }
                    />
                  </View>
                  <Text style={styles.description}>
                    Cartão registra uma compra na fatura. Despesa fixa cria uma
                    regra mensal. Gere os compromissos na seção Despesas fixas;
                    isso não registra pagamentos.
                  </Text>
                </View>
              )}
            {operation === "create_goal" && (
              <GoalSetupFields
                kind={goalType}
                setKind={(value) => {
                  setGoalType(value);
                  if (value === "reserve")
                    setValues((v) => ({ ...v, name: "Reserva de emergência" }));
                }}
                destination={destination}
                setDestination={setDestination}
                cover={cover}
                setCover={setCover}
              />
            )}
            {operation === "create_transaction" && (
              <View style={{ gap: 10 }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Repetir todo mês"
                  accessibilityState={{ checked: repeatMonthly }}
                  aria-checked={repeatMonthly}
                  onPress={() => {
                    setRepeatMonthly(!repeatMonthly);
                    if (repeatMonthly) setSalaryFifth(false);
                    setRealized(false);
                    setValues((v) => ({ ...v, paid_on: "" }));
                  }}
                  style={styles.selectRow}
                >
                  <Icon name={repeatMonthly ? "checkbox" : "square-outline"} />
                  <Text style={styles.label}>Repetir todo mês</Text>
                </Pressable>
                {repeatMonthly && (
                  <Text style={styles.description}>
                    Aparece automaticamente a cada mês, pendente até você
                    confirmar{" "}
                    {transactionKind === "income"
                      ? "o recebimento"
                      : "o pagamento"}
                    .
                  </Text>
                )}
              </View>
            )}
            {transactionKind === "income" &&
              [
                "create_transaction",
                "create_recurring_expense",
                "update_recurring_expense",
              ].includes(operation) && (
                <View style={{ gap: 8 }}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel="Salário no 5º dia útil"
                    accessibilityState={{ checked: salaryFifth }}
                    aria-checked={salaryFifth}
                    style={styles.selectRow}
                    onPress={() => {
                      const checked = !salaryFifth;
                      setSalaryFifth(checked);
                      if (checked && operation === "create_transaction")
                        setRepeatMonthly(true);
                      setValues((v) => ({
                        ...v,
                        ...(checked
                          ? {
                              day: "5",
                              paid_on: "",
                              due_date: fifthBusinessDay(
                                (v.due_date || month).slice(0, 7),
                              ),
                            }
                          : {}),
                      }));
                      if (checked) setRealized(false);
                    }}
                  >
                    <Icon name={salaryFifth ? "checkbox" : "square-outline"} />
                    <Text style={[styles.label, { flex: 1 }]}>
                      Salário no 5º dia útil
                    </Text>
                  </Pressable>
                  {salaryFifth && (
                    <Text style={styles.description}>
                      A data é recalculada a cada mês. Inclui sábados e exclui
                      domingos e feriados nacionais. Feriados locais podem
                      alterar a data.
                    </Text>
                  )}
                </View>
              )}
            {["create_transaction", "correct_transaction"].includes(
              operation,
            ) &&
              !repeatMonthly && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.label}>
                    Este valor já foi{" "}
                    {values.kind === "income" ? "recebido" : "pago"}?
                  </Text>
                  <View style={styles.choices}>
                    {[
                      [
                        false,
                        transactionKind === "income"
                          ? "Ainda vou receber"
                          : "Ainda não paguei",
                      ],
                      [
                        true,
                        values.kind === "income" ? "Já recebi" : "Já paguei",
                      ],
                    ].map(([yes, label]) => (
                      <Pressable
                        key={String(yes)}
                        accessibilityRole="radio"
                        accessibilityLabel={String(label)}
                        accessibilityState={{ checked: realized === yes }}
                        aria-checked={realized === yes}
                        onPress={() => {
                          setRealized(Boolean(yes));
                          setValues((v) => ({
                            ...v,
                            paid_on: yes ? today() : "",
                          }));
                        }}
                        style={[
                          styles.choice,
                          realized === yes && styles.selected,
                        ]}
                      >
                        <Text
                          style={{
                            fontFamily: theme.font.body,
                            color:
                              realized === yes
                                ? theme.color.onOlive
                                : colors.ink,
                          }}
                        >
                          {String(label)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            {transactionKind === "income" &&
              [
                "create_transaction",
                "update_transaction",
                "correct_transaction",
              ].includes(operation) && (
                <Text style={styles.description}>
                  {realized
                    ? "Recebimento confirmado: este valor entra no saldo."
                    : "Receita prevista: a data não confirma recebimento e este valor ainda não entra no saldo."}
                </Text>
              )}
            {normalizedFields
              .filter(
                (field) =>
                  !(salaryFifth && field.key === "day") &&
                  !(
                    operation === "create_transaction" &&
                    field.key === "kind" &&
                    form.defaults?.kind
                  ),
              )
              .filter(
                (field) =>
                  !(
                    operation === "create_goal" &&
                    goalType === "travel" &&
                    field.key === "name"
                  ) &&
                  !(
                    operation === "create_transaction" &&
                    field.key === "paid_on" &&
                    !realized
                  ),
              )
              .map((field) => (
                <View key={field.key} style={{ gap: 8 }}>
                  {field.key !== "kind" && (
                    <Text style={styles.label}>
                      {field.label.replace(/ \(.*\)/, "")}
                      {field.optional &&
                      !(
                        operation === "create_transaction" &&
                        field.key === "paid_on" &&
                        realized
                      )
                        ? " · opcional"
                        : ""}
                    </Text>
                  )}
                  {field.type === "choice" ? (
                    <View style={{ gap: 8 }}>
                      {field.key !== "kind" && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Selecionar ${field.label}`}
                          accessibilityState={{
                            expanded: expandedChoice === field.key,
                          }}
                          onPress={() =>
                            setExpandedChoice(
                              expandedChoice === field.key ? null : field.key,
                            )
                          }
                          style={styles.selectRow}
                        >
                          <Icon
                            name={
                              field.key.includes("account")
                                ? "wallet-outline"
                                : field.key.includes("category")
                                  ? "pricetag-outline"
                                  : field.key.includes("card")
                                    ? "card-outline"
                                    : "flag-outline"
                            }
                            color={colors.amber}
                          />
                          <Text
                            style={{
                              flex: 1,
                              color: colors.ink,
                              fontFamily: theme.font.body,
                              fontSize: 15,
                            }}
                          >
                            {field.choices?.find(
                              (c) => c.value === values[field.key],
                            )?.label || "Escolha uma opção"}
                          </Text>
                          <Icon
                            name="chevron-forward"
                            color={colors.ink}
                            size={18}
                          />
                        </Pressable>
                      )}
                      {(field.key === "kind" ||
                        expandedChoice === field.key) && (
                        <View
                          style={[
                            styles.choices,
                            field.key === "kind" && styles.segment,
                          ]}
                        >
                          {field.choices?.length ? (
                            field.choices.map((choice) => (
                              <Pressable
                                key={choice.value}
                                accessibilityRole="radio"
                                accessibilityState={{
                                  checked: values[field.key] === choice.value,
                                }}
                                onPress={() => {
                                  if (field.key === "kind")
                                    setSalaryFifth(false);
                                  setValues((v) => ({
                                    ...v,
                                    [field.key]: choice.value,
                                    ...(field.key === "card_id" &&
                                    operation === "create_card_purchase" &&
                                    data?.cards.find(
                                      (c) => c.id === choice.value,
                                    )
                                      ? {
                                          first_due_date: suggestedCardDueDate(
                                            data.cards.find(
                                              (c) => c.id === choice.value,
                                            )!,
                                            v.purchased_on || today(),
                                          ),
                                        }
                                      : {}),
                                    ...(field.key === "kind"
                                      ? { category_id: "" }
                                      : {}),
                                  }));
                                  setExpandedChoice(null);
                                }}
                                style={[
                                  styles.choice,
                                  field.key === "kind" && styles.segmentItem,
                                  values[field.key] === choice.value &&
                                    styles.selected,
                                ]}
                              >
                                <Text
                                  style={{
                                    color:
                                      values[field.key] === choice.value
                                        ? theme.color.onOlive
                                        : colors.ink,
                                    fontFamily: theme.font.body,
                                    fontSize: 14,
                                  }}
                                >
                                  {choice.label}
                                </Text>
                              </Pressable>
                            ))
                          ) : (
                            <Text style={{ color: colors.red }}>
                              Cadastre uma opção nesta seção antes de continuar.
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  ) : field.type === "date" ? (
                    <DateField
                      label={field.label}
                      salaryShortcut={
                        field.key === "due_date" && transactionKind === "income"
                      }
                      value={values[field.key] || ""}
                      onChange={(value) =>
                        setValues((v) => ({
                          ...v,
                          ...(operation === "create_card_purchase" &&
                          field.key === "purchased_on" &&
                          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
                          data?.cards.find((c) => c.id === v.card_id)
                            ? {
                                first_due_date: suggestedCardDueDate(
                                  data.cards.find((c) => c.id === v.card_id)!,
                                  value,
                                ),
                              }
                            : {}),
                          [field.key]:
                            field.key === "due_date" &&
                            salaryFifth &&
                            /^\d{4}-\d{2}-\d{2}$/.test(value)
                              ? fifthBusinessDay(value.slice(0, 7))
                              : value,
                        }))
                      }
                      optional={
                        field.optional &&
                        !(
                          operation === "create_transaction" &&
                          field.key === "paid_on" &&
                          realized
                        )
                      }
                      monthOnly={["month", "start_month", "end_month"].includes(
                        field.key,
                      )}
                    />
                  ) : field.key === "color" ? (
                    <View style={styles.choices}>
                      {[
                        ["#344A35", "Verde"],
                        ["#527594", "Azul"],
                        ["#896332", "Dourado"],
                        ["#98596B", "Rosa"],
                        ["#7D668B", "Roxo"],
                        ["#71685D", "Marrom"],
                      ].map(([color, label]) => (
                        <Pressable
                          key={color}
                          accessibilityRole="radio"
                          accessibilityLabel={`Cor ${label}`}
                          accessibilityState={{
                            checked: values.color === color,
                          }}
                          onPress={() => setValues((v) => ({ ...v, color }))}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: color,
                            borderWidth: values.color === color ? 4 : 0,
                            borderColor: colors.ink,
                          }}
                        />
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      accessibilityLabel={field.label}
                      style={[
                        styles.input,
                        field.key === "amount" &&
                          operation === "create_transaction" && {
                            fontSize: 24,
                            fontFamily: theme.font.medium,
                          },
                      ]}
                      value={values[field.key] || ""}
                      onBlur={() => {
                        if (field.type === "money")
                          setValues((v) => ({
                            ...v,
                            [field.key]: formatMoneyInput(v[field.key] || ""),
                          }));
                      }}
                      onChangeText={(text) =>
                        setValues((v) => ({ ...v, [field.key]: text }))
                      }
                      keyboardType={
                        field.type === "money"
                          ? "decimal-pad"
                          : field.type === "number"
                            ? "number-pad"
                            : "default"
                      }
                      placeholder={field.type === "money" ? "0,00" : ""}
                      placeholderTextColor={colors.muted}
                      autoCapitalize="sentences"
                      maxLength={field.type === "money" ? 16 : 120}
                    />
                  )}
                </View>
              ))}
            {operation === "create_transaction" && (
              <Text style={styles.description}>
                Sem data de realização, o lançamento fica previsto. Preencha a
                realização somente se já recebeu ou pagou.
              </Text>
            )}
          </ScrollView>
          {!!(localError || error) && (
            <Text accessibilityRole="alert" style={styles.error}>
              {localError || error}
            </Text>
          )}
          {confirmClose && (
            <View
              accessibilityRole="alert"
              style={{ gap: 10, paddingVertical: 12 }}
            >
              <Text style={styles.label}>Descartar o que você preencheu?</Text>
              <Button
                title="Continuar preenchendo"
                secondary
                onPress={() => setConfirmClose(false)}
              />
              <Button title="Descartar alterações" danger onPress={closeForm} />
            </View>
          )}
          <View style={styles.actions}>
            <Button
              title="Voltar"
              secondary
              onPress={requestClose}
              disabled={busy}
            />
            <View style={{ flex: 1 }}>
              <Button
                title={busy ? "Salvando…" : config.submit || "Salvar"}
                onPress={() => void submit()}
                disabled={busy}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#29251F88",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxWidth: 480,
    width: "100%",
    maxHeight: "92%",
    padding: 24,
    paddingTop: 14,
  },
  titleRow: { flexDirection: "row", gap: 16, marginBottom: 23, flexShrink: 0 },
  title: {
    fontSize: 28,
    color: colors.ink,
    fontFamily: theme.font.display,
    letterSpacing: -0.5,
  },
  description: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 19,
  },
  fields: { gap: 20, paddingBottom: 20 },
  label: { fontFamily: theme.font.body, fontSize: 14, color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    padding: 14,
    fontFamily: theme.font.body,
    color: colors.ink,
    fontSize: 15,
    minHeight: 52,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    padding: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    minHeight: 40,
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.teal, borderColor: colors.teal },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.muted,
    alignSelf: "center",
    marginBottom: 25,
  },
  selectRow: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
  },
  segment: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 26,
    padding: 3,
    marginBottom: 6,
  },
  segmentItem: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 0,
    alignItems: "center",
  },
  actions: {
    flexShrink: 0,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  error: {
    color: colors.red,
    backgroundColor: "#FBEFF0",
    padding: 12,
    borderRadius: 8,
    fontSize: 12,
    lineHeight: 19,
  },
});
