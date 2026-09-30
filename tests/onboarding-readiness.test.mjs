import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/onboarding-readiness.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { isDashboardReady } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("perfil e conta permitem entrar sem plano ou preferência local de adiamento", () => {
  assert.equal(isDashboardReady({ completed: true }, true), true);
  assert.equal(isDashboardReady({ completed: true, readyForDashboard: true }, true), true);
});
test("não ignora pré-requisitos nem recusa explícita da API", () => {
  assert.equal(isDashboardReady(undefined, true), false);
  assert.equal(isDashboardReady({ completed: false }, true), false);
  assert.equal(isDashboardReady({ completed: true }, false), false);
  assert.equal(isDashboardReady({ completed: true, readyForDashboard: false }, true), false);
});
