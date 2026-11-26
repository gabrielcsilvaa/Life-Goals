export type Entry = {
  id: string;
  kind: "income" | "expense";
  description: string;
  amount: string;
  settled_amount: string;
  category_id: string;
  account_id: string | null;
  card_id: string | null;
  due_date: string;
  paid_on: string | null;
  status: "pending" | "partial" | "paid" | "canceled";
  version: number;
  installment_number: number | null;
  recurring: boolean;
};
export type Category = {
  kind?: "income" | "expense" | "both";
  id: string;
  name: string;
  color: string;
  archived: boolean;
};
export type Account = {
  id: string;
  name: string;
  balance: string;
  reserved: string;
  opening_date: string;
};
export type Goal = {
  id: string;
  name: string;
  target: string;
  target_date: string | null;
  accumulated: string;
  planned: string;
  contributed: string;
  history?: { month: string; accumulated: string }[];
};
export type Card = {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  blocked: boolean;
  invoice_total: string;
  invoice_paid: string;
};
export type Snapshot = {
  user: { name: string; username: string; timezone: string };
  month: string;
  as_of: string;
  summary: Record<
    | "balance"
    | "reserved"
    | "income_expected"
    | "income_received"
    | "expense_expected"
    | "expense_paid"
    | "unpaid"
    | "budget_remaining"
    | "goal_plan_remaining"
    | "available",
    string
  >;
  accounts: Account[];
  categories: Category[];
  entries: Entry[];
  entry_count: number;
  goals: Goal[];
  cards: Card[];
  upcoming: (Entry & { remaining: string })[];
  history: { month: string; income: string; expense: string }[];
  category_expenses: {
    category_id: string;
    name: string;
    color: string;
    amount: string;
  }[];
  budgets: { id: string; category_id: string; amount: string }[];
  recurring: {
    kind?: "income" | "expense";
    due_rule?: "calendar_day" | "salary_fifth_business_day";
    id: string;
    name: string;
    amount: string;
    day: number;
    active: boolean;
    category_id: string;
    account_id: string;
    start_month: string;
    end_month: string | null;
  }[];
  criteria: string;
};
export type Connection = {
  id: string;
  name: string;
  scopes: string[];
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};
export type Payload = Record<string, string | number | boolean | null>;
