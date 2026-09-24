const deferredInMemory = new Set<number>();
const progressEvent = "finflow:onboarding-progress";
const keyFor = (userId: number) =>
  `finflow:onboarding:v1:${userId}:plan-deferred`;

export function isPlanDeferred(userId?: number): boolean {
  if (userId === undefined) return false;
  try {
    return localStorage.getItem(keyFor(userId)) === "true";
  } catch {
    return deferredInMemory.has(userId);
  }
}

/** The API requires a profile to complete onboarding; deferral is a browser preference. */
export function deferPlan(userId: number): void {
  deferredInMemory.add(userId);
  try {
    localStorage.setItem(keyFor(userId), "true");
  } catch {
    // Browsers without storage can still defer for this session.
  }
  window.dispatchEvent(new Event(progressEvent));
}

export function subscribeOnboardingProgress(listener: () => void): () => void {
  window.addEventListener(progressEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(progressEvent, listener);
    window.removeEventListener("storage", listener);
  };
}
