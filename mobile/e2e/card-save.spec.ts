import { expect, test } from "@playwright/test";
test("saving a card shows the card list and survives reload", async ({
  page,
}) => {
  await page.goto("/planning?section=cards");
  await page
    .getByRole("button", { name: "Adicionar cartão", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Cartão teste visível");
  await page.getByLabel("Dia de fechamento", { exact: true }).fill("5");
  await page.getByLabel("Dia de vencimento", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Cartão salvo: Cartão teste visível.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Cartão teste visível", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Cartão teste visível", { exact: true }),
  ).toBeVisible();
});
