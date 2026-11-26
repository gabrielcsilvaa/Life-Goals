import { money, normalizeMoney } from "./money";

export function formatMoneyInput(value: string): string {
  if (!value.trim()) return "";
  try {
    return money(normalizeMoney(value)).replace(/^R\$\s*/, "");
  } catch {
    return value; // Keep invalid input for the user to correct, without rounding it.
  }
}

export function displayDate(value: string, monthOnly = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return monthOnly
    ? `${value.slice(5, 7)}/${value.slice(0, 4)}`
    : value.split("-").reverse().join("/");
}

export function parseDateInput(value: string, monthOnly = false): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const month = /^(\d{2})\/(\d{4})$/.exec(value);
  const day = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso =
    monthOnly && month
      ? `${month[2]}-${month[1]}-01`
      : day
        ? `${day[3]}-${day[2]}-${monthOnly ? "01" : day[1]}`
        : "";
  const parsed = new Date(`${iso}T12:00:00Z`);
  return iso &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === iso
    ? iso
    : value;
}
