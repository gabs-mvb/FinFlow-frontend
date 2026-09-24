import type { Debt, MonthlyObligation } from "./finflow/types";

const cents = (amount: number) => Math.round(Number(amount) * 100);

/** A monthly budget uses installments, not the entire outstanding debt balance. */
export function monthlyBudget(
  debts: Debt[],
  obligations: MonthlyObligation[],
  currency: string,
  month: string,
  variableBudget: number,
) {
  const debtPayments = debts
    .filter(
      (item) =>
        item.status === "ACTIVE" && item.monthlyPayment.currency === currency,
    )
    .reduce((sum, item) => sum + cents(item.monthlyPayment.amount), 0);
  const commitments = obligations
    .filter(
      (item) =>
        item.status !== "CANCELLED" &&
        item.amount.currency === currency &&
        item.dueDate.slice(0, 7) === month,
    )
    .reduce((sum, item) => sum + cents(item.amount.amount), 0);
  const variable = cents(variableBudget);
  return {
    debtPayments: debtPayments / 100,
    commitments: commitments / 100,
    variable: variable / 100,
    fixed: (debtPayments + commitments) / 100,
    total: (debtPayments + commitments + variable) / 100,
  };
}
