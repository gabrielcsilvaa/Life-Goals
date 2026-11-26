import { expect, test } from "@playwright/test";

test("redesign: reference screens, goal detail, continent covers and persistence", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/goals");
  await expect(page.getByText("Minhas metas", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Ver meta Viagem para a Itália", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Viagem para a Itália", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhum valor reservado até a data de corte.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar aporte", exact: true })
    .click();
  await expect(
    page.getByText("Reservar para uma meta", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page
    .getByRole("button", { name: "Opções da meta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Escolher capa", exact: true })
    .click();
  await expect(
    page.getByRole("radio", { name: "Capa Antártida", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "../artifacts/redesign/continent-picker.png" });
  await page.getByRole("radio", { name: "Capa Ásia", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "Paisagem de Ásia, imagem ilustrativa",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("img", {
      name: "Paisagem de Ásia, imagem ilustrativa",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Opções da meta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Escolher capa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Automática pelo nome", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Voltar às metas", exact: true })
    .click();
  await page.getByRole("button", { name: "Concluídas", exact: true }).click();
  await expect(
    page.getByText("Seu próximo marco vem aí", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Todas", exact: true }).click();
  for (const [width, height] of [
    [390, 844],
    [320, 740],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [route, name] of [
      ["/transactions", "transactions"],
      ["/goals", "goals"],
      ["/goal?id=italy", "goal"],
      ["/planning", "budget"],
      ["/settings", "settings"],
    ]) {
      // Use the actual goal id from the link, not a fabricated financial record.
      if (name === "goal") {
        await page.goto("/goals");
        await page
          .getByRole("button", {
            name: "Ver meta Viagem para a Itália",
            exact: true,
          })
          .click();
      } else await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
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
        path: `../artifacts/redesign/${name}-${width}.png`,
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await expect(
    page.getByText("Registrar despesa", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("18,50");
  await page.getByLabel("Descrição", { exact: true }).fill("Uber Moto");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page.getByLabel("Descrição", { exact: true }).blur();
  await page.screenshot({
    path: "../artifacts/redesign/transaction-form-390.png",
  });
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  expect(errors).toEqual([]);
});
