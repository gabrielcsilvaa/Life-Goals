import { expect, test } from "@playwright/test";
test("session bootstrap starts while fonts are still loading", async ({
  page,
}) => {
  let release!: () => void;
  const fontsHeld = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fontRequests = 0;
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === "lifegoals-demo-v1")
        (window as any).__bootstrapStorageStarted = true;
      return original.call(this, key);
    };
  });
  await page.route(/\.ttf(?:\?|$)/, async (route) => {
    fontRequests++;
    await fontsHeld;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect
      .poll(() => fontRequests, { timeout: 15000 })
      .toBeGreaterThan(0);
    await expect
      .poll(
        () => page.evaluate(() => (window as any).__bootstrapStorageStarted),
        { timeout: 5000 },
      )
      .toBe(true);
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "Adicionar", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: "../artifacts/startup-ready.png" });
});

test("demonstration displays its local financial data without contacting the API", async ({
  page,
}) => {
  let requests = 0;
  await page.route(/\/api\/v1\//, async (route) => {
    requests++;
    await route.abort();
  });
  await page.goto("/");
  await expect(page.getByText("Demonstração", { exact: true })).toBeVisible();
  await expect(
    page.getByText("disponível para gastar", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adicionar", exact: true }),
  ).toBeEnabled();
  expect(requests).toBe(0);
});

test("all demonstration screens remain accessible with the backend unavailable", async ({
  page,
}) => {
  await page.route(/\/api\/v1\//, (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name: "Configurar meu aplicativo",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adicionar", exact: true }),
  ).toBeEnabled();
  for (const [route, content] of [
    ["/transactions", "Entradas recebidas"],
    ["/goals", "Reserva de emergência"],
    ["/settings", "Contas e saldo inicial"],
  ]) {
    await page.goto(route);
    await expect(page.getByText(content, { exact: true })).toBeVisible();
    await expect(page.getByText("Demonstração", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Dados indisponíveis. Tente atualizar.", { exact: true }),
    ).toHaveCount(0);
  }
  await page.screenshot({ path: "../artifacts/demo-settings-accessible.png" });
});
