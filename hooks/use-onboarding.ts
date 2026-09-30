"use client";

import { useResource } from "./use-resource";
import { isDashboardReady } from "@/lib/onboarding-readiness";
import type {
  FinancialAccount,
  FinancialPlan,
  OnboardingStatus,
} from "@/lib/finflow/types";

/** Backend completion confirms the mandatory profile; deferring a plan never bypasses it. */
export function useOnboarding(enabled = true) {
  const status = useResource<OnboardingStatus>(enabled ? "/onboarding" : null);
  const accounts = useResource<FinancialAccount[]>(
    enabled ? "/accounts" : null,
  );
  const plan = useResource<FinancialPlan>(enabled ? "/plans/latest" : null);
  return {
    status,
    accounts,
    plan,
    hasProfile: status.data?.completed === true,
    loading: status.isLoading || accounts.isLoading,
    error: status.error || accounts.error,
    completed: isDashboardReady(status.data, !!accounts.data?.length),
    refresh() {
      status.refresh();
      accounts.refresh();
      plan.refresh();
    },
  };
}
