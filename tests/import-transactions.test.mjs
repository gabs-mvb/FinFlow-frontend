import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

async function moduleUrl(path, imports = {}) {
  let source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  for (const [specifier, url] of Object.entries(imports)) {
    source = source
      .replaceAll(`'${specifier}'`, `'${url}'`)
      .replaceAll(`"${specifier}"`, `"${url}"`);
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const labelsUrl = await moduleUrl("lib/labels.ts");
const { readCsv, parseTransactions } = await import(
  await moduleUrl("lib/import-transactions.ts", { "./labels": labelsUrl })
);

function transaction(overrides = {}) {
  return {
    externalId: "tx-001",
    type: "DEBIT",
    amount: { amount: 19.9, currency: "BRL" },
    description: "Mercado",
    occurredAt: "2026-09-20T12:30:00-03:00",
    ...overrides,
  };
}
function parseJson(value, currency = "BRL") {
  return parseTransactions(JSON.stringify(value), "extrato.json", currency);
}
const csvHeaders = "externalId,type,amount,description,occurredAt";

test("CSV reads BOM, semicolon separators, decimal commas, CRLF and blank trailing rows", () => {
  const csv =
    "\uFEFFexternalId;type;amount;currency;description;occurredAt\r\n tx-001 ;debit;19,90;BRL; Mercado ;2026-09-20T12:30:00-03:00\r\n\r\n";
  assert.deepEqual(parseTransactions(csv, "extrato.csv", "BRL"), [
    transaction(),
  ]);
});

test("CSV quoted values retain commas and escaped double quotes", () => {
  const csv = `${csvHeaders}\n"tx-001",DEBIT,19.90,"Mercado, filial ""Centro""",2026-09-20T12:30:00-03:00`;
  const [item] = parseTransactions(csv, "extrato.csv", "BRL");
  assert.equal(item.description, 'Mercado, filial "Centro"');
  assert.deepEqual(item.amount, { amount: 19.9, currency: "BRL" });
});

test("CSV preserves multiline text inside quoted fields without splitting a transaction", () => {
  const csv =
    'externalId;type;amount;description;occurredAt\r\n"tx-001";DEBIT;19,90;"Mercado; Centro\r\nCompra semanal";2026-09-20T12:30:00-03:00';
  const result = parseTransactions(csv, "extrato.csv", "BRL");
  assert.equal(result.length, 1);
  assert.equal(result[0].description, "Mercado; Centro\r\nCompra semanal");
});

test("CSV rejects unclosed quotes and missing required columns", () => {
  assert.throws(() => readCsv('a,b\n"unfinished'), /aspas sem fechamento/i);
  assert.throws(
    () =>
      parseTransactions(
        "description,amount\nMercado,19.90",
        "extrato.csv",
        "BRL",
      ),
    /externalId.*type.*occurredAt/,
  );
  assert.throws(() => parseTransactions("", "extrato.csv", "BRL"), /vazio/);
});

test("CSV uses the selected account currency when omitted and parses optional columns", () => {
  const csv = `${csvHeaders},merchant,category\ntx-001,credit,19.90,Estorno,2026-09-20T15:30:00Z,Loja,other`;
  const [item] = parseTransactions(csv, "extrato.csv", "USD");
  assert.equal(item.type, "CREDIT");
  assert.equal(item.amount.currency, "USD");
  assert.equal(item.merchant, "Loja");
  assert.equal(item.category, "OTHER");
});

test("JSON accepts both an array and a transactions wrapper, including uppercase file extension", () => {
  const expected = [
    transaction({ category: "FOOD", merchant: "Mercado Central" }),
  ];
  assert.deepEqual(parseJson(expected), expected);
  assert.deepEqual(
    parseJson({ transactions: expected, accountId: "ignored" }),
    expected,
  );
  assert.deepEqual(
    parseTransactions(JSON.stringify(expected), "EXTRATO.JSON", "BRL"),
    expected,
  );
});

test("JSON normalizes identifier and description whitespace before returning request items", () => {
  assert.deepEqual(
    parseJson([
      transaction({ externalId: "  tx-001  ", description: "  Mercado  " }),
    ]),
    [transaction()],
  );
});

test("JSON rejects duplicate external IDs after trimming", () => {
  assert.throws(
    () => parseJson([transaction(), transaction()]),
    /Transação 2:.*repetido/,
  );
  assert.throws(
    () => parseJson([transaction(), transaction({ externalId: " tx-001 " })]),
    /Transação 2:.*repetido/,
  );
  assert.throws(
    () => parseJson([transaction({ externalId: " tx-001 " }), transaction()]),
    /Transação 2:.*repetido/,
  );
});

test("JSON rejects currencies different from the selected account, including missing currency", () => {
  for (const currency of ["USD", "brl", "", null, undefined]) {
    assert.throws(
      () => parseJson([transaction({ amount: { amount: 19.9, currency } })]),
      /moeda precisa ser BRL/,
    );
  }
  assert.equal(
    parseJson(
      [transaction({ amount: { amount: 19.9, currency: "EUR" } })],
      "EUR",
    )[0].amount.currency,
    "EUR",
  );
});

test("JSON requires a finite positive numeric amount with at most two decimals", () => {
  for (const amount of [
    0,
    -1,
    1.001,
    1.005,
    1e-10,
    1e308,
    "19.90",
    null,
    true,
  ]) {
    assert.throws(
      () => parseJson([transaction({ amount: { amount, currency: "BRL" } })]),
      /valor deve ser positivo/,
    );
  }
  assert.throws(
    () =>
      parseTransactions(
        '[{"externalId":"1","type":"DEBIT","description":"Compra","amount":{"amount":1e400,"currency":"BRL"},"occurredAt":"2026-09-20T00:00:00Z"}]',
        "extrato.json",
        "BRL",
      ),
    /valor deve ser positivo/,
  );
  assert.equal(
    parseJson([transaction({ amount: { amount: 0.01, currency: "BRL" } })])[0]
      .amount.amount,
    0.01,
  );
  assert.equal(
    parseJson([
      transaction({ amount: { amount: 0.1 + 0.2, currency: "BRL" } }),
    ])[0].amount.amount,
    0.3,
  );
});

test("JSON requires ISO dates with explicit time zone and accepts positive/negative offsets", () => {
  for (const occurredAt of [
    "2026-09-20",
    "2026-09-20T12:30:00",
    "September 20, 2026Z",
    "2026-09-20 12:30:00Z",
    "2026-02-30T12:00:00Z",
    "2026-02-29T12:00:00Z",
    "not-a-date",
    "2026-13-20T00:00:00Z",
    "2026-09-20T00:00:00+25:00",
    "2026-09-20T00:00:00+18:01",
    "2026-09-20T00:00:00+05:60",
    "2026-09-20T24:00:00Z",
    "2026-09-20T23:60:00Z",
    "2026-09-20T23:59:60Z",
    "2026-09-20T12:00:00.1234567890Z",
    null,
    1234,
  ]) {
    assert.throws(
      () => parseJson([transaction({ occurredAt })]),
      /data ISO com fuso/,
    );
  }
  for (const occurredAt of [
    "2026-09-20T00:00:00Z",
    "2026-09-20T00:00:00-03:00",
    "2026-09-20T00:00:00+05:30",
    "2024-02-29T12:00:00Z",
    "2026-09-20T12:30-03:00",
    "2026-09-20T00:00:00-00:30",
    "2026-09-20T00:00:00+18:00",
    "2026-09-20T00:00:00.123456789+05:45",
  ]) {
    assert.equal(
      parseJson([transaction({ occurredAt })])[0].occurredAt,
      occurredAt,
    );
  }
});

test("JSON categories must be enum strings, not inherited object properties or coercible arrays", () => {
  for (const category of [
    "UNKNOWN",
    "food",
    "constructor",
    "__proto__",
    "toString",
    "valueOf",
    ["FOOD"],
    1,
    {},
  ]) {
    assert.throws(
      () => parseJson([transaction({ category })]),
      /categoria desconhecida/,
    );
  }
  assert.equal(
    parseJson([transaction({ category: "FOOD" })])[0].category,
    "FOOD",
  );
  assert.equal(
    parseJson([transaction({ category: null })])[0].category,
    undefined,
  );
});

test("JSON validates record shape, enum values, and backend text length limits", () => {
  for (const input of [null, 5, "record"])
    assert.throws(() => parseJson([input]), /registro inválido/);
  for (const externalId of ["", "   ", "x".repeat(181)])
    assert.throws(
      () => parseJson([transaction({ externalId })]),
      /identificador obrigatório/,
    );
  for (const description of ["", "   ", "x".repeat(301)])
    assert.throws(
      () => parseJson([transaction({ description })]),
      /descrição obrigatória/,
    );
  for (const type of ["debit", "OTHER", null])
    assert.throws(
      () => parseJson([transaction({ type })]),
      /tipo deve ser CREDIT/,
    );
  for (const merchant of [123, "x".repeat(181)])
    assert.throws(
      () => parseJson([transaction({ merchant })]),
      /estabelecimento/,
    );
  assert.equal(
    parseJson([
      transaction({
        externalId: "x".repeat(180),
        description: "x".repeat(300),
        merchant: "x".repeat(180),
      }),
    ]).length,
    1,
  );
});

test("JSON rejects malformed documents, missing transaction arrays, and empty imports", () => {
  assert.throws(
    () => parseTransactions("{invalid", "extrato.json", "BRL"),
    /JSON está inválido/,
  );
  for (const input of [
    null,
    {},
    { transactions: {} },
    [],
    { transactions: [] },
  ]) {
    assert.throws(() => parseJson(input), /de 1 a 1.000 transações/);
  }
});

test("import accepts exactly 1000 transactions and rejects 1001 before submission", () => {
  const items = Array.from({ length: 1000 }, (_, index) =>
    transaction({ externalId: `tx-${index}` }),
  );
  assert.equal(parseJson(items).length, 1000);
  assert.throws(
    () => parseJson([...items, transaction({ externalId: "tx-1000" })]),
    /de 1 a 1.000 transações/,
  );
});
