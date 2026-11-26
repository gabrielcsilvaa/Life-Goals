import { fifthBusinessDay } from "./businessDays";
/** Isolated demonstration only. Never writes to a real account or acts as backend fallback. */
import { acceptsCategory } from "./categoryRules";
import { cents, decimal, newKey, shiftMonth, today } from "./money";
import { Category, Entry, Payload, Snapshot } from "./types";

type DemoState = {
  accounts: {
    id: string;
    name: string;
    opening_balance: string;
    opening_date: string;
  }[];
  categories: Category[];
  entries: Entry[];
  cards: {
    id: string;
    name: string;
    closing_day: number;
    due_day: number;
    blocked: boolean;
  }[];
  goals: {
    id: string;
    name: string;
    target: string;
    target_date: string | null;
  }[];
  plans: { goal_id: string; month: string; amount: string }[];
  allocations: {
    goal_id: string;
    account_id: string;
    amount: string;
    occurred_on: string;
  }[];
  movements: {
    entry_id: string;
    account_id: string;
    amount: string;
    occurred_on: string;
  }[];
  budgets: { id: string; category_id: string; month: string; amount: string }[];
  recurring: {
    kind?: "income" | "expense";
    due_rule?: "calendar_day" | "salary_fifth_business_day";
    id: string;
    name: string;
    amount: string;
    category_id: string;
    account_id: string;
    day: number;
    start_month: string;
    end_month: string | null;
    active: boolean;
  }[];
  occurrences: string[];
};
const sum = <T>(rows: T[], get: (r: T) => string) =>
  rows.reduce((total, row) => total + cents(get(row)), 0);

export function initialDemo(): DemoState {
  const cat = (id: string, name: string, color: string) => ({
    id,
    name,
    color,
    archived: false,
  });
  const entry = (
    id: string,
    description: string,
    amount: string,
    category_id: string,
    day: string,
    kind: "income" | "expense" = "expense",
  ): Entry => ({
    id,
    description,
    amount,
    category_id,
    due_date: `2027-01-${day}`,
    kind,
    settled_amount: "0.00",
    account_id: "main",
    card_id: null,
    status: "pending",
    paid_on: null,
    version: 1,
    installment_number: null,
    recurring: false,
  });
  return {
    accounts: [
      {
        id: "main",
        name: "Conta principal",
        opening_balance: "0.00",
        opening_date: "2026-01-01",
      },
    ],
    categories: [
      cat("salary", "Salário", "#168477"),
      cat("transport", "Transporte", "#6488D5"),
      cat("health", "Saúde", "#C886A5"),
      cat("phone", "Celular", "#AB94D4"),
      cat("leisure", "Lazer", "#E7B362"),
      cat("food", "Alimentação", "#DF8B70"),
      cat("other", "Outros", "#8C9C99"),
    ],
    entries: [
      entry(
        "salary-jan",
        "Salário líquido",
        "2000.00",
        "salary",
        "05",
        "income",
      ),
      entry("gym-jan", "Academia", "140.00", "health", "10"),
      entry("tim-jan", "TIM", "70.00", "phone", "15"),
      {
        ...entry(
          "invoice-jan",
          "Fatura inicial · Mercado Pago",
          "200.00",
          "other",
          "10",
        ),
        account_id: null,
        card_id: "mp",
      },
    ],
    cards: [
      {
        id: "mp",
        name: "Mercado Pago",
        closing_day: 3,
        due_day: 10,
        blocked: false,
      },
      { id: "nu", name: "Nubank", closing_day: 20, due_day: 27, blocked: true },
    ],
    goals: [
      {
        id: "italy",
        name: "Viagem para a Itália",
        target: "8000.00",
        target_date: null,
      },
      {
        id: "reserve",
        name: "Reserva de emergência",
        target: "6000.00",
        target_date: null,
      },
    ],
    plans: Array.from({ length: 12 }, (_, i) => [
      {
        goal_id: "italy",
        month: `2027-${String(i + 1).padStart(2, "0")}-01`,
        amount: i ? "600.00" : "400.00",
      },
      {
        goal_id: "reserve",
        month: `2027-${String(i + 1).padStart(2, "0")}-01`,
        amount: i ? "350.00" : "200.00",
      },
    ]).flat(),
    allocations: [],
    movements: [],
    budgets: [
      {
        id: "uber-budget",
        category_id: "transport",
        month: "2027-01-01",
        amount: "407.00",
      },
      {
        id: "leisure-budget",
        category_id: "leisure",
        month: "2027-01-01",
        amount: "200.00",
      },
    ],
    recurring: [
      {
        id: "gym",
        name: "Academia",
        amount: "140.00",
        category_id: "health",
        account_id: "main",
        day: 10,
        start_month: "2027-02-01",
        end_month: null,
        active: true,
      },
      {
        id: "tim",
        name: "TIM",
        amount: "70.00",
        category_id: "phone",
        account_id: "main",
        day: 15,
        start_month: "2027-02-01",
        end_month: null,
        active: true,
      },
    ],
    occurrences: [],
  };
}

