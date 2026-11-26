import { expect, test } from "@playwright/test";

test("mobile: expense creation, persistence, editing, cancellation and goals", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByText("disponível para gastar", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Demonstração", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("25,90");
  await page.getByLabel("Descrição", { exact: true }).fill("Almoço de teste");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Alimentação", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText(/Despesa salva para/)).toBeVisible();
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar lançamentos" })
    .fill("Almoço de teste");
  await expect(
    page.getByText("Almoço de teste", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Almoço de teste", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Detalhes: Almoço de teste", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Editar despesa: Almoço de teste",
      exact: true,
    })
    .click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("26,10");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("-R$ 26,10", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Excluir despesa: Almoço de teste",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await page.getByRole("button", { name: "Excluídos", exact: true }).click();
  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Minhas metas", exact: true }).click();
  await expect(
    page.getByText(
      "O progresso considera apenas valores realmente reservados.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("responsive dashboard and read-only MCP guidance", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/");
  await expect(page.getByText("meu mês", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "../artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../artifacts/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await page
    .getByRole("button", { name: "Conexões com IA", exact: true })
    .click();
  await expect(
    page.getByText("Nenhuma IA conectada", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Criar conexão MCP", exact: true }),
  ).toHaveCount(0);
});

test("live API: login, persist expense, consult summary and disconnect", async ({
  page,
}) => {
  test.skip(
    !process.env.LIFEGOALS_TEST_API,
    "Run through the optional Django live_server integration test.",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/settings?section=account");
  await page.getByRole("button", { name: /Configuração de conexão/ }).click();
  await page
    .getByLabel("Servidor da API", { exact: true })
    .fill(process.env.LIFEGOALS_TEST_API!);
  await page.getByLabel("Usuário", { exact: true }).fill("browser-test");
  await page.getByLabel("Senha", { exact: true }).fill("Browser-test-only-94!");
  await page
    .getByRole("button", { name: "Entrar na minha conta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "oi, Pessoa", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await page
    .getByRole("button", { name: "Contas e saldo inicial", exact: true })
    .click();
  await expect(page.getByText("Conta pessoal", { exact: true })).toBeVisible();
  await expect(page.getByText("Conta E2E", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("32,00");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Despesa real da integração");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  await page.getByRole("radio", { name: "Já paguei", exact: true }).click();
  await page.getByLabel("Realizado em", { exact: true }).fill(today);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText(/Despesa salva para/)).toBeVisible();
  await expect(
    page.getByText("Despesa real da integração", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Visão geral", exact: true }).click();
  await expect(
    page.getByText("R$ 1.968,00", { exact: true }).first(),
  ).toBeVisible();
  // Exercise both failing user paths against Django, not the demonstration.
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("18,50");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Registrar despesa", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa fixa", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Despesa fixa real");
  await page.getByLabel("Valor (R$)", { exact: true }).fill("140");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page.getByLabel("Dia de vencimento", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Adicionar lançamento fixo", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  await expect(
    page.getByText("Despesa fixa real", { exact: true }),
  ).toBeVisible();
  // Database persistence is checked by the enclosing pytest test.
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await page.getByRole("button", { name: "Minha conta", exact: true }).click();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page.getByText("Demonstração", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
