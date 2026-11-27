/** Keep the timeout active through body consumption, not just response headers. */
export async function fetchJson(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.status === 204) return { response, data: null };
    let data: any;
    try {
      data = await response.json();
    } catch {
      if (controller.signal.aborted || response.ok)
        throw new Error(
          "Resposta incompleta. Atualize os dados e tente novamente.",
        );
      data = {};
    }
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}
