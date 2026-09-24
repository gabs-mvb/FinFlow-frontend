import { api } from "./finflow/api";
import { planningError } from "./finflow/planning";
import type {
  FinancialAccount,
  FinancialPlan,
  OnboardingStatus,
  UpsertFinancialProfileRequest,
} from "./finflow/types";

export function resumeStep(
  saved: string | null,
  hasAccount: boolean,
  hasProfile: boolean,
): number {
  if (!hasProfile) return 0;
  if (!hasAccount) return 1;
  const step = Number(saved);
  return saved !== null && Number.isInteger(step) && step >= 0 && step <= 6
    ? step
    : 2;
}

export function migrateOnboardingStep(saved: string | null): string | null {
  if (saved === null || !/^[0-6]$/.test(saved)) return null;
  return String([1, 2, 3, 4, 5, 0, 6][Number(saved)]);
}

/** The backend completion flag records a saved financial profile, before any account is required. */
export async function saveOnboardingProfile(
  profile: UpsertFinancialProfileRequest,
): Promise<void> {
  const status = await api.get<OnboardingStatus>("/onboarding");
  if (status.completed) await api.put("/profile", profile);
  else await api.post("/onboarding/complete", profile);
}

/** Re-read prerequisites so retries after partial success use the right profile endpoint. */
export async function createFirstPlan(
  profile: UpsertFinancialProfileRequest,
  asOf: string,
  preferences = "",
): Promise<FinancialPlan> {
  const [accounts, status] = await Promise.all([
    api.get<FinancialAccount[]>("/accounts"),
    api.get<OnboardingStatus>("/onboarding"),
  ]);
  if (!accounts.length)
    throw new Error("Adicione uma conta antes de criar seu plano.");
  if (status.completed) await api.put("/profile", profile);
  else await api.post("/onboarding/complete", profile);
  try {
    return await api.post<FinancialPlan>(
      preferences.trim()
        ? "/plans/personalized"
        : `/plans?asOf=${encodeURIComponent(asOf)}`,
      preferences.trim() ? { asOf, preferences } : undefined,
    );
  } catch (cause) {
    throw new Error(`Seu perfil foi salvo. ${planningError(cause)}`);
  }
}
