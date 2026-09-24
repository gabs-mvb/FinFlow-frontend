"use client";

import { useResource } from "./use-resource";
import { monthlyBudget } from "@/lib/monthly-budget";
import type { Debt, MonthlyObligation } from "@/lib/finflow/types";

export function useMonthlyBudget(
  currency: string,
  asOf: string,
  variableBudget: number,
) {
  const debts = useResource<Debt[]>("/debts");
  const obligations = useResource<MonthlyObligation[]>("/obligations");
  return {
    ...monthlyBudget(
      debts.data ?? [],
      obligations.data ?? [],
      currency,
      asOf.slice(0, 7),
      variableBudget,
    ),
    isLoading: debts.isLoading || obligations.isLoading,
    isValidating: debts.isValidating || obligations.isValidating,
    error: debts.error || obligations.error,
    refresh() {
      debts.refresh();
      obligations.refresh();
    },
  };
}
