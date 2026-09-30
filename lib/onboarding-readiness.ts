import type { OnboardingStatus } from "./finflow/types";

/** A first plan is optional; readiness must work across web and Android sessions. */
export function isDashboardReady(status: OnboardingStatus | undefined, hasAccount: boolean) {
  return hasAccount && (status?.readyForDashboard ?? status?.completed === true);
}
