/** Salary reference: Saturdays count; excludes Sundays and Brazilian national holidays.
 * Local holidays require a location/calendar and are deliberately not assumed.
 */
export function fifthBusinessDay(
  month: string,
  localHolidays: string[] = [],
): string {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Mês inválido");
  const holidays = new Set([
    "01-01",
    "04-21",
    "05-01",
    "09-07",
    "10-12",
    "11-02",
    "11-15",
    "11-20",
    "12-25",
  ]);
  const [year, m] = month.split("-").map(Number);
  if (m < 1 || m > 12) throw new Error("Mês inválido");
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    if (
      new Date(Date.UTC(year, m - 1, day)).getUTCDay() !== 0 &&
      !holidays.has(iso.slice(5)) &&
      !localHolidays.includes(iso)
    )
      count++;
    if (count === 5) return iso;
  }
  throw new Error("Não foi possível calcular a data");
}
