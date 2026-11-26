import { expect, test } from "@playwright/test";
test("expense saves without description and preserves the current income filter", async ({
  page,
}) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Receitas", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("12,34");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("-R$ 12,34", { exact: true })).toHaveCount(0);
  await page.getByRole("button", {name: "Todos", exact: true}).click();
  await expect(page.getByText("-R$ 12,34", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa fixa", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("123,45");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page.getByLabel("Dia de vencimento", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("-R$ 123,45", { exact: true })).toBeVisible();
  await page.screenshot({ path: "../artifacts/expenses-saved.png" });
});
