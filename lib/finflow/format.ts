import type { Money } from "./types";

const currencyFormats = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  value: Money | number | null | undefined,
  currency = "BRL",
): string {
  if (value == null) return "—";
  const amount = typeof value === "number" ? value : Number(value.amount);
  const code = typeof value === "number" ? currency : value.currency;
  if (!Number.isFinite(amount)) return "—";
  if (!currencyFormats.has(code))
    currencyFormats.set(
      code,
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: code }),
    );
  return currencyFormats.get(code)!.format(amount);
}

export function formatDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!value) return "—";
  // A LocalDate is a calendar date; interpreting it at UTC would shift the day in Brazil.
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value,
  );
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  });
}

export function formatPercent(value: number, digits = 1): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value)}%`;
}

export function money(amount: number | string, currency = "BRL"): Money {
  const parsed = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(parsed))
    throw new Error("Informe um valor monetário válido.");
  return {
    amount: Math.round((parsed + Number.EPSILON) * 100) / 100,
    currency,
  };
}

export const labels: Record<string, string> = {
  AI: "Plano com IA",
  MANUAL: "Plano editado por você",
  RULE_BASED: "Plano por regras",
  CUSTOM: "Orientação personalizada",
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  PAYMENT: "Conta de pagamento",
  INVESTMENT: "Investimento",
  OPERATING: "Dia a dia",
  EMERGENCY_RESERVE: "Reserva de emergência",
  GOAL: "Objetivo",
  CONSERVATIVE: "Conservador",
  MODERATE: "Moderado",
  BOLD: "Arrojado",
  AGGRESSIVE: "Agressivo",
  OBSERVER: "Observador",
  COPILOT: "Copiloto",
  AUTOPILOT: "Piloto automático",
  CREDIT: "Entrada",
  DEBIT: "Saída",
  INCOME: "Receitas",
  HOUSING: "Moradia",
  FOOD: "Alimentação",
  TRANSPORT: "Transporte",
  HEALTH: "Saúde",
  EDUCATION: "Educação",
  SUBSCRIPTIONS: "Assinaturas",
  DEBT_PAYMENT: "Pagamento de dívida",
  CREDIT_CARD: "Cartão de crédito",
  INVESTMENTS: "Investimentos",
  LEISURE: "Lazer",
  TAXES: "Impostos",
  TRANSFER: "Transferência",
  OTHER: "Outros",
  PROVIDER: "Provedor",
  RULE: "Regra automática",
  USER: "Manual",
  OVERDRAFT: "Cheque especial",
  PERSONAL_LOAN: "Empréstimo pessoal",
  VEHICLE_FINANCING: "Financiamento de veículo",
  MORTGAGE: "Financiamento imobiliário",
  HIGH_COST: "Alto custo",
  REGULAR: "Regular",
  ACTIVE: "Ativo",
  PAID: "Pago",
  RENEGOTIATED: "Renegociado",
  ACHIEVED: "Concluído",
  CANCELLED: "Cancelado",
  PENDING: "Pendente",
  VEHICLE: "Veículo",
  UTILITIES: "Serviços essenciais",
  TAX: "Imposto",
  SUBSCRIPTION: "Assinatura",
  CASH: "Caixa",
  FIXED_INCOME: "Renda fixa",
  BRAZILIAN_EQUITY: "Ações brasileiras",
  INTERNATIONAL_EQUITY: "Ações internacionais",
  REAL_ESTATE_FUND: "Fundos imobiliários",
  ETF: "ETFs",
  CRYPTO: "Criptoativos",
  PENSION: "Previdência",
  ALTERNATIVE: "Alternativos",
  AWAITING_AUTHORIZATION: "Aguardando autorização",
  EXPIRED: "Expirado",
  REVOKED: "Revogado",
  REJECTED: "Recusado",
  FAILED: "Falhou",
  ACCOUNTS: "Contas",
  BALANCES: "Saldos",
  TRANSACTIONS: "Transações",
  CREDIT_CARDS: "Cartões",
  CREDIT_OPERATIONS: "Operações de crédito",
  RESERVE_FOR_OBLIGATIONS: "Separar para compromissos",
  REDUCE_VARIABLE_SPENDING: "Ajustar gastos variáveis",
  PAY_HIGH_COST_DEBT: "Priorizar dívida cara",
  TRANSFER_TO_EMERGENCY_RESERVE: "Reforçar a reserva",
  CREATE_INVESTMENT_CONTRIBUTION: "Planejar aporte",
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  PROPOSED: "Aguardando decisão",
  APPROVED: "Aprovado",
};

export function label(value: string): string {
  return labels[value] ?? value;
}
