import { expect, test, Page } from "@playwright/test";
import { demoSnapshot, initialDemo } from "../src/lib/demo";

async function fakeAccount(
  page: Page,
  failFirstWrite = false,
  failRefresh = false,
) {
  const snapshot = demoSnapshot(initialDemo(), "2026-11");
  snapshot.user = {
    name: "Pessoa de teste",
    username: "qa-user",
    timezone: "America/Sao_Paulo",
  };
  snapshot.summary.balance = snapshot.summary.available = "1000.00";
  snapshot.accounts[0].balance = "1000.00";
  const keys: string[] = [];
  let rejectedRefresh = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/web/csrf/"))
      return route.fulfill({ json: { csrfToken: "synthetic-csrf-token" } });
    if (url.pathname.endsWith("/web/session/"))
      return route.fulfill({
        status: 401,
        json: { detail: "Anonymous synthetic session" },
      });
    if (url.pathname.endsWith("/web/login/"))
      return route.fulfill({
        json: { access: "synthetic-access", refresh: "synthetic-refresh" },
      });
    if (url.pathname.endsWith("/web/logout/"))
      return route.fulfill({ status: 204 });
    if (
      url.pathname.endsWith("/snapshot/") &&
      failRefresh &&
      keys.length &&
      !rejectedRefresh
    ) {
      rejectedRefresh = true;
      return route.abort("failed");
    }
    if (url.pathname.endsWith("/snapshot/"))
      return route.fulfill({
        json: { ...snapshot, month: url.searchParams.get("month") },
      });
    if (url.pathname.endsWith("/connections/"))
      return route.fulfill({ json: [] });
    if (url.pathname.endsWith("/commands/create_transaction/")) {
      keys.push(route.request().headers()["idempotency-key"]);
      if (failFirstWrite && keys.length === 1) return route.abort("failed");
      const payload = route.request().postDataJSON();
      const entry = {
        ...payload,
        id: "qa-entry",
        settled_amount: "0.00",
        card_id: null,
        paid_on: null,
        status: "pending" as const,
        version: 1,
        recurring: false,
        installment_number: null,
      };
      snapshot.entries = [entry];
      snapshot.entry_count = 1;
      return route.fulfill({ json: entry });
    }
    throw new Error(`Unexpected API request: ${url.pathname}`);
  });
  await page.goto("/settings?section=account");
  await page
    .getByRole("textbox", { name: "E-mail ou usuário", exact: true })
    .fill("qa-user");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("synthetic-test-password");
  await page
    .getByRole("button", { name: "Entrar na minha conta", exact: true })
    .click();
  await expect(page.getByText("oi, Pessoa", { exact: true })).toBeVisible();
  return keys;
}

test("account is compact, shows preferences and keeps server details advanced", async ({
  page,
}) => {
  await fakeAccount(page);
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await page.getByRole("button", { name: "Minha conta", exact: true }).click();
  await expect(
    page.getByText("Acesso individual", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Servidor de dados", { exact: true }),
  ).toHaveCount(0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({ path: `../artifacts/audit/account-${width}.png` });
  }
  await page.getByRole("button", { name: /Configuração avançada/ }).click();
  await expect(
    page.getByText("Servidor de dados", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Voltar às configurações", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Minha conta", exact: true }),
  ).toBeVisible();
});

test("draft survives a close attempt and can be discarded explicitly", async ({
  page,
}) => {
  await page.goto("/transactions");
  await page
    .getByRole("button", { name: "Adicionar lançamento", exact: true })
    .click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("1234,56");
  await page.getByLabel("Descrição", { exact: true }).fill("Draft QA");
  await expect(page.getByText(/5º dia útil/)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fechar formulário", exact: true })
    .click();
  await expect(
    page.getByText("Descartar o que você preencheu?", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continuar preenchendo", exact: true })
    .click();
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveValue(
    "Draft QA",
  );
  await expect(page.getByLabel("Valor (R$)", { exact: true })).toHaveValue(
    "1.234,56",
  );
  await page
    .getByRole("button", { name: "Fechar formulário", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await expect(page.getByText("Draft QA", { exact: true })).toHaveCount(0);
});

test("month, filter and search survive navigation without mixing months", async ({
  page,
}) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Receitas", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar lançamentos" })
    .fill("Salário");
  await page.getByRole("link", { name: "Minhas metas", exact: true }).click();
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Buscar lançamentos" }),
  ).toHaveValue("Salário");
  await page.getByRole("button", { name: "Próximo mês", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Buscar lançamentos" }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Mês anterior", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Buscar lançamentos" }),
  ).toHaveValue("Salário");
});

test("network retry preserves idempotency and the entered form", async ({
  page,
}) => {
  const keys = await fakeAccount(page, true);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("12,34");
  await page.getByLabel("Descrição", { exact: true }).fill("Retry QA");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText(/Sem resposta do servidor/).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveValue(
    "Retry QA",
  );
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Fechar formulário", exact: true }),
  ).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test("the calculation distinguishes registered cash from conditional projection", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Entender cálculo disponível", exact: true })
    .click();
  await expect(
    page.getByText("Se receber o previsto do mês", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/pode ser negativo mesmo com saldo positivo/),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.getByText("seu disponível", { exact: true }).evaluate((el) => {
        let opacity = 1;
        for (let node: Element | null = el; node; node = node.parentElement)
          opacity *= Number(getComputedStyle(node).opacity);
        return opacity;
      }),
    )
    .toBe(1);
  await page.screenshot({ path: "../artifacts/audit/calculation-390.png" });
});

test("failed refresh after saving does not invite a duplicate financial operation", async ({
  page,
}) => {
  const keys = await fakeAccount(page, false, true);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("12,34");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Fechar formulário", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Não foi possível atualizar os dados/),
  ).toBeVisible();
  expect(keys).toHaveLength(1);
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.getByText(/Sem resposta do servidor/)).toHaveCount(0);
  expect(keys).toHaveLength(1);
});

test("failed month change does not show old values under a new month", async ({
  page,
}) => {
  await fakeAccount(page);
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  const pattern = "**/api/v1/snapshot/**";
  await page.route(pattern, (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Próximo mês", exact: true }).click();
  await expect(
    page.getByText("Dados indisponíveis. Tente atualizar.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("R$ 1.000,00", { exact: true })).toHaveCount(0);
  await page.unroute(pattern);
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByText("Dados indisponíveis. Tente atualizar.", { exact: true }),
  ).toHaveCount(0);
});
