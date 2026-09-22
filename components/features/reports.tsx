"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Button,
  EmptyState,
  Field,
  Icon,
  PageHeading,
  ResourceState,
  Stat,
} from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import {
  formatDate,
  formatMoney,
  formatPercent,
  label,
} from "@/lib/finflow/format";
import type { MonthlyReport } from "@/lib/finflow/types";

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(period: string, amount: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function translateCategories(text: string) {
  return text.replace(/\b[A-Z][A-Z_]+\b/g, (value) => label(value));
}

export function ReportsPage() {
  const [period, setPeriod] = useState(currentMonth);
  const [year, month] = period.split("-").map(Number);
  const resource = useResource<MonthlyReport>(
    `/reports/monthly?year=${year}&month=${month}`,
  );
  const report = resource.data;

  return (
    <>
      <PageHeading
        title="O mês em perspectiva"
        description="Veja o que entrou, o que saiu e onde seus gastos se concentraram."
      />
      <div className="panel inline-form page-section">
        <Button
          variant="ghost"
          aria-label="Mês anterior"
          disabled={period === "2000-01"}
          onClick={() => setPeriod(shiftMonth(period, -1))}
        >
          <Icon name="chevron-left" />
        </Button>
        <Field label="Mês do relatório">
          <input
            type="month"
            aria-label="Mês do relatório"
            required
            min="2000-01"
            max="2100-12"
            value={period}
            onChange={(event) => {
              const value = event.target.value;
              if (
                /^\d{4}-\d{2}$/.test(value) &&
                value >= "2000-01" &&
                value <= "2100-12"
              )
                setPeriod(value);
            }}
          />
        </Field>
        <Button
          variant="ghost"
          aria-label="Próximo mês"
          disabled={period === "2100-12"}
          onClick={() => setPeriod(shiftMonth(period, 1))}
        >
          <Icon name="chevron-right" />
        </Button>
        <Button
          variant="secondary"
          disabled={resource.isValidating}
          onClick={resource.refresh}
        >
          <Icon name="arrow-repeat" />
          {resource.isValidating ? "Atualizando…" : "Atualizar relatório"}
        </Button>
      </div>
      <ResourceState resource={resource}>
        {report && (
          <div className="stack">
            <div className="metric-grid">
              <Stat
                label="Entradas"
                value={formatMoney(report.totalIncome)}
                detail="Sem transferências entre contas"
              />
              <Stat
                label="Despesas"
                value={formatMoney(report.totalExpenses)}
                detail="Gastos de consumo do período"
              />
              <Stat
                label="Aportes"
                value={formatMoney(report.investmentContributions)}
                detail="Separados das despesas"
              />
              <Stat
                label="Fluxo de caixa líquido"
                value={formatMoney(report.netCashFlow)}
                detail="Entradas menos despesas e aportes"
              />
            </div>
            <div className="split-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Para onde foi seu dinheiro</h2>
                    <p className="muted">
                      Participação nas despesas de{" "}
                      {formatDate(`${report.period}-01`, {
                        month: "long",
                        day: undefined,
                      })}
                      .
                    </p>
                  </div>
                  <Icon name="bar-chart-line" />
                </div>
                {report.expensesByCategory.length === 0 ? (
                  <EmptyState
                    icon="receipt"
                    title="Nenhuma despesa neste mês"
                    description="As despesas registradas na moeda do perfil aparecerão aqui, agrupadas por categoria."
                  />
                ) : (
                  <div className="category-bars">
                    {report.expensesByCategory.map((expense) => (
                      <div className="category-bar" key={expense.category}>
                        <div className="row">
                          <strong>{label(expense.category)}</strong>
                          <span>{formatMoney(expense.amount)}</span>
                        </div>
                        <div
                          className="progress-track"
                          role="img"
                          aria-label={`${label(expense.category)}: ${formatPercent(expense.percentageOfExpenses, 2)} das despesas`}
                        >
                          <div
                            className="progress-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, expense.percentageOfExpenses))}%`,
                            }}
                          />
                        </div>
                        <span className="muted">
                          {formatPercent(expense.percentageOfExpenses, 2)} das
                          despesas
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <div className="stack">
                <section className="panel">
                  <div className="panel-head">
                    <h2>Quanto ficou da renda</h2>
                    <Icon name="piggy-bank" />
                  </div>
                  <Stat
                    label="Taxa de poupança"
                    value={formatPercent(report.savingsRatePercentage, 2)}
                    detail="Parcela da renda após as despesas, incluindo o valor destinado a aportes."
                  />
                  {report.totalIncome.amount === 0 && (
                    <p className="muted section-description">
                      Não há entradas registradas neste mês. A taxa retornada
                      para o período é zero.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Prioridades do período</h2>
                    <Icon name="list-check" />
                  </div>
                  <ul className="report-priorities">
                    {report.priorities.map((priority, index) => (
                      <li key={`${index}-${priority}`}>
                        {translateCategories(priority)}
                      </li>
                    ))}
                  </ul>
                  <Link className="button button-secondary" href="/plano">
                    Revisar meu plano
                  </Link>
                </section>
              </div>
            </div>
            <section className="panel">
              <div className="panel-head">
                <h2>Como este relatório é calculado</h2>
                <Icon name="info-circle" />
              </div>
              <ul className="report-assumptions">
                {report.assumptions.map((assumption, index) => (
                  <li key={`${index}-${assumption}`}>{assumption}</li>
                ))}
              </ul>
              <p className="muted">
                O período considera as datas das transações em UTC. Revise o{" "}
                <Link href="/perfil">perfil financeiro</Link> para conferir a
                moeda utilizada.
              </p>
            </section>
          </div>
        )}
      </ResourceState>
    </>
  );
}
