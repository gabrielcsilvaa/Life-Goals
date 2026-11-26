import { test, expect } from "@playwright/test";

test("manifest, install metadata, deep links and isolated demo", async ({
  page,
  request,
}) => {
  const api: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) api.push(r.url());
  });
  await page.goto("/settings?section=account");
  await expect(
    page.getByText("Demonstração online", { exact: true }),
  ).toBeVisible();
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("Life Goals");
  expect(manifest.icons).toHaveLength(3);
  expect((await request.get("/icons/icon-512.png")).ok()).toBeTruthy();
  expect(api).toHaveLength(0);
  await page.screenshot({ path: "../artifacts/pwa-preview.png" });
});

test("worker never persists authenticated responses and provides safe offline screen", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.evaluate(() => fetch("/api/v1/snapshot/?month=2026-11"));
  const cached = await page.evaluate(async () => {
    const paths = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys())
        paths.push(new URL(req.url).pathname);
    }
    return paths;
  });
  expect(cached.some((p) => /^\/(api|oauth|mcp)/.test(p))).toBe(false);
  await context.setOffline(true);
  await page.goto("/settings?section=account");
  await expect(
    page.getByText("Vamos reconectar", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/registros financeiros não ficam neste cache offline/),
  ).toBeVisible();
});

test("installed version updates only after confirmation and outside a form", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("10,00");
  await page.evaluate(async () => {
    await fetch("/__test/update", { method: "POST" });
    await (await navigator.serviceWorker.getRegistration())?.update();
  });
  const button = page.getByRole("button", {
    name: "Atualização disponível — atualizar",
    exact: true,
  });
  await expect(button).toBeDisabled();
  await page
    .getByRole("button", { name: "Fechar formulário", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toHaveCount(0);
});
