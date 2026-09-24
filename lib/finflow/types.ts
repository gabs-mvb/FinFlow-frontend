export type Money = { amount: number; currency: string };
export interface OnboardingStatus {
  completed: boolean;
}
export type MoneyInput = { amount: number | string; currency?: string };
export type MoneyOutput = Money;
export type AccountType = "CHECKING" | "SAVINGS" | "PAYMENT" | "INVESTMENT";
export type AccountPurpose =
  "OPERATING" | "EMERGENCY_RESERVE" | "GOAL" | "INVESTMENT";
export type RiskProfile = "CONSERVATIVE" | "MODERATE" | "BOLD" | "AGGRESSIVE";
export type AutopilotMode = "OBSERVER" | "COPILOT" | "AUTOPILOT";
export type TransactionType = "CREDIT" | "DEBIT";
export type TransactionCategory =
  | "INCOME"
  | "HOUSING"
  | "FOOD"
  | "TRANSPORT"
  | "HEALTH"
  | "EDUCATION"
  | "SUBSCRIPTIONS"
  | "DEBT_PAYMENT"
  | "CREDIT_CARD"
  | "INVESTMENTS"
  | "LEISURE"
  | "TAXES"
  | "TRANSFER"
  | "OTHER";
export type CategorizationSource = "PROVIDER" | "RULE" | "USER";
export type DebtType =
  | "CREDIT_CARD"
  | "OVERDRAFT"
  | "PERSONAL_LOAN"
  | "VEHICLE_FINANCING"
  | "MORTGAGE"
  | "OTHER";
export type DebtPriority = "HIGH_COST" | "REGULAR";
export type DebtStatus = "ACTIVE" | "PAID" | "RENEGOTIATED";
export type GoalStatus = "ACTIVE" | "ACHIEVED" | "CANCELLED";
export type ObligationType =
  | "CREDIT_CARD"
  | "VEHICLE"
  | "HOUSING"
  | "UTILITIES"
  | "TAX"
  | "SUBSCRIPTION"
  | "OTHER";
export type ObligationStatus = "PENDING" | "PAID" | "CANCELLED";
export type AssetClass =
  | "CASH"
  | "FIXED_INCOME"
  | "BRAZILIAN_EQUITY"
  | "INTERNATIONAL_EQUITY"
  | "REAL_ESTATE_FUND"
  | "ETF"
  | "CRYPTO"
  | "PENSION"
  | "ALTERNATIVE";
export type ConsentStatus =
  | "AWAITING_AUTHORIZATION"
  | "ACTIVE"
  | "EXPIRED"
  | "REVOKED"
  | "REJECTED"
  | "FAILED";
export type ConsentScope =
  | "ACCOUNTS"
  | "BALANCES"
  | "TRANSACTIONS"
  | "CREDIT_CARDS"
  | "CREDIT_OPERATIONS"
  | "INVESTMENTS";
export type ActionType =
  | "CUSTOM"
  | "RESERVE_FOR_OBLIGATIONS"
  | "REDUCE_VARIABLE_SPENDING"
  | "PAY_HIGH_COST_DEBT"
  | "TRANSFER_TO_EMERGENCY_RESERVE"
  | "CREATE_INVESTMENT_CONTRIBUTION";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ActionIntentStatus = "PROPOSED" | "APPROVED" | "REJECTED";

export interface CreateAccountRequest {
  institution: string;
  externalId: string;
  name: string;
  accountType: AccountType;
  purpose: AccountPurpose;
  availableBalance: MoneyInput;
  lastSyncedAt?: string | null;
}
export interface FinancialAccount extends Omit<
  CreateAccountRequest,
  "availableBalance" | "lastSyncedAt"
> {
  id: string;
  availableBalance: Money;
  lastSyncedAt: string | null;
}
export interface UpdateAccountBalanceRequest {
  availableBalance: MoneyInput;
  syncedAt?: string | null;
}

export interface UpsertFinancialProfileRequest {
  monthlyIncome: MoneyInput;
  payDay: number;
  essentialMonthlyExpenses: MoneyInput;
  variableMonthlyBudget: MoneyInput;
  minimumCashBuffer: MoneyInput;
  emergencyTargetMonths: number;
  reserveContributionRate: number;
  investmentContributionRate: number;
  riskProfile: RiskProfile;
  autopilotMode: AutopilotMode;
}
export interface FinancialProfile extends Omit<
  UpsertFinancialProfileRequest,
  | "monthlyIncome"
  | "essentialMonthlyExpenses"
  | "variableMonthlyBudget"
  | "minimumCashBuffer"
> {
  monthlyIncome: Money;
  essentialMonthlyExpenses: Money;
  variableMonthlyBudget: Money;
  minimumCashBuffer: Money;
  updatedAt: string;
}

export interface ImportTransactionItem {
  externalId: string;
  type: TransactionType;
  amount: MoneyInput;
  description: string;
  merchant?: string | null;
  category?: TransactionCategory | null;
  occurredAt: string;
}
export interface ImportTransactionsRequest {
  accountId: string;
  transactions: ImportTransactionItem[];
}
export interface ImportTransactionsResponse {
  imported: number;
  duplicates: number;
  idempotentReplay: boolean;
}
export interface FinancialTransaction extends Omit<
  ImportTransactionItem,
  "amount" | "merchant" | "category"
> {
  id: string;
  accountId: string;
  amount: Money;
  merchant: string | null;
  category: TransactionCategory;
  categorizationSource: CategorizationSource;
}

