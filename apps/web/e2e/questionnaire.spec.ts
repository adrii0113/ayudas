import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function choose(page: Page, name: string | RegExp) {
  await page.getByRole("radio", { name, exact: typeof name === "string" }).click();
}

async function fill(page: Page, value: string) {
  await page.getByRole("textbox").first().fill(value);
  await page.getByRole("button", { name: /Siguiente|Ver mis ayudas/ }).click();
}

/** Answers whatever question is on screen; the adaptive order depends on the catalog. */
async function answerUntilResults(
  page: Page,
  answers: Record<string, (page: Page) => Promise<void>>,
) {
  for (let step = 0; step < 20; step++) {
    if (page.url().includes("/resultados")) return;
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    const title = (await heading.textContent())?.trim() ?? "";
    const answer = answers[title];
    if (!answer) throw new Error(`Unexpected question: ${title}`);
    await answer(page);
    await expect(heading)
      .not.toHaveText(title, { timeout: 5000 })
      .catch(() => {});
  }
}

test("single mother in Castilla y León gets her benefits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Descubre tus ayudas" }).first().click();

  await expect(
    page.getByRole("heading", { name: "¿En qué comunidad autónoma vives?" }),
  ).toBeVisible();
  await answerUntilResults(page, {
    "¿En qué comunidad autónoma vives?": (p) => choose(p, "Castilla y León"),
    "¿Cuánto tiempo llevas empadronado en tu comunidad autónoma?": (p) => choose(p, "5 años o más"),
    "¿Cuántos años tienes?": (p) => fill(p, "29"),
    "¿Cuántos hijos o menores a tu cargo viven contigo?": async (p) => {
      await p.getByRole("button", { name: "+1" }).click();
      await p.getByLabel("Edad del hijo 1").fill("0");
      await p.getByRole("button", { name: /Siguiente|Ver mis ayudas/ }).click();
    },
    "¿Cuántas personas viven en tu casa, contándote a ti?": (p) => fill(p, "2"),
    "¿Cuál es vuestra situación familiar?": (p) => choose(p, "Familia monoparental"),
    "¿Cuántos ingresos tiene tu hogar, aproximadamente?": async (p) => {
      await p.getByLabel("Cantidad en euros").fill("750");
      await p.getByRole("button", { name: /Siguiente|Ver mis ayudas/ }).click();
    },
    "¿Cuál es tu situación laboral?": (p) => choose(p, "Trabajo por cuenta ajena"),
    "¿Cómo vives en tu vivienda?": (p) => choose(p, "De alquiler"),
    "¿Cuánto pagas de alquiler al mes?": (p) => fill(p, "500"),
    "¿Vive contigo o cuidas de alguien que necesita ayuda para su día a día?": (p) =>
      choose(p, "No"),
    "¿Tienes una discapacidad reconocida?": (p) => choose(p, "No"),
    "¿Cuánto tiempo llevas viviendo legalmente en España?": (p) => choose(p, "5 años o más"),
    "¿Tú o alguien de tu hogar cobra ya el Ingreso Mínimo Vital?": (p) => choose(p, "No"),
  });

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
  await choose(page, "No vivo en España");
  // No municipality / years registered questions outside Spain.
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

test("no WCAG A/AA violations on /resultados", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    sessionStorage.setItem(
      "tetoca.answers.v1",
      JSON.stringify({
        region: "CL",
        applicantAge: 30,
        householdSize: 2,
        children: [{ age: 0, disabilityPercent: 0 }],
        annualHouseholdIncome: 9000,
        employmentStatus: "unemployed",
        housing: "renting",
        monthlyRent: 400,
        isSingleParent: true,
      }),
    ),
  );
  await page.goto("/resultados");
  await expect(page.getByRole("heading", { name: /Te corresponden/ })).toBeVisible();
  // Let entrance animations settle so contrast is measured at full opacity.
  await page.waitForTimeout(600);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
