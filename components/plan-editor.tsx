"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Field, ResourceState } from "@/components/ui";
import { PlanDetailsView } from "@/components/plan-details";
import { invalidateResources, useResource } from "@/hooks/use-resource";
import { api, ApiError } from "@/lib/finflow/api";
import { planningError } from "@/lib/finflow/planning";
import { formatDate, formatMoney, label } from "@/lib/finflow/format";
import { categories } from "@/lib/labels";
import type {
  FinancialPlan,
  PlanContent,
  PlanRevision,
} from "@/lib/finflow/types";

const amounts = {
  emergencyReserveTarget: "Meta da reserva",
  remainingVariableBudget: "Orçamento variável",
  minimumCashBuffer: "Caixa mínimo",
  debtPaymentRecommendation: "Pagamento de dívidas",
  reserveContribution: "Aporte à reserva",
  investmentContribution: "Aporte a investimentos",
  dailySpendingLimit: "Limite diário",
} as const;
const assetClasses = [
  "CASH",
  "FIXED_INCOME",
  "BRAZILIAN_EQUITY",
  "INTERNATIONAL_EQUITY",
  "REAL_ESTATE_FUND",
  "ETF",
  "CRYPTO",
  "PENSION",
  "ALTERNATIVE",
];
const actionTypes = [
  "RESERVE_FOR_OBLIGATIONS",
  "REDUCE_VARIABLE_SPENDING",
  "PAY_HIGH_COST_DEBT",
  "TRANSFER_TO_EMERGENCY_RESERVE",
  "CREATE_INVESTMENT_CONTRIBUTION",
  "CUSTOM",
];