export interface CreateDebtRequest {
  name: string;
  type: DebtType;
  outstandingAmount: MoneyInput;
  monthlyPayment: MoneyInput;
  annualEffectiveRate: number;
  priority: DebtPriority;
}
export interface Debt extends Omit<
  CreateDebtRequest,
  "outstandingAmount" | "monthlyPayment"
> {
  id: string;
  outstandingAmount: Money;
  monthlyPayment: Money;
  status: DebtStatus;
}
export interface CreateGoalRequest {
  name: string;
  targetAmount: MoneyInput;
  currentAmount: MoneyInput;
  targetDate?: string | null;
  priority: number;
}
export interface FinancialGoal extends Omit<
  CreateGoalRequest,
  "targetAmount" | "currentAmount" | "targetDate"
> {
  id: string;
  targetAmount: Money;
  currentAmount: Money;
  targetDate: string | null;
  status: GoalStatus;
}
export interface UpdateGoalProgressRequest {
  currentAmount: MoneyInput;
}
export interface CreateObligationRequest {
  name: string;
  type: ObligationType;
  amount: MoneyInput;
  dueDate: string;
}
export interface MonthlyObligation extends Omit<
  CreateObligationRequest,
  "amount"
> {
  id: string;
  amount: Money;
  status: ObligationStatus;
}

export interface PortfolioPositionInput {
  assetCode: string;
  assetName: string;
  assetClass: AssetClass;
  currentValue: MoneyInput;
}
export interface PortfolioPosition extends Omit<
  PortfolioPositionInput,
  "currentValue"
> {
  currentValue: Money;
}
export interface ReplacePortfolioRequest {
  positions: PortfolioPositionInput[];
}
export interface Portfolio {
  positions: PortfolioPosition[];
}
export interface ContributionAllocation {
  assetClass: AssetClass;
  amount: Money;
  reason: string;
}

export interface RegisterConsentRequest {
  provider: string;
  externalConsentId: string;
  institution: string;
  scopes: ConsentScope[];
  status: ConsentStatus;
  expiresAt?: string | null;
}
export interface OpenFinanceConsent extends Omit<
  RegisterConsentRequest,
  "expiresAt"
> {
  id: string;
  expiresAt: string | null;
  updatedAt: string;
}
export interface OpenFinanceIntegrationStatus {
  configuredProvider: string;
  liveSynchronizationAvailable: boolean;
  mode: string;
  warning: string | null;
}

export interface ActionIntent {
  id: string;
  type: ActionType;
  amount: Money;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  status: ActionIntentStatus;
  rationale: string;
  executionAvailable: boolean;
}
export interface FinancialPlan {
  details?: PlanDetails;
  content?: PlanContent | null;
  revision?: number;
  updatedAt?: string | null;
  id: string;
  asOf: string;
  nextIncomeDate: string;
  totalConsolidatedBalance: Money;
  operatingBalance: Money;
  emergencyReserveBalance: Money;
  emergencyReserveTarget: Money;
  committedObligations: Money;
  remainingVariableBudget: Money;
  minimumCashBuffer: Money;
  debtPaymentRecommendation: Money;
  reserveContribution: Money;
  investmentContribution: Money;
  freeRealBalance: Money;
  projectedShortfall: Money;
  dailySpendingLimit: Money;
  contributionAllocation: ContributionAllocation[];
  actions: ActionIntent[];
  warnings: string[];
  generatedAt: string;
}
export interface CategoryBudget {
  category: TransactionCategory;
  amount: number;
  reason: string;
}
export interface PlanDetails {
  source: "AI" | "MANUAL" | "RULE_BASED";
  summary: string;
  analysis: string;
  categoryBudgets: CategoryBudget[];
  model?: string | null;
  promptVersion?: string | null;
}
export interface PlanContent {
  asOf: string;
  nextIncomeDate: string;
  summary: string;
  analysis: string;
  emergencyReserveTarget: number;
  remainingVariableBudget: number;
  minimumCashBuffer: number;
  debtPaymentRecommendation: number;
  reserveContribution: number;
  investmentContribution: number;
  dailySpendingLimit: number;
  categoryBudgets: CategoryBudget[];
  allocations: { assetClass: AssetClass; amount: number }[];
  actions: {
    type: ActionType;
    amount: number;
    riskLevel: RiskLevel;
    rationale: string;
  }[];
  warnings: string[];
}
export interface PlanRevision {
  revision: number;
  capturedAt: string;
  plan: FinancialPlan;
}
export interface CategoryExpense {
  category: TransactionCategory;
  amount: Money;
  percentageOfExpenses: number;
}
export interface MonthlyReport {
  period: string;
  totalIncome: Money;
  totalExpenses: Money;
  investmentContributions: Money;
  netCashFlow: Money;
  savingsRatePercentage: number;
  expensesByCategory: CategoryExpense[];
  priorities: string[];
  assumptions: string[];
}
export interface SessionStatus {
  authenticated: boolean;
  configured: boolean;
}
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  path?: string;
  errors?: Record<string, string>;
}

// The aliases mirror the DTO names in FinFlow-backend for contract comparisons.
export type FinancialAccountResponse = FinancialAccount;
export type FinancialProfileResponse = FinancialProfile;
export type FinancialTransactionResponse = FinancialTransaction;
export type FinancialPlanResponse = FinancialPlan;
export type ActionIntentResponse = ActionIntent;
export type DebtResponse = Debt;
export type Goal = FinancialGoal;
export type GoalResponse = FinancialGoal;
export type Obligation = MonthlyObligation;
export type ObligationResponse = MonthlyObligation;
export type PortfolioResponse = Portfolio;
export type PortfolioPositionResponse = PortfolioPosition;
export type ConsentResponse = OpenFinanceConsent;
export type MonthlyFinancialReport = MonthlyReport;
