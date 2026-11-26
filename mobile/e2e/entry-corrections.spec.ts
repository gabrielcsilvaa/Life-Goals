import { expect, test } from "@playwright/test";
test("paid income has visible edit and delete actions and corrects received totals", async ({
  page,
}) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Receita", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("1000");
  await page.getByLabel("Descrição", { exact: true }).fill("Receita incorreta");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Salário", exact: true }).click();
  await page.getByRole("radio", { name: "Já recebi", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Editar receita: Receita incorreta",
      exact: true,
    })
    .click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("500");
  await page
    .getByRole("button", { name: "Salvar correção", exact: true })
    .click();
  await expect(
    page.getByText("R$ 500,00", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Editar receita: Receita incorreta",
      exact: true,
    })
    .click();
  await page
    .getByRole("radio", { name: "Ainda vou receber", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvar correção", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Detalhes: Receita incorreta", exact: true })
      .locator("..")
      .getByText("Previsto", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Excluir receita: Receita incorreta",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Excluir lançamento?", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Excluir receita: Receita incorreta",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Receita incorreta", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "../artifacts/income-corrected-and-deleted.png",
  });
});

test("changing an expected date never receives income; a mistaken receipt can be undone", async ({
  page,
}) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Receita", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("1100");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Receita prevista teste");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Salário", exact: true }).click();
  await page
    .getByLabel("Previsão de recebimento (AAAA-MM-DD)", { exact: true })
    .fill("30/01/2027");
  await expect(
    page.getByRole("radio", { name: "Ainda vou receber", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Editar receita: Receita prevista teste",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Editar lançamento", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
});
