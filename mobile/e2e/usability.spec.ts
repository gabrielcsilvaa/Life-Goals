import { expect, test } from "@playwright/test";

test("usability: setup and configuration layouts", async ({ page }) => {
  test.setTimeout(90000);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 740 : 900 });
    for (const [route, name] of [
      ["/", "start"],
      ["/settings", "configuration"],
      ["/settings?section=account&register=1", "signup"],
      ["/settings?section=accounts", "accounts"],
      ["/settings?section=categories", "categories"],
      ["/planning?section=cards", "cards"],
      ["/planning?section=recurring", "recurring"],
    ]) {
      await page.goto(route);
      await expect(
        page.getByRole("link", { name: "Configurações", exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.getAnimations().filter((a) => a.playState === "running")
                .length,
          ),
        )
        .toBe(0);
      await page.screenshot({
        path: `../artifacts/usability/${name}-${width}.png`,
      });
    }
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => a.playState === "running")
              .length,
        ),
      )
      .toBe(0);
    await page.screenshot({
      path: `../artifacts/usability/quick-add-initial-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Compra no cartão", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Compra no cartão", exact: true }),
    ).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => a.playState === "running")
              .length,
        ),
      )
      .toBe(0);
    await page.screenshot({
      path: `../artifacts/usability/quick-add-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Fechar painel", exact: true })
      .click();
  }
});

test("usable creation: clear actions, travel goal with plan, settings sections", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name: "Configurar meu aplicativo",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Receita", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    )
    .toBe(0);
  await page.screenshot({ path: "../artifacts/usability/quick-add-390.png" });
  await page
    .getByRole("button", { name: "Meta de viagem", exact: true })
    .click();
  await page.getByRole("button", { name: "Criar meta", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Informe o destino da viagem." }),
  ).toBeInViewport();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    )
    .toBe(0);
  await page.screenshot({
    path: "../artifacts/usability/travel-error-390.png",
  });
  await page.getByLabel("Destino da viagem", { exact: true }).fill("Japão");
  await page.getByRole("radio", { name: "Capa Ásia", exact: true }).click();
  await page
    .getByLabel("Quanto quer juntar? (R$)", { exact: true })
    .fill("12000");
  await page
    .getByLabel("Quanto pretende guardar neste mês? (R$)", { exact: true })
    .fill("300");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    )
    .toBe(0);
  await page.screenshot({
    path: "../artifacts/usability/create-travel-390.png",
  });
  await page.getByRole("button", { name: "Criar meta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Viagem para Japão", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Paisagem de Ásia, imagem ilustrativa",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("R$ 300,00", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Nenhum valor reservado até a data de corte.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Voltar às metas", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Nova meta", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Contas e saldo inicial", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => a.playState === "running")
            .length,
      ),
    )
    .toBe(0);
  await page.screenshot({ path: "../artifacts/usability/settings-390.png" });
  await page.getByRole("button", { name: "Categorias", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Nova categoria", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Servidor da API", { exact: true })).toHaveCount(
    0,
  );
});

test("live API: first use with personal account, real income, travel plan and expense", async ({
  page,
}) => {
  test.skip(
    !process.env.LIFEGOALS_TEST_API,
    "Runs with ephemeral Django live server.",
  );
  const username = `first-use-${Date.now()}`;
  const password = "First-use-test-only-94!";
  await page.goto("/");
  await page
    .getByRole("button", { name: "Configurar meu aplicativo", exact: true })
    .click();
  await page.getByRole("button", { name: /Configuração de conexão/ }).click();
  await page
    .getByLabel("Servidor da API", { exact: true })
    .fill(process.env.LIFEGOALS_TEST_API!);
  await page.getByLabel("Seu nome", { exact: true }).fill("Pessoa nova");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(`${username}@example.com`);

  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Criar minha conta", exact: true })
    .click();
  await expect(
    page.getByText("Vamos configurar seu mês", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Informar meu saldo atual", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Conta própria");
  await page.getByLabel("Saldo inicial (R$)", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Registrar minha primeira receita",
      exact: true,
    })
    .click();
  await page.getByRole("radio", { name: "Já recebi", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("1000");
  await page.getByLabel("Descrição", { exact: true }).fill("Minha renda");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Salário", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("R$ 1.500,00", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page
    .getByRole("button", { name: "Meta de viagem", exact: true })
    .click();
  await page.getByLabel("Destino da viagem", { exact: true }).fill("Japão");
  await page
    .getByLabel("Quanto quer juntar? (R$)", { exact: true })
    .fill("12000");
  await page
    .getByLabel("Quanto pretende guardar neste mês? (R$)", { exact: true })
    .fill("300");
  await page.getByRole("button", { name: "Criar meta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Viagem para Japão", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("R$ 300,00", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Voltar às metas", exact: true })
    .click();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();
  await page.getByRole("radio", { name: "Já paguei", exact: true }).click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("25");
  await page.getByLabel("Descrição", { exact: true }).fill("Meu almoço");
  await page
    .getByRole("button", { name: "Selecionar Categoria", exact: true })
    .click();
  await page.getByRole("radio", { name: "Transporte", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("link", { name: "Visão geral", exact: true }).click();
  await expect(page.getByText("R$ 1.175,00", { exact: true })).toBeVisible();
});
