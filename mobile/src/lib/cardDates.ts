/** Suggested billing date only; the user confirms the bank invoice's due date. */
export function suggestedCardDueDate(
  card: { closing_day: number; due_day: number },
  purchasedOn: string,
): string {
  const [year, month, day] = purchasedOn.split("-").map(Number);
  const offset =
    (day > card.closing_day ? 1 : 0) +
    (card.due_day <= card.closing_day ? 1 : 0);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  const due = Math.min(
    card.due_day,
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate(),
  );
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(due).padStart(2, "0")}`;
}