export function materializeDemo(state: DemoState, month: string): DemoState {
  return demoCommand(state, "generate_recurring_expenses", {
    month: `${month}-01`,
  });
}

export function demoSnapshot(state: DemoState, month: string): Snapshot {
  state = materializeDemo(state, month);
  const start = `${month}-01`,
    end = `${month}-31`,
    cutoff = end < today() ? end : today();
  const entries = state.entries.filter((e) => e.due_date.startsWith(month));
  const live = entries.filter((e) => e.status !== "canceled");
  const movements = state.movements.filter((m) => m.occurred_on <= cutoff);
  const allocations = state.allocations.filter((a) => a.occurred_on <= cutoff);
  const paid = (id: string) =>
    Math.abs(
      sum(
        movements.filter((m) => m.entry_id === id),
        (m) => m.amount,
      ),
    );
  const accounts = state.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    opening_date: a.opening_date,
    balance: decimal(
      a.opening_date <= cutoff
        ? cents(a.opening_balance) +
            sum(
              movements.filter((m) => m.account_id === a.id),
              (m) => m.amount,
            )
        : 0,
    ),
    reserved: decimal(
      sum(
        allocations.filter((m) => m.account_id === a.id),
        (m) => m.amount,
      ),
    ),
  }));
  const goals = state.goals.map((g) => ({
    ...g,
    history: Array.from({ length: 6 }, (_, index) => {
      const period = shiftMonth(month, index - 5);
      return {
        month: period,
        accumulated: decimal(
          sum(
            allocations.filter(
              (a) => a.goal_id === g.id && a.occurred_on.slice(0, 7) <= period,
            ),
            (a) => a.amount,
          ),
        ),
      };
    }),
    accumulated: decimal(
      sum(
        allocations.filter((a) => a.goal_id === g.id),
        (a) => a.amount,
      ),
    ),
    planned:
      state.plans.find((p) => p.goal_id === g.id && p.month === start)
        ?.amount || "0.00",
    contributed: decimal(
      sum(
        allocations.filter((a) => a.goal_id === g.id && a.occurred_on >= start),
        (a) => a.amount,
      ),
    ),
  }));
  const balance = sum(accounts, (a) => a.balance),
    reserved = sum(accounts, (a) => a.reserved);
  const upcoming = state.entries
    .filter(
      (e) =>
        e.kind === "expense" &&
        e.status !== "canceled" &&
        e.due_date <= end &&
        cents(e.amount) > paid(e.id),
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((e) => ({ ...e, remaining: decimal(cents(e.amount) - paid(e.id)) }));
  const unpaid = sum(upcoming, (e) => e.remaining);
  const budgets = state.budgets.filter((b) => b.month === start);
  const budgetRemaining = budgets.reduce(
    (total, b) =>
      total +
      Math.max(
        0,
        cents(b.amount) -
          sum(
            live.filter(
              (e) => e.kind === "expense" && e.category_id === b.category_id,
            ),
            (e) => e.amount,
          ),
      ),
    0,
  );
  const goalRemaining = goals.reduce(
    (total, g) =>
      total + Math.max(0, cents(g.planned) - Math.max(0, cents(g.contributed))),
    0,
  );
  return {
    user: {
      name: "Gabriel",
      username: "demonstracao",
      timezone: "America/Sao_Paulo",
    },
    month,
    as_of: cutoff,
    summary: {
      balance: decimal(balance),
      reserved: decimal(reserved),
      available: decimal(
        balance - reserved - unpaid - budgetRemaining - goalRemaining,
      ),
      income_expected: decimal(
        sum(
          live.filter((e) => e.kind === "income"),
          (e) => e.amount,
        ),
      ),
      income_received: decimal(
        live
          .filter((e) => e.kind === "income")
          .reduce((n, e) => n + paid(e.id), 0),
      ),
      expense_expected: decimal(
        sum(
          live.filter((e) => e.kind === "expense"),
          (e) => e.amount,
        ),
      ),
      expense_paid: decimal(
        live
          .filter((e) => e.kind === "expense")
          .reduce((n, e) => n + paid(e.id), 0),
      ),
      unpaid: decimal(unpaid),
      budget_remaining: decimal(budgetRemaining),
      goal_plan_remaining: decimal(goalRemaining),
    },
    accounts,
    categories: state.categories,
    entries,
    entry_count: entries.length,
    goals,
    budgets,
    recurring: state.recurring,
    upcoming: upcoming.slice(0, 8),
    cards: state.cards.map((c) => ({
      ...c,
      invoice_total: decimal(
        sum(
          live.filter((e) => e.card_id === c.id),
          (e) => e.amount,
        ),
      ),
      invoice_paid: decimal(
        live
          .filter((e) => e.card_id === c.id)
          .reduce((n, e) => n + paid(e.id), 0),
      ),
    })),
    category_expenses: state.categories
      .map((c) => ({
        category_id: c.id,
        name: c.name,
        color: c.color,
        amount: decimal(
          live
            .filter((e) => e.kind === "expense" && e.category_id === c.id)
            .reduce(
              (n, e) => n + (e.card_id ? cents(e.amount) : paid(e.id)),
              0,
            ),
        ),
      }))
      .filter((c) => cents(c.amount) > 0),
    history: Array.from({ length: 6 }, (_, i) => {
      const m = shiftMonth(month, i - 5);
      const rows = movements.filter((r) => r.occurred_on.startsWith(m));
      return {
        month: m,
        income: decimal(
          sum(
            rows.filter((r) => cents(r.amount) > 0),
            (r) => r.amount,
          ),
        ),
        expense: decimal(
          -sum(
            rows.filter((r) => cents(r.amount) < 0),
            (r) => r.amount,
          ),
        ),
      };
    }),
    criteria:
      "Saldo registrado até a data de corte, menos reservas, compromissos abertos até o fim do mês, orçamento variável restante e aportes planejados restantes. Receitas futuras não entram no disponível.",
  };
}

