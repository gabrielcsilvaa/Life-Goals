import { expect, test } from "@playwright/test";
test("creating a future fixed expense does not hide current income, duplicate, or delete other records", async ({
  page,
}) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Receita", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("1000");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Receita preservada");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Salário", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  async function createRule() {
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await page
      .getByRole("button", { name: "Despesa fixa", exact: true })
      .click();
    await page.getByLabel("Nome", { exact: true }).fill("Conta recorrente QA");
    await page.getByLabel("Valor (R$)", { exact: true }).fill("78");
    await page
      .getByRole("button", { name: "Selecionar Categoria", exact: true })
      .click();
    await page.getByRole("radio", { name: "Transporte", exact: true }).click();
    await page.getByLabel("Dia de vencimento", { exact: true }).fill("1");
    await page
      .getByLabel("Primeiro mês", { exact: true })
      .fill("01/02/2027");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
  }
  await createRule();
  await expect(
    page.getByText("Receita preservada", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Janeiro de 2027", { exact: true }),
  ).toBeVisible();
  await createRule();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /Já existe esse lançamento fixo/ })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Receita preservada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Próximo mês", exact: true }).click();
  await expect(
    page.getByText("Conta recorrente QA", { exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Excluir despesa: Conta recorrente QA",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await expect(page.getByText("Academia", { exact: true })).toBeVisible();
  await expect(page.getByText("TIM", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Fevereiro de 2027", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Conta recorrente QA", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Mês anterior", exact: true }).click();
  await expect(
    page.getByText("Receita preservada", { exact: true }),
  ).toBeVisible();
});
