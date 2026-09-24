"use client";

import Link from "next/link";
import { PlanDetailsView } from "@/components/plan-details";
import { useResource, invalidateResources } from "@/hooks/use-resource";
import type {
  FinancialAccount,
  FinancialGoal,
  FinancialPlan,
  MonthlyObligation,
  MonthlyReport,
} from "@/lib/finflow/types";
import {
  currency,
  calendarDate,
  localDate,
  totalByCurrency,
} from "@/lib/display";
import {
  Alert,
  Button,
  EmptyState,
  Icon,
  PageHeading,
  ResourceState,
  Stat,
} from "@/components/ui";

export function OverviewPage() {
  const accounts = useResource<FinancialAccount[]>("/accounts");
  const plan = useResource<FinancialPlan | null>("/plans/latest");
  const obligations = useResource<MonthlyObligation[]>("/obligations");
  const goals = useResource<FinancialGoal[]>("/goals");
  const now = new Date();
  const report = useResource<MonthlyReport>(
    `/reports/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
  );
  const pending = (obligations.data ?? [])
    .filter((item) => item.status === "PENDING")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const current = plan.data;
  const reserve = current?.emergencyReserveTarget.amount
    ? Math.min(
        100,
        (current.emergencyReserveBalance.amount /
          current.emergencyReserveTarget.amount) *
          100,
      )
    : 0;
  const monthly = report.data;
  const cashFlowTotal =
    (monthly?.totalIncome.amount ?? 0) +
    (monthly?.totalExpenses.amount ?? 0) +
    (monthly?.investmentContributions.amount ?? 0);
  const refreshing = [accounts, plan, obligations, goals, report].some(
    (resource) => resource.isValidating,
  );

  return (
    <>
      <PageHeading
        title="Visão geral"
        description={new Intl.DateTimeFormat("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(now)}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={refreshing}
              onClick={() =>
                invalidateResources([
                  "/accounts",
                  "/plans",
                  "/obligations",
                  "/goals",
                  "/reports",
                ])
              }
            >
              <Icon
                name="arrow-clockwise"
                className={refreshing ? "spin" : ""}
              />
              Atualizar
            </Button>
            <Link className="button button-primary" href="/transacoes">
              <Icon name="plus-lg" />
              Registrar transação
            </Link>
          </>
        }
      />
      {accounts.data?.length === 0 && (
        <div className="setup-banner">
          <span className="entity-icon">
            <Icon name="flag" />
          </span>
          <div>
            <strong>Vamos organizar seu ponto de partida</strong>
            <p>
              Configure o perfil e cadastre suas contas. A partir deles, o
              FinFlow calcula o seu plano.
            </p>
          </div>
          <Link href="/perfil" className="button button-secondary">
            Configurar perfil
            <Icon name="arrow-right" />
          </Link>
        </div>
      )}
      <ResourceState resource={plan}>
        {current ? (
          <section className="balance-surface">
            <div className="balance-main">
              <div className="balance-caption">
                <span>Seu saldo livre real</span>
                <Icon name="arrow-up-right" />
              </div>
              <strong className="balance-value">
                {currency(current.freeRealBalance)}
              </strong>
              <p>
                Disponível após orçamento, compromissos e aportes previstos.
              </p>
              <div className="balance-bottom">
                <span>
                  <Icon name="calendar3" />
                  Até {calendarDate(current.nextIncomeDate)}
                </span>
                <Link href="/plano">
                  Entender meu plano
                  <Icon name="arrow-right" />
                </Link>
              </div>
            </div>
            <div className="balance-side">
              <Stat
                label="Para gastar por dia"
                value={currency(current.dailySpendingLimit)}
                detail="Dentro do saldo livre previsto"
              />
              <div className="balance-side-divider" />
              <Stat
                label="Compromissos do plano"
                value={currency(current.committedObligations)}
                detail="Até o próximo recebimento"
              />
            </div>
          </section>
        ) : (
          <section className="balance-surface balance-no-plan">
            <div className="balance-main">
              <span>Seu próximo passo</span>
              <h2>
                Transforme seus números
                <br />
                em um plano.
              </h2>
              <p>
                Descubra quanto está livre para gastar, guardar e investir até o
                próximo recebimento.
              </p>
              <Link href="/plano" className="button button-light">
                Gerar primeiro plano
                <Icon name="arrow-right" />
              </Link>
            </div>
            <div className="plan-illustration" aria-hidden="true">
              <div>
                <span />
                <span />
                <span />
              </div>
              <Icon name="signpost-split" />
            </div>
          </section>
        )}
      </ResourceState>
      {current && (
        <section className="panel page-section">
          <PlanDetailsView plan={current} compact />
        </section>
      )}
      {current && (
        <div className="snapshot-note">
          <Icon name="clock-history" />
          <span>
            Plano de {calendarDate(current.asOf)}. Alterou algum valor?{" "}
            <Link href="/plano">Revise ou gere um novo plano.</Link>
          </span>
        </div>
      )}
      {!!current?.projectedShortfall.amount && (
        <Alert tone="error">
          O plano identifica uma falta de {currency(current.projectedShortfall)}{" "}
          até o próximo recebimento.{" "}
          <Link href="/plano">Revisar recomendações</Link>
        </Alert>
      )}
      <div className="overview-grid">
        <section className="panel flow-panel">
          <div className="panel-head">
            <div>
              <h2>O movimento do mês</h2>
              <p>
                {new Intl.DateTimeFormat("pt-BR", {
                  month: "long",
                  year: "numeric",
                }).format(now)}
              </p>
            </div>
            <Link className="text-link" href="/relatorios">
              Ver relatório
              <Icon name="arrow-up-right" />
            </Link>
          </div>
          {report.error ? (
            <div className="inline-empty">
              <Icon name="bar-chart-line" />
              <p>{report.error.message}</p>
              <Link className="text-link" href="/perfil">
                Revisar perfil financeiro
                <Icon name="arrow-right" />
              </Link>
            </div>
          ) : (
            <ResourceState resource={report}>
              <div className="flow-total">
                <span>Resultado do mês</span>
                <strong
                  className={
                    monthly && monthly.netCashFlow.amount < 0 ? "expense" : ""
                  }
                >
                  {currency(monthly?.netCashFlow)}
                </strong>
              </div>
              <div
                className="cashflow-bar"
                aria-label="Proporção entre entradas, despesas e aportes"
              >
                <span
                  className="cashflow-income"
                  style={{ flex: monthly?.totalIncome.amount || 0 }}
                />
                <span
                  className="cashflow-expense"
                  style={{ flex: monthly?.totalExpenses.amount || 0 }}
                />
                <span
                  className="cashflow-investment"
                  style={{ flex: monthly?.investmentContributions.amount || 0 }}
                />
                {!cashFlowTotal && <span className="cashflow-empty" />}
              </div>
              <div className="flow-legend">
                <div>
                  <span>
                    <i className="legend-dot cashflow-income" />
                    Entradas
                  </span>
                  <strong>{currency(monthly?.totalIncome)}</strong>
                </div>
                <div>
                  <span>
                    <i className="legend-dot cashflow-expense" />
                    Despesas
                  </span>
                  <strong>{currency(monthly?.totalExpenses)}</strong>
                </div>
                <div>
                  <span>
                    <i className="legend-dot cashflow-investment" />
                    Aportes
                  </span>
                  <strong>{currency(monthly?.investmentContributions)}</strong>
                </div>
              </div>
              <p className="footnote">
                Transferências entre contas ficam fora deste cálculo.
              </p>
            </ResourceState>
          )}
        </section>
        <section className="panel reserve-panel">
          <div className="panel-head">
            <h2>Sua reserva</h2>
            <Icon name="shield-check" />
          </div>
          {current ? (
            <>
              <div className="reserve-content">
                <div
                  className="reserve-gauge"
                  style={{ "--progress": `${reserve}%` } as React.CSSProperties}
                >
                  <span>
                    <strong>
                      {Math.round(reserve)}
                      <small>%</small>
                    </strong>
                    <small>da meta</small>
                  </span>
                </div>
                <div>
                  <strong>{currency(current.emergencyReserveBalance)}</strong>
                  <p>de {currency(current.emergencyReserveTarget)}</p>
                </div>
              </div>
              <p className="footnote">
                A meta considera seus gastos essenciais e o período de proteção
                escolhido.
              </p>
              <Link href="/perfil" className="text-link">
                Ajustar minha proteção
                <Icon name="arrow-right" />
              </Link>
            </>
          ) : (
            <div className="inline-empty">
              <Icon name="shield-check" />
              <p>Seu primeiro plano mostra quanto guardar para imprevistos.</p>
              <Link href="/perfil" className="text-link">
                Definir proteção
                <Icon name="arrow-right" />
              </Link>
            </div>
          )}
        </section>
        <section className="panel commitments-panel">
          <div className="panel-head">
            <div>
              <h2>Próximos compromissos</h2>
              <p>
                {pending.length}{" "}
                {pending.length === 1
                  ? "pagamento em aberto"
                  : "pagamentos em aberto"}
              </p>
            </div>
            <Link className="text-link" href="/compromissos">
              Ver todos
              <Icon name="arrow-up-right" />
            </Link>
          </div>
          <ResourceState resource={obligations}>
            {pending.length ? (
              <div className="upcoming-list">
                {pending.slice(0, 4).map((item) => (
                  <div className="upcoming-item" key={item.id}>
                    <div
                      className={`date-tile ${item.dueDate < localDate() ? "overdue" : ""}`}
                    >
                      <strong>{item.dueDate.slice(8)}</strong>
                      <small>
                        {new Intl.DateTimeFormat("pt-BR", { month: "short" })
                          .format(new Date(`${item.dueDate}T12:00:00`))
                          .replace(".", "")}
                      </small>
                    </div>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {item.dueDate < localDate()
                          ? "Vencido"
                          : calendarDate(item.dueDate)}
                      </small>
                    </div>
                    <strong className="numeric">{currency(item.amount)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="calendar2-check"
                title="Nenhum compromisso em aberto"
                description="Mantenha os próximos pagamentos registrados para um plano mais preciso."
                action={
                  <Link className="text-link" href="/compromissos">
                    Adicionar compromisso
                    <Icon name="arrow-right" />
                  </Link>
                }
              />
            )}
          </ResourceState>
        </section>
        <section className="panel accounts-panel">
          <div className="panel-head">
            <h2>Suas contas</h2>
            <Link className="text-link" href="/contas">
              Gerenciar
              <Icon name="arrow-up-right" />
            </Link>
          </div>
          <ResourceState resource={accounts}>
            {accounts.data?.length ? (
              <>
                <div className="account-mini-list">
                  {accounts.data.slice(0, 3).map((account) => (
                    <div className="account-mini" key={account.id}>
                      <span className="bank-monogram">
                        {account.institution.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <strong>{account.name}</strong>
                        <small>{account.institution}</small>
                      </div>
                      <strong>{currency(account.availableBalance)}</strong>
                    </div>
                  ))}
                </div>
                <div className="accounts-subtotal">
                  <span>Total nas contas</span>
                  <div>
                    {totalByCurrency(
                      accounts.data.map((account) => account.availableBalance),
                    ).map((total) => (
                      <strong key={total.currency}>{currency(total)}</strong>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                icon="wallet2"
                title="Adicione sua primeira conta"
                description="Separe o dinheiro do dia a dia, da reserva e das metas."
                action={
                  <Link className="text-link" href="/contas">
                    Adicionar conta
                    <Icon name="arrow-right" />
                  </Link>
                }
              />
            )}
          </ResourceState>
        </section>
      </div>
      <section className="panel goals-overview">
        <div className="panel-head">
          <div>
            <h2>Cada meta, mais perto</h2>
            <p>Acompanhe o que você está construindo.</p>
          </div>
          <Link className="text-link" href="/metas">
            Ver metas
            <Icon name="arrow-up-right" />
          </Link>
        </div>
        <ResourceState resource={goals}>
          {goals.data?.length ? (
            <div className="goal-preview-grid">
              {goals.data.slice(0, 3).map((goal) => (
                <div className="goal-preview" key={goal.id}>
                  <div className="row">
                    <strong>{goal.name}</strong>
                    <Icon
                      name={
                        goal.status === "ACHIEVED" ? "check-circle" : "bullseye"
                      }
                    />
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(100, (goal.currentAmount.amount / goal.targetAmount.amount) * 100)}%`,
                      }}
                    />
                  </div>
                  <span>
                    <strong>{currency(goal.currentAmount)}</strong>
                    <small> de {currency(goal.targetAmount)}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="goal-invitation">
              <Icon name="bullseye" />
              <p>
                Uma viagem, um projeto, uma conquista. Dê um nome à sua próxima
                meta.
              </p>
              <Link className="button button-secondary" href="/metas">
                Criar meta
              </Link>
            </div>
          )}
        </ResourceState>
      </section>
    </>
  );
}
