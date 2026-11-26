import { expect, test } from "@playwright/test";

test("expense, income, card and recurring use scoped categories", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await expect(page.getByText("Registrar despesa", { exact: true })).toBeVisible();
  await expect(page.getByText("Pagar com qual conta?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Selecionar Categoria", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Transporte", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Salário", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cartão", exact: true }).click();
  await expect(page.getByText("Despesa no cartão", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar formulário", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa fixa", exact: true }).click();
  await page.getByRole("button", { name: "Selecionar Categoria", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Salário", exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Transporte", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar formulário", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Receita", exact: true }).click();
  await expect(page.getByText("Em qual conta vai entrar?", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cartão", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Selecionar Categoria", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Salário", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Transporte", exact: true })).toHaveCount(0);
});
