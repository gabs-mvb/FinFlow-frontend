"use client";

import { Field } from "@/components/ui";
import { formatDate, formatMoney, label } from "@/lib/finflow/format";
import type { FinancialPlan } from "@/lib/finflow/types";

export function PlanPreferences({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Field
      label="Preferências para a IA (opcional)"
      hint="Ao preencher, você solicita uma análise com IA. Este texto será enviado à OpenAI; evite nomes, documentos e outros identificadores pessoais. Até 2.000 caracteres."
    >
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={2000}
        disabled={disabled}
        rows={3}
        placeholder="Quero priorizar a reserva sem cortar educação."
      />
    </Field>
  );
}

export function PlanDetailsView({
  plan,
  compact = false,
}: {
  plan: FinancialPlan;
  compact?: boolean;
}) {
  const summary = plan.content?.summary || plan.details?.summary;
  const analysis = plan.content?.analysis || plan.details?.analysis;
  const categories =
    plan.content?.categoryBudgets ?? plan.details?.categoryBudgets ?? [];
  return (
    <div className="stack">
      <div className="row">
        <span className="badge">
          {label(plan.details?.source ?? "RULE_BASED")}
        </span>
        {plan.revision !== undefined && (
          <span className="muted">Versão {plan.revision}</span>
        )}
      </div>
      {summary && <p style={{ whiteSpace: "pre-wrap" }}>{summary}</p>}
      {!compact && (
        <>
          {analysis && (
            <div>
              <h3>Por que este plano</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{analysis}</p>
            </div>
          )}
          {categories.length > 0 && (
            <div>
              <h3>Orçamento por categoria</h3>
              <div className="allocation-list">
                {categories.map((item) => (
                  <div className="allocation-row" key={item.category}>
                    <div>
                      <h3>{label(item.category)}</h3>
                      <p className="muted">{item.reason}</p>
                    </div>
                    <strong>
                      {formatMoney(item.amount, plan.operatingBalance.currency)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="muted">
            Gerado em {formatDate(plan.generatedAt)}
            {plan.updatedAt
              ? ` · Editado em ${formatDate(plan.updatedAt)}`
              : ""}
            . Aprovar uma recomendação registra sua decisão e não movimenta
            dinheiro.
          </p>
        </>
      )}
    </div>
  );
}
