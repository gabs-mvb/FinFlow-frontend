"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Icon,
  PageHeading,
  ResourceState,
  Stat,
} from "@/components/ui";
import { invalidateResources, useResource } from "@/hooks/use-resource";
import { api } from "@/lib/finflow/api";
import { formatDate, formatMoney, label } from "@/lib/finflow/format";
import type { ActionIntent, FinancialPlan } from "@/lib/finflow/types";

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function PlanPage() {
  const resource = useResource<FinancialPlan>("/plans/latest");
  const [asOf, setAsOf] = useState(today);
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const plan = resource.data;

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      await api.post<FinancialPlan>(`/plans?asOf=${encodeURIComponent(asOf)}`);
      invalidateResources(["/plans"]);
      setMessage(
        "Plano atualizado com seus dados financeiros. Revise as recomendações abaixo.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar o plano. Tente novamente.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function review(action: ActionIntent, approve: boolean) {
    setReviewing(action.id);
    setError(null);
    setMessage(null);
    try {
      await api.patch(
        `/plans/actions/${action.id}/${approve ? "approve" : "reject"}`,
      );
      invalidateResources(["/plans"]);
      setMessage(
        approve
          ? "Intenção aprovada. Nenhum valor foi movimentado."
          : "Intenção recusada. Sua decisão foi registrada.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar sua decisão. Tente novamente.",
      );
    } finally {
      setReviewing(null);
    }
  }

  return (
    <>
      <PageHeading
        title="Seu próximo passo"
        description="Um plano para atravessar o mês e avançar nas suas prioridades."
      />
      <form onSubmit={generate} className="panel inline-form page-section">
        <Field label="Data de referência">
          <input
            type="date"
            aria-label="Data de referência"
            required
            value={asOf}
            onChange={(event) => setAsOf(event.target.value)}
          />
        </Field>
        <Button type="submit" disabled={generating || reviewing !== null}>
          <Icon name={generating ? "hourglass-split" : "arrow-repeat"} />
          {generating
            ? "Calculando plano…"
            : plan
              ? "Gerar novo plano"
              : "Gerar meu plano"}
        </Button>
        <p className="muted">
          O cálculo considera contas, gastos, compromissos e seu{" "}
          <Link href="/perfil">perfil financeiro</Link>.
        </p>
      </form>
      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}
      <ResourceState resource={resource}>
        {plan ? (
          <div className="stack">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Até o próximo recebimento</h2>
                  <p className="muted">
                    Referência: {formatDate(plan.asOf)}. Próxima renda:{" "}
                    {formatDate(plan.nextIncomeDate)}.
                  </p>
                </div>
                <span className="badge">Plano calculado</span>
              </div>
              <div className="metric-grid">
                <Stat
                  label="Saldo livre real"
                  value={formatMoney(plan.freeRealBalance)}
                  detail="Após os compromissos e aportes do plano"
                />
                <Stat
                  label="Limite diário sugerido"
                  value={formatMoney(plan.dailySpendingLimit)}
                  detail="Até a próxima renda"
                />
                <Stat
                  label="Déficit projetado"
                  value={formatMoney(plan.projectedShortfall)}
                  detail={
                    plan.projectedShortfall.amount > 0
                      ? "Valor que precisa ser coberto"
                      : "Sem déficit no cálculo atual"
                  }
                />
              </div>
            </section>

            {plan.warnings.length > 0 && (
              <Alert tone="info">
                <strong>Antes de decidir</strong>
                <ul>
                  {plan.warnings.map((warning, index) => (
                    <li key={`${index}-${warning}`}>{warning}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <div className="split-grid">
              <section className="panel">
                <div className="panel-head">
                  <h2>Como o saldo foi distribuído</h2>
                  <Icon name="diagram-3" />
                </div>
                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>Saldo das contas do dia a dia</dt>
                    <dd>{formatMoney(plan.operatingBalance)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Compromissos até a próxima renda</dt>
                    <dd>{formatMoney(plan.committedObligations)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Orçamento variável restante</dt>
                    <dd>{formatMoney(plan.remainingVariableBudget)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Saldo mínimo protegido</dt>
                    <dd>{formatMoney(plan.minimumCashBuffer)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Pagamento sugerido de dívidas</dt>
                    <dd>{formatMoney(plan.debtPaymentRecommendation)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Aporte sugerido para reserva</dt>
                    <dd>{formatMoney(plan.reserveContribution)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Aporte sugerido para investimentos</dt>
                    <dd>{formatMoney(plan.investmentContribution)}</dd>
                  </div>
                </dl>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Sua reserva de emergência</h2>
                  <Icon name="shield-check" />
                </div>
                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>Valor disponível</dt>
                    <dd>{formatMoney(plan.emergencyReserveBalance)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Meta da reserva</dt>
                    <dd>{formatMoney(plan.emergencyReserveTarget)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Total consolidado em contas</dt>
                    <dd>{formatMoney(plan.totalConsolidatedBalance)}</dd>
                  </div>
                </dl>
                <p className="muted section-description">
                  O saldo consolidado inclui contas com outras finalidades. O
                  dinheiro disponível para o mês parte apenas das contas do dia
                  a dia.
                </p>
                <p className="muted">
                  Os saldos de contas e a meta de reserva refletem a consulta
                  atual. As recomendações foram calculadas em{" "}
                  {formatDate(plan.generatedAt)}.
                </p>
              </section>
            </div>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Recomendações para revisar</h2>
                  <p className="muted">
                    Aprovar registra sua intenção. Você continua responsável por
                    realizar pagamentos e transferências.
                  </p>
                </div>
                <span className="badge">
                  {
                    plan.actions.filter(
                      (action) => action.status === "PROPOSED",
                    ).length
                  }{" "}
                  para revisar
                </span>
              </div>
              {plan.actions.length === 0 ? (
                <EmptyState
                  icon="check2-circle"
                  title="Nenhuma ação sugerida"
                  description="Com os dados deste plano, não há movimentações a revisar."
                />
              ) : (
                <div className="action-list">
                  {plan.actions.map((action) => (
                    <article key={action.id} className="action-item">
                      <div className="stack">
                        <div className="row">
                          <h3>{label(action.type)}</h3>
                          <span className="badge">{label(action.status)}</span>
                        </div>
                        <p className="muted">{action.rationale}</p>
                        <span className="muted">
                          Risco {label(action.riskLevel).toLowerCase()}
                          {!action.requiresApproval
                            ? " · Recomendação registrada automaticamente"
                            : ""}
                        </span>
                      </div>
                      <div className="stack">
                        <strong>{formatMoney(action.amount)}</strong>
                        {action.status === "PROPOSED" && (
                          <div className="row">
                            <Button
                              variant="secondary"
                              disabled={reviewing !== null || generating}
                              onClick={() => void review(action, false)}
                            >
                              Recusar
                            </Button>
                            <Button
                              disabled={reviewing !== null || generating}
                              onClick={() => void review(action, true)}
                            >
                              {reviewing === action.id
                                ? "Registrando…"
                                : "Aprovar intenção"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {plan.contributionAllocation.length > 0 && (
              <section className="panel">
                <div className="panel-head">
                  <h2>Destino sugerido do aporte</h2>
                  <Link href="/carteira">Ver carteira</Link>
                </div>
                <div className="allocation-list">
                  {plan.contributionAllocation.map((allocation) => (
                    <div className="allocation-row" key={allocation.assetClass}>
                      <div>
                        <h3>{label(allocation.assetClass)}</h3>
                        <p className="muted">{allocation.reason}</p>
                      </div>
                      <strong>{formatMoney(allocation.amount)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <EmptyState
            icon="signpost-split"
            title="Seu plano começa com seus dados"
            description="Configure o perfil, cadastre suas contas e gere o primeiro plano para conhecer seu saldo livre e suas prioridades."
            action={
              <Link className="button button-secondary" href="/perfil">
                Configurar perfil
              </Link>
            }
          />
        )}
      </ResourceState>
    </>
  );
}
