import { expect, test } from "@playwright/test";

test("dashboard: months, privacy and explicit payment confirmation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByTestId("dashboard-redesign")).toBeVisible();
  await expect(
    page.getByText("disponível para gastar", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("-R$ 1.617,00", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Ocultar valores", exact: true })
    .click();
  await expect(page.getByText("-R$ 1.617,00", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mostrar valores", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Entender cálculo disponível" })
    .click();
  await expect(
    page.getByText("Receitas previstas não são saldo recebido.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Selecionar mês: janeiro de 2027",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "fevereiro de 2027", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Selecionar mês: fevereiro de 2027",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Selecionar mês: fevereiro de 2027",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "janeiro de 2027", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Registrar pagamento: Fatura inicial · Mercado Pago",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Registrar realização", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByText("-R$ 1.617,00", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("dashboard: responsive captures and assets", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("disponível para gastar", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of [
    [390, 844],
    [375, 812],
    [320, 740],
    [768, 1024],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page
          .locator("img")
          .evaluateAll((imgs) =>
            imgs.every(
              (i) =>
                (i as HTMLImageElement).complete &&
                (i as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBeTruthy();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `../artifacts/redesign/dashboard-${width}.png`,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await expect(
    page.getByText("Registrar lançamento", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fechar formulário", exact: true })
    .click();
});
