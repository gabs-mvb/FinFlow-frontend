import { ApiError } from "./api";

export function planningError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.code === "PLAN_REVISION_CONFLICT")
      return "Este plano foi editado em outra sessão. Seu rascunho foi mantido. Consulte a versão atual antes de refazer suas alterações.";
    if (cause.code === "PLANNING_DATA_CHANGED")
      return "Seus dados financeiros mudaram durante a análise. Revise os dados e solicite um novo plano.";
    if (cause.status === 503)
      return "A análise com IA está indisponível ou não pôde ser concluída. Nenhum plano parcial foi salvo. Tente novamente mais tarde.";
    if (cause.status === 504)
      return "O tempo de espera terminou. Consulte o plano mais recente antes de tentar gerar novamente.";
    const fields = Object.values(cause.fieldErrors);
    return [cause.message, ...fields].join(" ");
  }
  return cause instanceof Error
    ? cause.message
    : "Não foi possível concluir a operação. Tente novamente.";
}
