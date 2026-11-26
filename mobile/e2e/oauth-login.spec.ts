import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
test("OAuth browser login and consent submit with CSRF intact", async ({
  page,
  request,
}) => {
  test.skip(!process.env.LIFEGOALS_TEST_API, "Run via Django live_server.");
  const base = process.env.LIFEGOALS_TEST_API!;
  const redirect = "https://chatgpt.com/connector_platform_oauth_redirect";
  const metadata = await (
    await request.get(base + "/.well-known/oauth-protected-resource/mcp")
  ).json();
  const registered = await request.post(base + "/oauth/register/", {
    data: {
      client_name: "OAuth browser test",
      redirect_uris: [redirect],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
  });
  expect(registered.status()).toBe(201);
  const client = (await registered.json()).client_id;
  const verifier = "browser-pkce-" + "a".repeat(64);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  await page.route(redirect + "**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "OAuth callback test completed",
    }),
  );
  const query = new URLSearchParams({
    client_id: client,
    redirect_uri: redirect,
    response_type: "code",
    scope: "finance:read offline_access",
    resource: metadata.resource,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "csrf-browser-regression",
  });
  await page.goto(base + "/oauth/authorize/?" + query);
  await page.getByLabel("Usuário", { exact: true }).fill("oauth-browser-user");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("Browser-OAuth-test-96!");
  const loginPost = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname === "/oauth/login/",
  );
  await page
    .getByRole("button", { name: "Entrar no Life Goals", exact: true })
    .click();
  expect((await loginPost).status()).toBe(302);
  await expect(
    page.getByRole("button", { name: "Autorizar conexão", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Autorizar conexão", exact: true })
    .click();
  await page.waitForURL(redirect + "**");
  const callback = new URL(page.url());
  expect(callback.searchParams.get("state")).toBe("csrf-browser-regression");
  const exchanged = await request.post(base + "/oauth/token/", {
    form: {
      grant_type: "authorization_code",
      client_id: client,
      code: callback.searchParams.get("code")!,
      code_verifier: verifier,
      redirect_uri: redirect,
      resource: metadata.resource,
    },
  });
  expect(exchanged.status()).toBe(200);
  expect((await exchanged.json()).token_type).toBe("Bearer");
});
