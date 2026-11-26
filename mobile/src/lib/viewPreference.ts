export type ViewPreference = {
  server: string;
  username: string;
  month: string;
};
export function parseViewPreference(raw: string | null): ViewPreference | null {
  try {
    const view = JSON.parse(raw || "null");
    if (
      view &&
      typeof view.server === "string" &&
      typeof view.username === "string" &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(view.month)
    )
      return view;
  } catch {
    /* Invalid device preferences do not change financial data. */
  }
  return null;
}
export async function restoreAccountView<
  T extends { month: string; user: { username: string } },
>(
  view: ViewPreference | null,
  server: string,
  fallbackMonth: string,
  load: (month: string) => Promise<T>,
): Promise<T> {
  const preferred = view?.server === server ? view.month : fallbackMonth;
  const snapshot = await load(preferred);
  if (preferred !== fallbackMonth && view?.username !== snapshot.user.username)
    return load(fallbackMonth);
  return snapshot;
}
