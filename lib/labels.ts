export const accountTypes = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  PAYMENT: "Conta de pagamento",
  INVESTMENT: "Investimentos",
};
export const purposes = {
  OPERATING: "Dia a dia",
  EMERGENCY_RESERVE: "Reserva de emergência",
  GOAL: "Meta financeira",
  INVESTMENT: "Investimentos",
};
export const categories = {
  INCOME: "Receita",
  HOUSING: "Moradia",
  FOOD: "Alimentação",
  TRANSPORT: "Transporte",
  HEALTH: "Saúde",
  EDUCATION: "Educação",
  SUBSCRIPTIONS: "Assinaturas",
  LEISURE: "Lazer",
  TAXES: "Impostos",
  DEBT_PAYMENT: "Pagamento de dívida",
  CREDIT_CARD: "Cartão de crédito",
  INVESTMENTS: "Investimentos",
  TRANSFER: "Transferência",
  OTHER: "Outros",
};
export const obligationTypes = {
  CREDIT_CARD: "Cartão de crédito",
  VEHICLE: "Veículo",
  HOUSING: "Moradia",
  UTILITIES: "Serviços essenciais",
  TAX: "Imposto",
  SUBSCRIPTION: "Assinatura",
  OTHER: "Outro",
};
export const debtTypes = {
  CREDIT_CARD: "Cartão de crédito",
  OVERDRAFT: "Cheque especial",
  PERSONAL_LOAN: "Empréstimo pessoal",
  VEHICLE_FINANCING: "Financiamento de veículo",
  MORTGAGE: "Financiamento imobiliário",
  OTHER: "Outra",
};
export const statuses: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  CANCELLED: "Cancelado",
  ACTIVE: "Em andamento",
  ACHIEVED: "Concluída",
  RENEGOTIATED: "Renegociada",
  PROPOSED: "Aguardando revisão",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
};

export function labelFor(labels: Record<string, string>, value: string) {
  return labels[value] ?? value;
}
