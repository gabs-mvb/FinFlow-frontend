"use client";

import { useResource } from "./use-resource";
import { useSyncExternalStore } from "react";
import { useSession } from "@/components/auth/session-provider";
import {
  isPlanDeferred,
  subscribeOnboardingProgress,
} from "@/lib/onboarding-progress";
import type {
  FinancialAccount,
  FinancialPlan,
  OnboardingStatus,
} from "@/lib/finflow/types";

/** Backend completion confirms the mandatory profile; deferring a plan never bypasses it. */
export function useOnboarding(enabled = true) {
  const { session } = useSession();
  const userId = session?.authenticated ? session.user.id : undefined;
  const planDeferred = useSyncExternalStore(
    subscribeOnboardingProgress,
    () => isPlanDeferred(userId),
    () => false,
  );
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
    loading: status.isLoading || accounts.isLoading || plan.isLoading,
    error: status.error || accounts.error || plan.error,
    completed:
      !!accounts.data?.length &&
      status.data?.completed === true &&
      (!!plan.data || planDeferred),
    refresh() {
      status.refresh();
      accounts.refresh();
      plan.refresh();
    },
  };
}
