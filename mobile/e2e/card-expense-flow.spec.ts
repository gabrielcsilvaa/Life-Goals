import { test, expect } from "@playwright/test";
test("card current invoice and subsequent expense add only once", async ({
  page,
}) => {
  await page.goto("/planning?section=cards");
  await page
    .getByRole("button", { name: "Adicionar cartão", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Cartão fluxo QA");
  await page.getByLabel("Dia de fechamento", { exact: true }).fill("5");
  await page.getByLabel("Dia de vencimento", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByRole("button", { name: "Informar fatura atual", exact: true })
    .last()
    .click();
  await page
    .getByLabel("Valor da fatura atual (R$)", { exact: true })
    .fill("500");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("R$ 500,00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.getByRole("button", { name: "Cartão", exact: true }).click();
  await page
    .getByRole("radio", { name: "Cartão fluxo QA", exact: true })
    .click();
  await page.getByLabel("Valor total (R$)", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page
    .getByLabel("Data da compra (AAAA-MM-DD)", { exact: true })
    .fill("01/11/2026");
  await page
    .getByLabel("Primeiro vencimento (AAAA-MM-DD)", { exact: true })
    .fill("12/01/2027");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("R$ 600,00", { exact: true })).toBeVisible();
});
