import { expect, test } from "@playwright/test";

test("registration collects email and sends it to the API", async ({
  page,
}) => {
  await page.goto("/settings?section=account&register=1");
  const submit = page.getByRole("button", {
    name: "Criar minha conta",
    exact: true,
  });
  await page.getByLabel("Seu nome", { exact: true }).fill("Pessoa");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("Strong-user-password-91!");
  await expect(submit).toBeDisabled();
  const email = page.getByLabel("E-mail", { exact: true });
  await expect(email).toHaveAttribute("autocomplete", "email");
  await email.fill("pessoa@example.com");
  await expect(submit).toBeEnabled();
  await page.screenshot({
    path: "../artifacts/signup-email.png",
    fullPage: true,
  });
  await page.route("**/api/v1/web/csrf/", (route) =>
    route.fulfill({ json: { csrfToken: "synthetic-csrf-token" } }),
  );
  await page.route("**/api/v1/web/register/", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      password: "Strong-user-password-91!",
      display_name: "Pessoa",
      email: "pessoa@example.com",
    });
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ email: ["Informe um e-mail válido."] }),
    });
  });
  await submit.click();
  await expect(page.getByRole("alert")).toContainText(
    "Informe um e-mail válido.",
  );
  await page
    .getByRole("button", { name: "Já tenho uma conta", exact: true })
    .click();
  await expect(
    page.getByLabel("E-mail ou usuário", { exact: true }),
  ).toBeVisible();
});
