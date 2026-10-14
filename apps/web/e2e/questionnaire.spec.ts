import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function choose(page: Page, name: string | RegExp) {
  await page.getByRole("radio", { name, exact: typeof name === "string" }).click();
}

async function fill(page: Page, value: string) {
  await page.getByRole("textbox").first().fill(value);
  await page.getByRole("button", { name: /Siguiente|Ver mis ayudas/ }).click();
}

test("single mother in Castilla y León gets her benefits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Descubre tus ayudas" }).first().click();

  await expect(page.getByRole("heading", { name: "¿Dónde vives?" })).toBeVisible();
  await choose(page, "Castilla y León");
  // No municipality question: no published municipal benefit needs it yet.
  await choose(page, "5 años o más");
  await fill(page, "29"); // age

  // Children: one baby
  await page.getByRole("button", { name: "+1" }).click();
  await page.getByLabel("Edad del hijo 1").fill("0");
  await page.getByRole("button", { name: "Siguiente" }).click();

  await fill(page, "2"); // household size
  await choose(page, "Familia monoparental");

  await page.getByLabel("Cantidad en euros").fill("750");
  await page.getByRole("button", { name: "Siguiente" }).click();

  await choose(page, "Trabajo por cuenta ajena");
  await choose(page, "De alquiler");
  await fill(page, "500"); // rent
  await choose(page, "No"); // dependent person
  await choose(page, "No"); // disability
  await choose(page, "5 años o más"); // legal residence
  // No IMV question: with this income the answer would not change any result.

  await expect(page).toHaveURL(/\/resultados/);
  await expect(page.getByRole("heading", { name: /Te corresponden/ })).toBeVisible();
  const eligible = page.locator("section", { has: page.locator("#eligible") });
  await expect(eligible.getByText("Bono Nacimiento de Castilla y León 2026")).toBeVisible();
  await expect(eligible.getByText("Deducción por maternidad (IRPF)")).toBeVisible();
  await expect(page.getByText("Información orientativa")).toBeVisible();

  await page.screenshot({ path: "test-results/results.png", fullPage: true });
});

test("the questionnaire skips questions no benefit needs", async ({ page }) => {
  await page.goto("/cuestionario");
  await choose(page, "En otra comunidad autónoma");
  // No municipality / years registered questions outside Castilla y León.
  await expect(page.getByRole("heading", { name: "¿Cuántos años tienes?" })).toBeVisible();
});

test("back button returns to the previous question with the answer kept", async ({ page }) => {
  await page.goto("/cuestionario");
  await choose(page, "Castilla y León");
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(page.getByRole("radio", { name: "Castilla y León" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("results without answers invite to start", async ({ page }) => {
  await page.goto("/resultados");
  await expect(page.getByText("Todavía no has respondido el cuestionario.")).toBeVisible();
});

for (const path of ["/", "/cuestionario", "/ayudas", "/ayudas/bono-social-electrico"]) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}
