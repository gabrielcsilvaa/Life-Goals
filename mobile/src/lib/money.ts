export function cents(value: string): number {
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(value))
    throw new Error("Informe um valor com até duas casas decimais.");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new Error("Valor fora do limite.");
  return negative ? -result : result;
}
export function decimal(value: number): string {
  if (!Number.isSafeInteger(value))
    throw new Error("Precisão monetária inválida.");
  return `${value < 0 ? "-" : ""}${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, "0")}`;
}
export function normalizeMoney(value: string): string {
  let normalized = value
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (normalized.includes(",")) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{0,2}$/.test(normalized))
      throw new Error("Informe o valor como 140,00 ou 1.200,00.");
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized))
    normalized = normalized.replace(/\./g, "");
  normalized = normalized.replace(/\.$/, "");
  return decimal(cents(normalized));
}
export function money(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(typeof value === "number" ? value : Number(value));
}
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function shiftMonth(month: string, offset: number) {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, m - 1, 1));
}
export function shortDate(value: string) {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}`;
}
export function newKey() {
  return `lg-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
