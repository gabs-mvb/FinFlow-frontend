import type { ImportTransactionItem } from "./finflow/types";
import { categories } from "./labels";

function isOffsetDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:Z|[+-](\d{2}):(\d{2})(?::(\d{2}))?)$/i.exec(
      value,
    );
  if (!match) return false;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    offsetHourText,
    offsetMinuteText,
    offsetSecondText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1])
    return false;
  if (
    Number(hourText) > 23 ||
    Number(minuteText) > 59 ||
    Number(secondText ?? 0) > 59
  )
    return false;
  const offsetHour = Number(offsetHourText ?? 0);
  const offsetMinute = Number(offsetMinuteText ?? 0);
  const offsetSecond = Number(offsetSecondText ?? 0);
  // OffsetDateTime accepts offsets up to 18:00, including fractional-hour zones.
  return (
    offsetHour <= 18 &&
    offsetMinute <= 59 &&
    offsetSecond <= 59 &&
    (offsetHour < 18 || (offsetMinute === 0 && offsetSecond === 0))
  );
}

/** Read quoted CSV fields, including separators and newlines inside quotes. */
export function readCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/)[0];
  const separator = firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (character === separator && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index++;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (quoted) throw new Error("Há aspas sem fechamento no arquivo CSV.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseTransactions(
  text: string,
  filename: string,
  currency: string,
): ImportTransactionItem[] {
  let items: unknown;
  if (filename.toLowerCase().endsWith(".json")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("O arquivo JSON está inválido.");
    }
    items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && "transactions" in parsed
        ? parsed.transactions
        : undefined;
  } else {
    const [headers, ...rows] = readCsv(text);
    if (!headers) throw new Error("O arquivo está vazio.");
    const required = [
      "externalId",
      "type",
      "amount",
      "description",
      "occurredAt",
    ];
    if (required.some((header) => !headers.includes(header)))
      throw new Error(`Use as colunas do modelo: ${required.join(", ")}.`);
    items = rows.map((row) => {
      const data = Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? ""]),
      );
      return {
        externalId: data.externalId,
        type: data.type.toUpperCase(),
        amount: {
          amount: Number(data.amount.replace(",", ".")),
          currency: data.currency || currency,
        },
        description: data.description,
        ...(data.merchant && { merchant: data.merchant }),
        ...(data.category && { category: data.category.toUpperCase() }),
        occurredAt: data.occurredAt,
      };
    });
  }
  if (!Array.isArray(items) || !items.length || items.length > 1000)
    throw new Error("O arquivo deve conter de 1 a 1.000 transações.");
  const seen = new Set<string>();
  return items.map((input, index) => {
    const fail = (message: string): never => {
      throw new Error(`Transação ${index + 1}: ${message}`);
    };
    if (!input || typeof input !== "object") return fail("registro inválido.");
    const item = input as Record<string, unknown>;
    if (
      typeof item.externalId !== "string" ||
      !item.externalId.trim() ||
      item.externalId.length > 180
    )
      return fail("identificador obrigatório, com até 180 caracteres.");
    const externalId = item.externalId.trim();
    if (seen.has(externalId)) return fail("identificador repetido no arquivo.");
    seen.add(externalId);
    if (item.type !== "CREDIT" && item.type !== "DEBIT")
      return fail("tipo deve ser CREDIT (entrada) ou DEBIT (saída).");
    if (
      typeof item.description !== "string" ||
      !item.description.trim() ||
      item.description.length > 300
    )
      return fail("descrição obrigatória, com até 300 caracteres.");
    if (
      item.merchant != null &&
      (typeof item.merchant !== "string" || item.merchant.length > 180)
    )
      return fail("estabelecimento deve ter até 180 caracteres.");
    const amount = item.amount as
      { amount?: unknown; currency?: unknown } | undefined;
    if (
      !amount ||
      typeof amount.amount !== "number" ||
      !Number.isFinite(amount.amount) ||
      amount.amount <= 0 ||
      Math.abs(amount.amount * 100 - Math.round(amount.amount * 100)) > 0.00001
    )
      return fail("valor deve ser positivo, com até duas casas decimais.");
    const normalizedAmount = Math.round(amount.amount * 100) / 100;
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0)
      return fail("valor deve ser positivo, com até duas casas decimais.");
    if (amount.currency !== currency)
      return fail(
        `a moeda precisa ser ${currency}, igual à conta selecionada.`,
      );
    if (
      item.category != null &&
      (typeof item.category !== "string" ||
        !Object.hasOwn(categories, item.category))
    )
      return fail("categoria desconhecida.");
    if (!isOffsetDateTime(item.occurredAt))
      return fail(
        "use uma data ISO com fuso, por exemplo 2026-09-15T12:00:00-03:00.",
      );
    return {
      externalId: item.externalId.trim(),
      type: item.type,
      description: item.description.trim(),
      amount: { amount: normalizedAmount, currency },
      occurredAt: item.occurredAt,
      ...(item.merchant ? { merchant: String(item.merchant) } : {}),
      ...(item.category
        ? { category: item.category as ImportTransactionItem["category"] }
        : {}),
    };
  });
}
