// Optional browser check: run against a local Next server. Every API call is mocked.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.SMOKE_ORIGIN || "http://127.0.0.1:3001";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Only a local preview is allowed");
const output = process.env.SMOKE_OUTPUT || "work/mobile-smoke";
await mkdir(output, { recursive: true });
const money = (amount) => ({ amount, currency: "BRL" });
const stamp = "2026-09-28T12:00:00Z";
const account = { id: "account-test", name: "Conta principal", institution: "Banco de teste", externalId: "fixture", accountType: "CHECKING", purpose: "OPERATING", availableBalance: money(2500), lastSyncedAt: stamp };
const profile = { monthlyIncome: money(4000), payDay: 31, essentialMonthlyExpenses: money(1500), variableMonthlyBudget: money(600), minimumCashBuffer: money(200), emergencyTargetMonths: 6, reserveContributionRate: .1, investmentContributionRate: .1, riskProfile: "CONSERVATIVE", autopilotMode: "OBSERVER" };
const report = { period: "2026-09", totalIncome: money(4000), totalExpenses: money(1500), investmentContributions: money(300), netCashFlow: money(2200), savingsRatePercentage: 55, expensesByCategory: [{ category: "HOUSING", amount: money(1500), percentageOfExpenses: 100 }], priorities: ["Revisar as contas do mês."], assumptions: ["Dados cadastrados no período."] };
const content = { asOf: "2026-09-28", nextIncomeDate: "2026-10-08", summary: "Proteja as contas do mês.", analysis: "Mantenha a reserva e distribua os gastos pelo período.", emergencyReserveTarget: 9000, remainingVariableBudget: 600, minimumCashBuffer: 200, debtPaymentRecommendation: 0, reserveContribution: 300, investmentContribution: 100, dailySpendingLimit: 10, categoryBudgets: [{ category: "FOOD", amount: 600, reason: "Alimentação prevista para o período." }], allocations: [{ assetClass: "FIXED_INCOME", amount: 100 }], actions: [{ type: "TRANSFER_TO_EMERGENCY_RESERVE", amount: 300, riskLevel: "LOW", rationale: "Reforçar a proteção." }], warnings: ["Revise os saldos antes de decidir."] };
const plan = { id: "plan-test", asOf: content.asOf, nextIncomeDate: content.nextIncomeDate, totalConsolidatedBalance: money(2500), operatingBalance: money(2500), emergencyReserveBalance: money(0), emergencyReserveTarget: money(9000), committedObligations: money(1200), remainingVariableBudget: money(600), minimumCashBuffer: money(200), debtPaymentRecommendation: money(0), reserveContribution: money(300), investmentContribution: money(100), freeRealBalance: money(100), projectedShortfall: money(0), dailySpendingLimit: money(10), contributionAllocation: [{ assetClass: "FIXED_INCOME", amount: money(100), reason: "Contribuição prevista." }], actions: [{ id: "action-test", type: "TRANSFER_TO_EMERGENCY_RESERVE", amount: money(300), riskLevel: "LOW", requiresApproval: true, status: "PROPOSED", rationale: "Reforçar a proteção.", executionAvailable: false }], warnings: content.warnings, generatedAt: stamp, revision: 1, updatedAt: stamp, content, details: { source: "MANUAL", summary: content.summary, analysis: content.analysis, categoryBudgets: content.categoryBudgets } };
const fixtures = {
  "/onboarding": { completed: true, readyForDashboard: true },
  "/accounts": [account],
  "/profile": profile,
  "/transactions": [{ id: "transaction-test", accountId: account.id, externalId: "test", type: "DEBIT", amount: money(85), description: "Compras da semana", merchant: "Mercado", occurredAt: stamp, category: "FOOD", categorizationSource: "USER" }],
  "/obligations": [{ id: "obligation-test", name: "Aluguel", type: "HOUSING", amount: money(1200), dueDate: "2026-10-05", recurring: true, dueDay: 5, status: "PENDING" }],
  "/debts": [{ id: "debt-test", name: "Parcela de teste", type: "PERSONAL_LOAN", outstandingAmount: money(1500), annualEffectiveRate: .2, monthlyPayment: money(150), status: "ACTIVE", priority: "HIGH_COST" }],
  "/goals": [{ id: "goal-test", name: "Viagem", targetAmount: money(3000), currentAmount: money(600), targetDate: "2027-01-01", priority: 1, status: "ACTIVE" }],
  "/portfolio": { positions: [{ assetCode: "TEST", assetName: "Renda fixa de teste", assetClass: "FIXED_INCOME", currentValue: money(500) }] },
  "/open-finance/status": { configuredProvider: "disabled", liveSynchronizationAvailable: false, mode: "MANUAL", warning: null },
  "/open-finance/consents": [{ id: "consent-test", provider: "manual", externalConsentId: "test", institution: "Banco de teste", scopes: ["ACCOUNTS", "BALANCES"], status: "ACTIVE", expiresAt: "2027-09-01T00:00:00Z", updatedAt: stamp }],
};
const browser = await chromium.launch({ headless: true });
const errors = [];
const unexpected = [];
try {
  for (const width of [320, 360, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    let authenticated = true;
    let apiRequests = 0;
    let hasPlan = false;
    page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
    await page.route("**/api/finflow/**", async (route) => {
      apiRequests++;
      const url = new URL(route.request().url());
      const path = url.pathname.replace("/api/finflow", "");
      if (route.request().method() !== "GET") {
        unexpected.push(`Unexpected mutation: ${path}`);
        return route.fulfill({ status: 409, json: { detail: "Fixture is read-only" } });
      }
      if (path === "/session") return route.fulfill({ json: authenticated ? { authenticated: true, user: { id: 99, name: "Pessoa de teste", email: "fixture@example.com" }, expiresAt: Date.now() + 3600000 } : { authenticated: false } });
      if (path === "/plans/latest") return route.fulfill(hasPlan ? { json: plan } : { status: 204 });
      if (path === "/reports/monthly") return route.fulfill({ json: report });
      if (Object.hasOwn(fixtures, path)) return route.fulfill({ json: fixtures[path] });
      unexpected.push(path);
      return route.fulfill({ status: 404, json: { detail: "Missing fixture" } });
    });
    async function checkLayout(label) {
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      if (dimensions.document > dimensions.viewport + 1) {
        console.log(await page.locator("body *").evaluateAll((nodes) => nodes.filter((node) => node.getBoundingClientRect().right > innerWidth + 1 && node.getBoundingClientRect().width > 0).map((node) => ({ tag: node.tagName, class: node.className, text: node.textContent?.slice(0, 70), width: node.getBoundingClientRect().width })).slice(-15)));
        await page.screenshot({ path: `${output}/overflow-${width}.png`, fullPage: true });
      }
      assert.ok(dimensions.document <= dimensions.viewport + 1, `${label} at ${width}: horizontal overflow ${JSON.stringify(dimensions)}`);
      console.log(`PASS ${width}px ${label}`);
    }
    await page.goto(origin);
    await page.getByRole("heading", { level: 1, name: "Seu dinheiro, com calma." }).waitFor();
    await checkLayout("landing");
    assert.equal(apiRequests, 0, "Public landing must not request the financial session");
    await page.screenshot({ path: `${output}/landing-${width}.png`, fullPage: true });
    for (const path of ["painel", "contas", "transacoes", "compromissos", "dividas", "metas", "carteira", "relatorios", "conexoes", "perfil", "plano"]) {
      await page.goto(`${origin}/${path}`);
      await page.locator(".main-content h1").waitFor();
      await page.waitForFunction(() => document.querySelectorAll(".loading-state").length === 0);
      assert.equal(await page.getByText(/Application error/).count(), 0, `${path} must render its content`);
      assert.equal(new URL(page.url()).pathname, `/${path}`, "A first plan must not be required to enter the dashboard");
      await checkLayout(path);
      if (path === "painel") await page.getByRole("link", { name: "Gerar primeiro plano" }).waitFor();
      if (path === "contas") {
        await page.screenshot({ path: `${output}/accounts-${width}.png`, fullPage: true });
        await page.getByRole("button", { name: /Adicionar conta/ }).click();
        await page.getByRole("dialog").waitFor();
        await checkLayout("account form");
        const fontSize = await page.locator("dialog input").first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
        assert.ok(fontSize >= 16, "Inputs must avoid mobile auto-zoom");
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      }
    }
    hasPlan = true;
    await page.goto(`${origin}/plano`);
    await page.getByRole("button", { name: "Editar proposta", exact: true }).click();
    await page.getByRole("heading", { name: "Editar proposta · versão 1" }).waitFor();
    await checkLayout("full plan editor");
    await page.screenshot({ path: `${output}/plan-editor-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Fechar sem salvar", exact: true }).click();
    if (width < 721) {
      await page.getByRole("button", { name: "Mais", exact: true }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("dialog").getByRole("link", { name: "Contas", exact: true }).click();
      await page.waitForURL("**/contas");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "Mais", exact: true }).click();
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.body.style.overflow), "", "Closing menu restores scrolling");
    }
    authenticated = false;
    await page.goto(`${origin}/painel`);
    await page.waitForURL("**/login");
    await checkLayout("login");
    await page.goto(`${origin}/cadastro`);
    await page.locator("form").waitFor();
    await checkLayout("registration");
    await context.close();
  }
  assert.deepEqual(errors, [], "No uncaught UI errors");
  assert.deepEqual(unexpected, [], "All API requests must be read-only test fixtures");
} finally { await browser.close(); }
