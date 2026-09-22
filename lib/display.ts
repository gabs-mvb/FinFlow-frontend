export function currency(value?: { amount: number; currency: string } | null) {
  if (!value) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: value.currency,
  }).format(value.amount);
}

export function calendarDate(value?: string | null) {
  if (!value) return "Sem prazo";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthRange(month: string) {
  const [year, number] = month.split("-").map(Number);
  return {
    from: new Date(Date.UTC(year, number - 1, 1)).toISOString(),
    to: new Date(Date.UTC(year, number, 1) - 1).toISOString(),
  };
}

export function totalByCurrency(
  values: { amount: number; currency: string }[],
) {
  const totals = new Map<string, number>();
  for (const value of values)
    totals.set(
      value.currency,
      (totals.get(value.currency) ?? 0) + Math.round(value.amount * 100),
    );
  return Array.from(totals, ([currency, cents]) => ({
    amount: cents / 100,
    currency,
  }));
}
