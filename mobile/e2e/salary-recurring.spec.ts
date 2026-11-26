import { expect, test } from "@playwright/test";

test("salary repeats monthly without a mandatory description or payment wording", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Receita", exact: true }).click();
  await expect(
    page.getByText("Em qual conta vai entrar?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Pagar com qual conta?", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Valor (R$)", { exact: true }).fill("2300");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Salário", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Salário no 5º dia útil", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Repetir todo mês", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Previsão de recebimento (AAAA-MM-DD)", { exact: true }),
  ).toHaveValue("07/01/2027");
  await expect(page.getByText(/5º dia útil ·/)).toBeVisible();
  await page.screenshot({ path: "../artifacts/salary-recurring-form.png" });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Registrar receita", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/planning?section=recurring");
  await expect(page.getByText("Salário", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 2.300,00", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Gerar compromissos deste mês",
      exact: true,
    }),
  ).toHaveCount(0);
});