export function PlanEditor({
  plan,
  onClose,
  onSaved,
}: {
  plan: FinancialPlan;
  onClose: () => void;
  onSaved: (plan: FinancialPlan) => void;
}) {
  // Keep the exact revision and content being edited, even if the shared query refreshes.
  const [base] = useState(plan);
  const [draft, setDraft] = useState<PlanContent>(() =>
    structuredClone(plan.content!),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const current = useResource<FinancialPlan>(
    conflict ? `/plans/${base.id}` : null,
  );
  function update<K extends keyof PlanContent>(key: K, value: PlanContent[K]) {
    setDraft({ ...draft, [key]: value });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api.put<FinancialPlan>(`/plans/${base.id}/content`, {
        expectedRevision: base.revision,
        content: draft,
      });
      invalidateResources(["/plans"]);
      onSaved(saved);
    } catch (cause) {
      setError(planningError(cause));
      if (cause instanceof ApiError && cause.code === "PLAN_REVISION_CONFLICT")
        setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel stack" onSubmit={save}>
      <h2>Editar proposta · versão {base.revision}</h2>
      <p className="muted">
        Ajuste também as ações e alocações correspondentes aos valores. Ao
        salvar, todas as ações voltam a aguardar revisão e as aprovações
        anteriores são removidas. A edição não consulta a IA.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {conflict && (
        <ResourceState resource={current}>
          {current.data && (
            <details>
              <summary>Consultar versão atual</summary>
              <PlanDetailsView plan={current.data} />
              <p>
                Para editar esta versão, feche o rascunho e abra a edição
                novamente.
              </p>
            </details>
          )}
        </ResourceState>
      )}
      <fieldset disabled={busy} className="stack">
        <div className="form-grid">
          {(["asOf", "nextIncomeDate"] as const).map((key) => (
            <Field
              key={key}
              label={key === "asOf" ? "Data de referência" : "Próxima renda"}
            >
              <input
                type="date"
                required
                value={draft[key]}
                onChange={(e) => update(key, e.target.value)}
              />
            </Field>
          ))}
          {Object.entries(amounts).map(([name, title]) => {
            const key = name as keyof typeof amounts;
            return (
              <Field
                key={key}
                label={`${title} (${plan.operatingBalance.currency})`}
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={Number.isFinite(draft[key]) ? draft[key] : ""}
                  onChange={(e) => update(key, e.target.valueAsNumber)}
                />
              </Field>
            );
          })}
        </div>
        <Field label="Resumo">
          <textarea
            required
            maxLength={2000}
            value={draft.summary}
            onChange={(e) => update("summary", e.target.value)}
          />
        </Field>
        <Field label="Análise">
          <textarea
            required
            rows={6}
            maxLength={16000}
            value={draft.analysis}
            onChange={(e) => update("analysis", e.target.value)}
          />
        </Field>
        {(["categoryBudgets", "allocations", "actions"] as const).map((key) => (
          <section className="stack" key={key}>
            <h3>
              {
                {
                  categoryBudgets: "Orçamento por categoria",
                  allocations: "Alocações do aporte",
                  actions: "Ações",
                }[key]
              }
            </h3>
            {draft[key].map((item, index) => {
              const selection =
                "category" in item
                  ? "category"
                  : "assetClass" in item
                    ? "assetClass"
                    : "type";
              const options =
                selection === "category"
                  ? Object.keys(categories)
                  : selection === "assetClass"
                    ? assetClasses
                    : actionTypes;
              function change(patch: object) {
                setDraft({
                  ...draft,
                  [key]: draft[key].map((row, i) =>
                    i === index ? { ...row, ...patch } : row,
                  ),
                });
              }
              return (
                <div className="panel stack" key={index}>
                  <div className="form-grid">
                    <Field
                      label={
                        selection === "category"
                          ? "Categoria"
                          : selection === "assetClass"
                            ? "Classe"
                            : "Tipo de ação"
                      }
                    >
                      <select
                        value={
                          "category" in item
                            ? item.category
                            : "assetClass" in item
                              ? item.assetClass
                              : item.type
                        }
                        onChange={(e) =>
                          change({ [selection]: e.target.value })
                        }
                      >
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {label(option)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={`Valor (${plan.operatingBalance.currency})`}>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={Number.isFinite(item.amount) ? item.amount : ""}
                        onChange={(e) =>
                          change({ amount: e.target.valueAsNumber })
                        }
                      />
                    </Field>
                    {"riskLevel" in item && (
                      <Field label="Risco">
                        <select
                          value={item.riskLevel}
                          onChange={(e) =>
                            change({ riskLevel: e.target.value })
                          }
                        >
                          {["LOW", "MEDIUM", "HIGH"].map((risk) => (
                            <option key={risk} value={risk}>
                              {label(risk)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </div>
                  {"reason" in item && (
                    <Field label="Justificativa">
                      <textarea
                        required
                        maxLength={500}
                        value={item.reason}
                        onChange={(e) => change({ reason: e.target.value })}
                      />
                    </Field>
                  )}
                  {"rationale" in item && (
                    <Field label="Justificativa">
                      <textarea
                        required
                        maxLength={500}
                        value={item.rationale}
                        onChange={(e) => change({ rationale: e.target.value })}
                      />
                    </Field>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        [key]: draft[key].filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remover item {index + 1}
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              disabled={draft[key].length >= 20}
              onClick={() => {
                if (key === "categoryBudgets")
                  update(key, [
                    ...draft[key],
                    { category: "OTHER", amount: 0, reason: "" },
                  ]);
                else if (key === "allocations")
                  update(key, [
                    ...draft[key],
                    { assetClass: "CASH", amount: 0 },
                  ]);
                else
                  update(key, [
                    ...draft[key],
                    {
                      type: "CUSTOM",
                      amount: 0,
                      riskLevel: "LOW",
                      rationale: "",
                    },
                  ]);
              }}
            >
              Adicionar item
            </Button>
          </section>
        ))}
        <section className="stack">
          <h3>Avisos</h3>
          {draft.warnings.map((warning, index) => (
            <div className="row" key={index}>
              <Field label={`Aviso ${index + 1}`}>
                <textarea
                  required
                  maxLength={300}
                  value={warning}
                  onChange={(e) =>
                    update(
                      "warnings",
                      draft.warnings.map((value, i) =>
                        i === index ? e.target.value : value,
                      ),
                    )
                  }
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  update(
                    "warnings",
                    draft.warnings.filter((_, i) => i !== index),
                  )
                }
              >
                Remover aviso
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={draft.warnings.length >= 10}
            onClick={() => update("warnings", [...draft.warnings, ""])}
          >
            Adicionar aviso
          </Button>
        </section>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar sem salvar
          </Button>
          <Button type="submit" disabled={conflict}>
            {busy ? "Salvando…" : "Salvar e revisar ações"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function PlanHistory({ id }: { id: string }) {
  const resource = useResource<PlanRevision[]>(`/plans/${id}/revisions`);
  return (
    <section className="panel stack">
      <h2>Versões anteriores</h2>
      <ResourceState resource={resource}>
        {resource.data?.length === 0 && (
          <p className="muted">Este plano ainda não tem versões anteriores.</p>
        )}
        {resource.data?.map((entry) => (
          <details key={entry.revision}>
            <summary>
              Versão {entry.revision} · Arquivada em{" "}
              {formatDate(entry.capturedAt)}
            </summary>
            <div className="stack">
              <PlanDetailsView plan={entry.plan} />
              <p>
                Referência: {formatDate(entry.plan.asOf)} · Próxima renda:{" "}
                {formatDate(entry.plan.nextIncomeDate)}
              </p>
              <dl className="detail-list">
                {Object.entries(amounts).map(([key, title]) => (
                  <div className="detail-row" key={key}>
                    <dt>{title}</dt>
                    <dd>
                      {formatMoney(entry.plan[key as keyof typeof amounts])}
                    </dd>
                  </div>
                ))}
              </dl>
              {entry.plan.contributionAllocation.map((item) => (
                <p key={item.assetClass}>
                  {label(item.assetClass)}: {formatMoney(item.amount)} ·{" "}
                  {item.reason}
                </p>
              ))}
              {entry.plan.actions.map((action) => (
                <p key={action.id}>
                  {label(action.type)}: {formatMoney(action.amount)} ·{" "}
                  {action.rationale} · {label(action.status)}
                </p>
              ))}
              {entry.plan.warnings.map((warning, index) => (
                <Alert key={index} tone="info">
                  {warning}
                </Alert>
              ))}
            </div>
          </details>
        ))}
      </ResourceState>
    </section>
  );
}