export function demoCommand(
  previous: DemoState,
  operation: string,
  p: Payload,
): DemoState {
  const state: DemoState = JSON.parse(JSON.stringify(previous));
  const str = (key: string) => String(p[key] ?? "");
  const positive = (key: string) => {
    const n = cents(str(key));
    if (n <= 0) throw new Error("O valor precisa ser maior que zero.");
    return decimal(n);
  };
  const actual = (value: string, accountId: string) => {
    const a = state.accounts.find((a) => a.id === accountId);
    if (!a) throw new Error("Escolha uma conta.");
    if (value > today() || value < a.opening_date)
      throw new Error(
        "A data realizada precisa estar entre a abertura da conta e hoje.",
      );
  };
  const settle = (
    entry: Entry,
    value: string,
    on: string,
    accountId: string,
  ) => {
    actual(on, accountId);
    const amount = cents(value);
    if (
      amount <= 0 ||
      entry.status === "canceled" ||
      amount > cents(entry.amount) - cents(entry.settled_amount)
    )
      throw new Error("Valor de liquidação inválido.");
    if (entry.account_id && entry.account_id !== accountId)
      throw new Error("Use a conta vinculada ao lançamento.");
    state.movements.push({
      account_id: accountId,
      entry_id: entry.id,
      amount: decimal(entry.kind === "income" ? amount : -amount),
      occurred_on: on,
    });
    entry.settled_amount = decimal(cents(entry.settled_amount) + amount);
    entry.paid_on = on;
    entry.version++;
    entry.status = entry.settled_amount === entry.amount ? "paid" : "partial";
  };
  const findEntry = () => {
    const e = state.entries.find((e) => e.id === str("entry_id"));
    if (!e || e.version !== p.version)
      throw new Error("Atualize o lançamento antes de continuar.");
    return e;
  };
  if (
    [
      "create_transaction",
      "update_transaction",
      "correct_transaction",
      "create_card_purchase",
      "create_recurring_expense",
      "set_category_budget",
    ].includes(operation)
  ) {
    const kind = ["create_transaction", "create_recurring_expense"].includes(
      operation,
    )
      ? str("kind") || "expense"
      : ["update_transaction", "correct_transaction"].includes(operation)
        ? findEntry().kind
        : "expense";
    const category = state.categories.find((c) => c.id === str("category_id"));
    if (!category || !acceptsCategory(category, kind))
      throw new Error(
        "Escolha uma categoria compatível com o tipo de lançamento.",
      );
  }
  if (operation === "create_transaction") {
    const e: Entry = {
      id: newKey(),
      kind: str("kind") as Entry["kind"],
      description:
        str("description") ||
        state.categories.find((c) => c.id === str("category_id"))?.name ||
        "Lançamento",
      amount: positive("amount"),
      category_id: str("category_id"),
      account_id: str("account_id"),
      card_id: null,
      due_date: str("due_date"),
      paid_on: null,
      settled_amount: "0.00",
      status: "pending",
      version: 1,
      installment_number: null,
      recurring: false,
    };
    state.entries.push(e);
    if (p.paid_on) settle(e, e.amount, str("paid_on"), e.account_id!);
  } else if (operation === "settle_transaction") {
    const e = findEntry();
    settle(e, positive("amount"), str("paid_on"), str("account_id"));
  } else if (operation === "cancel_transaction") {
    const e = findEntry();
    if (cents(e.settled_amount) || e.installment_number)
      throw new Error(
        "Só é possível cancelar lançamentos abertos sem parcelas.",
      );
    e.status = "canceled";
    e.version++;
  } else if (
    operation === "correct_transaction" ||
    operation === "delete_transaction"
  ) {
    const e = findEntry();
    if (!p.confirmed || e.card_id || e.status === "canceled")
      throw new Error("Confirme a correção deste lançamento.");
    if (operation === "delete_transaction") {
      const total = state.movements
        .filter((m) => m.entry_id === e.id)
        .reduce((sum, m) => sum + cents(m.amount), 0);
      if (total)
        state.movements.push({
          entry_id: e.id,
          account_id: e.account_id!,
          amount: decimal(-total),
          occurred_on: today(),
        });
      e.settled_amount = "0.00";
      e.paid_on = null;
      e.status = "canceled";
      e.version++;
    } else {
      const amount = positive("amount");
      if (p.realized === false) {
        const total = state.movements
          .filter((m) => m.entry_id === e.id)
          .reduce((sum, m) => sum + cents(m.amount), 0);
        if (total)
          state.movements.push({
            entry_id: e.id,
            account_id: e.account_id!,
            amount: decimal(-total),
            occurred_on: today(),
          });
        e.settled_amount = "0.00";
        e.paid_on = null;
        e.status = "pending";
      } else if (e.settled_amount === e.amount) {
        const delta = cents(amount) - cents(e.amount);
        if (delta)
          state.movements.push({
            entry_id: e.id,
            account_id: e.account_id!,
            amount: decimal(e.kind === "income" ? delta : -delta),
            occurred_on: today(),
          });
        e.settled_amount = amount;
      } else if (cents(amount) < cents(e.settled_amount))
        throw new Error("O valor não pode ser menor que a parte já realizada.");
      Object.assign(e, {
        amount,
        description:
          str("description") ||
          state.categories.find((c) => c.id === str("category_id"))?.name ||
          "Lançamento",
        category_id: str("category_id"),
        due_date: str("due_date"),
        version: e.version + 1,
      });
    }
  } else if (operation === "update_transaction") {
    const e = findEntry();
    if (
      cents(e.settled_amount) ||
      e.installment_number ||
      e.status === "canceled"
    )
      throw new Error("Este lançamento não pode ser editado.");
    Object.assign(e, {
      description:
        str("description") ||
        state.categories.find((c) => c.id === str("category_id"))?.name ||
        "Lançamento",
      amount: positive("amount"),
      category_id: str("category_id"),
      due_date: str("due_date"),
      version: e.version + 1,
    });
  } else if (operation === "create_account") {
    actualOpening(str("opening_date"));
    state.accounts.push({
      id: newKey(),
      name: str("name"),
      opening_balance: decimal(cents(str("opening_balance"))),
      opening_date: str("opening_date"),
    });
  } else if (operation === "create_category") {
    if (state.categories.some((c) => c.name === str("name")))
      throw new Error("Categoria já existe.");
    state.categories.push({
      id: newKey(),
      name: str("name"),
      color: str("color"),
      kind: (str("kind") || "both") as "income" | "expense" | "both",
      archived: false,
    });
  } else if (operation === "create_goal") {
    state.goals.push({
      id: newKey(),
      name: str("name"),
      target: positive("target"),
      target_date: p.target_date ? str("target_date") : null,
    });
    if (p.initial_plan_amount != null) {
      const amount = cents(String(p.initial_plan_amount));
      if (amount < 0 || !/^\d{4}-\d{2}-01$/.test(String(p.initial_plan_month)))
        throw new Error("Confira o aporte planejado.");
      state.plans.push({
        goal_id: state.goals[state.goals.length - 1].id,
        month: String(p.initial_plan_month),
        amount: decimal(amount),
      });
    }
  } else if (operation === "set_goal_plan") {
    const amount = cents(str("amount"));
    if (amount < 0) throw new Error("Valor negativo.");
    state.plans = state.plans.filter(
      (g) => !(g.goal_id === str("goal_id") && g.month === str("month")),
    );
    state.plans.push({
      goal_id: str("goal_id"),
      month: str("month"),
      amount: decimal(amount),
    });
  } else if (operation === "allocate_goal_funds") {
    actual(str("occurred_on"), str("account_id"));
    const value = cents(positive("amount"));
    if (
      [...state.movements, ...state.allocations].some(
        (a) => a.occurred_on > str("occurred_on"),
      )
    )
      throw new Error("Use a data do último movimento ou posterior.");
    const a = state.accounts.find((a) => a.id === str("account_id"))!;
    const available =
      cents(a.opening_balance) +
      sum(
        state.movements.filter((m) => m.account_id === a.id),
        (m) => m.amount,
      ) -
      sum(
        state.allocations.filter((m) => m.account_id === a.id),
        (m) => m.amount,
      );
    const withdrawal = p.direction === "withdraw";
    const held = sum(
      state.allocations.filter(
        (r) => r.goal_id === str("goal_id") && r.account_id === a.id,
      ),
      (r) => r.amount,
    );
    if (withdrawal ? value > held : value > available)
      throw new Error(
        withdrawal
          ? "Reserva insuficiente para retirada."
          : "Saldo não reservado insuficiente nesta conta.",
      );
    state.allocations.push({
      goal_id: str("goal_id"),
      account_id: a.id,
      amount: decimal(withdrawal ? -value : value),
      occurred_on: str("occurred_on"),
    });
  } else if (operation === "update_category") {
    const c = state.categories.find((c) => c.id === str("category_id"));
    if (c)
      Object.assign(c, {
        name: str("name"),
        color: str("color"),
        archived: !!p.archived,
        kind: (p.kind || c.kind || "both") as "income" | "expense" | "both",
      });
  } else if (operation === "delete_goal") {
    if (!state.goals.some((g) => g.id === str("goal_id")))
      throw new Error("Meta não encontrada.");
    if (state.allocations.some((a) => a.goal_id === str("goal_id")))
      throw new Error(
        "Esta meta tem histórico de aportes e não pode ser excluída.",
      );
    state.plans = state.plans.filter((p) => p.goal_id !== str("goal_id"));
    state.goals = state.goals.filter((g) => g.id !== str("goal_id"));
  } else if (operation === "update_goal") {
    const g = state.goals.find((g) => g.id === str("goal_id"));
    if (g)
      Object.assign(g, {
        name: str("name"),
        target: positive("target"),
        target_date: p.target_date ? str("target_date") : null,
      });
  } else if (operation === "update_recurring_expense") {
    const r = state.recurring.find((r) => r.id === str("recurring_id"));
    if (r)
      Object.assign(r, {
        name: str("name"),
        amount: positive("amount"),
        category_id: str("category_id"),
        account_id: str("account_id"),
        day: Number(p.day),
        due_rule:
          p.due_rule === "salary_fifth_business_day"
            ? "salary_fifth_business_day"
            : "calendar_day",
        start_month: str("start_month"),
        end_month: p.end_month ? str("end_month") : null,
        active: !!p.active,
      });
  } else if (operation === "pay_card_invoice") {
    let remaining = cents(positive("amount"));
    const rows = state.entries.filter(
      (e) =>
        e.card_id === str("card_id") &&
        e.due_date.startsWith(str("month").slice(0, 7)) &&
        e.status !== "canceled",
    );
    if (
      remaining >
      rows.reduce((n, e) => n + cents(e.amount) - cents(e.settled_amount), 0)
    )
      throw new Error("O pagamento excede o saldo aberto.");
    for (const entry of rows) {
      const applied = Math.min(
        remaining,
        cents(entry.amount) - cents(entry.settled_amount),
      );
      if (applied > 0) {
        settle(entry, decimal(applied), str("paid_on"), str("account_id"));
        remaining -= applied;
      }
    }
  } else if (operation === "set_budget") {
    const amount = cents(str("amount"));
    if (amount < 0) throw new Error("Valor negativo.");
    state.budgets = state.budgets.filter(
      (b) =>
        !(b.month === str("month") && b.category_id === str("category_id")),
    );
    state.budgets.push({
      id: newKey(),
      category_id: str("category_id"),
      month: str("month"),
      amount: decimal(amount),
    });
  } else if (operation === "create_card")
    state.cards.push({
      id: newKey(),
      name: str("name"),
      closing_day: Number(p.closing_day),
      due_day: Number(p.due_day),
      blocked: !!p.blocked,
    });
  else if (operation === "set_card_block") {
    const c = state.cards.find((c) => c.id === str("card_id"));
    if (c) c.blocked = !!p.blocked;
  } else if (operation === "create_card_purchase") {
    const card = state.cards.find((c) => c.id === str("card_id"));
    if (!card || card.blocked)
      throw new Error("Cartão bloqueado no aplicativo.");
    const total = cents(positive("total")),
      n = Number(p.installments),
      first = str("first_due_date");
    if (!Number.isInteger(n) || n < 1 || n > 120 || total < n)
      throw new Error("Quantidade de parcelas inválida.");
    if (str("purchased_on") > today() || first < str("purchased_on"))
      throw new Error("Datas da compra inválidas.");
    for (let i = 0; i < n; i++) {
      const m = shiftMonth(first.slice(0, 7), i),
        [y, mo] = m.split("-").map(Number);
      const day = Math.min(
        Number(first.slice(8)),
        new Date(y, mo, 0).getDate(),
      );
      state.entries.push({
        id: newKey(),
        kind: "expense",
        description: `${str("description")} · ${i + 1}/${n}`,
        amount: decimal(Math.floor(total / n) + (i < total % n ? 1 : 0)),
        settled_amount: "0.00",
        category_id: str("category_id"),
        account_id: null,
        card_id: card.id,
        due_date: `${m}-${String(day).padStart(2, "0")}`,
        paid_on: null,
        status: "pending",
        version: 1,
        installment_number: i + 1,
        recurring: false,
      });
    }
  } else if (operation === "register_opening_invoice") {
    if (
      state.entries.some(
        (e) =>
          e.card_id === str("card_id") &&
          e.due_date.startsWith(str("due_date").slice(0, 7)),
      )
    )
      throw new Error("Use uma fatura vazia.");
    state.entries.push({
      id: newKey(),
      kind: "expense",
      description: "Fatura inicial",
      amount: positive("amount"),
      settled_amount: "0.00",
      category_id: str("category_id"),
      account_id: null,
      card_id: str("card_id"),
      due_date: str("due_date"),
      paid_on: null,
      status: "pending",
      version: 1,
      installment_number: null,
      recurring: false,
    });
  } else if (operation === "create_recurring_expense") {
    const name =
      str("name") ||
      state.categories.find((c) => c.id === str("category_id"))?.name ||
      "Lançamento fixo";
    if (
      state.recurring.some(
        (r) =>
          r.active &&
          (r.kind || "expense") === (str("kind") || "expense") &&
          r.account_id === str("account_id") &&
          r.category_id === str("category_id") &&
          r.name.trim().toLocaleLowerCase("pt-BR") ===
            name.trim().toLocaleLowerCase("pt-BR") &&
          (!r.end_month || r.end_month >= str("start_month")) &&
          (!p.end_month || r.start_month <= str("end_month")),
      )
    )
      throw new Error(
        "Já existe esse lançamento fixo. Edite a recorrência existente em Ajustes > Despesas fixas.",
      );
    state.recurring.push({
      id: newKey(),
      name:
        str("name") ||
        state.categories.find((c) => c.id === str("category_id"))?.name ||
        "Lançamento fixo",
      kind: (str("kind") || "expense") as "income" | "expense",
      amount: positive("amount"),
      day: Number(p.day),
      due_rule:
        p.due_rule === "salary_fifth_business_day"
          ? "salary_fifth_business_day"
          : "calendar_day",
      category_id: str("category_id"),
      account_id: str("account_id"),
      start_month: str("start_month"),
      end_month: p.end_month ? str("end_month") : null,
      active: true,
    });
  } else if (operation === "generate_recurring_expenses") {
    const m = str("month");
    for (const r of state.recurring.filter(
      (r) =>
        r.active && r.start_month <= m && (!r.end_month || r.end_month >= m),
    )) {
      const key = `${r.id}:${m}`;
      if (state.occurrences.includes(key)) continue;
      const [y, mo] = m.split("-").map(Number),
        day = Math.min(r.day, new Date(y, mo, 0).getDate());
      state.entries.push({
        id: `recurring:${key}`,
        kind: r.kind || "expense",
        description: r.name,
        amount: r.amount,
        settled_amount: "0.00",
        category_id: r.category_id,
        account_id: r.account_id,
        card_id: null,
        due_date:
          r.due_rule === "salary_fifth_business_day"
            ? fifthBusinessDay(m.slice(0, 7))
            : `${m.slice(0, 7)}-${String(day).padStart(2, "0")}`,
        paid_on: null,
        status: "pending",
        version: 1,
        installment_number: null,
        recurring: true,
      });
      state.occurrences.push(key);
    }
  } else if (operation === "transfer_goal_plan") {
    if (p.from_goal_id === p.to_goal_id)
      throw new Error("Escolha metas diferentes.");
    const source = state.plans.find(
      (g) => g.goal_id === str("from_goal_id") && g.month === str("month"),
    );
    const value = cents(positive("amount"));
    if (!source || cents(source.amount) < value)
      throw new Error("Plano insuficiente.");
    source.amount = decimal(cents(source.amount) - value);
    let target = state.plans.find(
      (g) => g.goal_id === str("to_goal_id") && g.month === str("month"),
    );
    if (!target) {
      target = {
        goal_id: str("to_goal_id"),
        month: str("month"),
        amount: "0.00",
      };
      state.plans.push(target);
    }
    target.amount = decimal(cents(target.amount) + value);
  } else throw new Error("Operação indisponível na demonstração.");
  return state;
}
function actualOpening(value: string) {
  if (value > today()) throw new Error("A abertura não pode estar no futuro.");
}
export type { DemoState };
