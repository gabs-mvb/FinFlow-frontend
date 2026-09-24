"use client";

import { Alert, Button } from "@/components/ui";
import { formatMoney } from "@/lib/finflow/format";
import type { useMonthlyBudget } from "@/hooks/use-monthly-budget";

export function MonthlyBudgetSummary({
  budget,
  currency,
  asOf,
}: {
  budget: ReturnType<typeof useMonthlyBudget>;
  currency: string;
  asOf: string;
}) {
  if (budget.error)
    return (
      <Alert tone="error">
        Não foi possível atualizar os gastos. {budget.error.message}{" "}
        <Button type="button" variant="ghost" onClick={budget.refresh}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (budget.isLoading) return <p role="status">Somando seus gastos do mês…</p>;
  const month = new Date(`${asOf.slice(0, 7)}-01T12:00:00`).toLocaleDateString(
    "pt-BR",
    { month: "long", year: "numeric" },
  );
  return (
    <section
      className="onboarding-monthly-budget"
      aria-label="Gasto mensal previsto"
      aria-busy={budget.isValidating}
    >
      <header>
        <div>
          <h3>Gasto mensal previsto</h3>
          <p>
            {month} · {currency}
          </p>
        </div>
        <output>{formatMoney(budget.total, currency)}</output>
      </header>
      <dl>
        <div>
          <dt>Parcelas de dívidas ativas</dt>
          <dd>{formatMoney(budget.debtPayments, currency)}</dd>
        </div>
        <div>
          <dt>Compromissos do mês</dt>
          <dd>{formatMoney(budget.commitments, currency)}</dd>
        </div>
        <div>
          <dt>Lazer e outros gastos variáveis</dt>
          <dd>{formatMoney(budget.variable, currency)}</dd>
        </div>
      </dl>
      <p>
        Calculado com os cadastros salvos. Inclui compromissos pagos ou
        pendentes com vencimento neste mês; exclui cancelados e valores em
        outras moedas.
      </p>
    </section>
  );
}

export function ProfileSteps({ current }: { current: number }) {
  return (
    <ol
      className="onboarding-plan-steps"
      aria-label="Preenchimento do perfil financeiro"
    >
      {["Renda e limites", "Gastos do mês", "Reserva e preferências"].map(
        (title, index) => (
          <li key={title} aria-current={current === index ? "step" : undefined}>
            {index + 1}. {title}
          </li>
        ),
      )}
    </ol>
  );
}
