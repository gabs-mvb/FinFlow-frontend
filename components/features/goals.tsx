"use client";

import { useState } from "react";
import { api } from "@/lib/finflow/api";
import type { FinancialGoal } from "@/lib/finflow/types";
import { useResource, invalidateResources } from "@/hooks/use-resource";
import { calendarDate, currency } from "@/lib/display";
import { statuses } from "@/lib/labels";
import {
  Alert,
  Button,
  CurrencyField,
  EmptyState,
  Field,
  Icon,
  Modal,
  PageHeading,
  ResourceState,
  SubmitForm,
  moneyInput,
  textInput,
} from "@/components/ui";

export function GoalsPage({ onboarding = false }: { onboarding?: boolean }) {
  const resource = useResource<FinancialGoal[]>("/goals");
  const [editing, setEditing] = useState<FinancialGoal | "new" | null>(null);
  const [notice, setNotice] = useState("");
  function saved(message: string) {
    setEditing(null);
    setNotice(message);
    invalidateResources(["/goals"]);
  }
  return (
    <>
      <PageHeading
        embedded={onboarding}
        title="Metas"
        description="Dê um destino ao dinheiro que você guarda."
        actions={
          (!onboarding || !!resource.data?.length) && (
            <Button onClick={() => setEditing("new")}>
              <Icon name="plus-lg" />
              Criar meta
            </Button>
          )
        }
      />
      {notice && <Alert tone="success">{notice}</Alert>}
      <ResourceState resource={resource}>
        {resource.data?.length ? (
          <div className="goals-grid">
            {resource.data.map((goal) => {
              const progress = Math.min(
                100,
                (goal.currentAmount.amount / goal.targetAmount.amount) * 100,
              );
              return (
                <article className="panel goal-card" key={goal.id}>
                  <div className="panel-head">
                    <span className="entity-icon">
                      <Icon
                        name={
                          goal.status === "ACHIEVED"
                            ? "check2-circle"
                            : "bullseye"
                        }
                      />
                    </span>
                    <span
                      className={`badge ${goal.status === "ACHIEVED" ? "badge-success" : ""}`}
                    >
                      {statuses[goal.status]}
                    </span>
                  </div>
                  <h2>{goal.name}</h2>
                  <p className="muted">
                    {calendarDate(goal.targetDate)} • Prioridade {goal.priority}
                  </p>
                  <div className="goal-amount">
                    <strong>{currency(goal.currentAmount)}</strong>
                    <span>de {currency(goal.targetAmount)}</span>
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label={`Progresso de ${goal.name}`}
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="row">
                    <small className="muted">
                      {Math.round(progress)}% alcançado
                    </small>
                    <Button variant="ghost" onClick={() => setEditing(goal)}>
                      Atualizar progresso
                      <Icon name="arrow-right" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="panel">
            <EmptyState
              icon="bullseye"
              title="O que você quer realizar?"
              description="Crie uma meta com valor, prazo e prioridade para acompanhar seu progresso."
              action={
                <Button onClick={() => setEditing("new")}>
                  Criar primeira meta
                </Button>
              }
            />
          </section>
        )}
      </ResourceState>
      {editing === "new" && (
        <Modal title="Criar meta" onClose={() => setEditing(null)}>
          <SubmitForm
            onCancel={() => setEditing(null)}
            submitLabel="Criar meta"
            onSubmit={async (data) => {
              const target = moneyInput(data, "target");
              const current = moneyInput(data, "current");
              if (current.amount > target.amount)
                throw new Error(
                  "O valor guardado não pode superar o valor da meta.",
                );
              await api.post("/goals", {
                name: textInput(data, "name"),
                targetAmount: target,
                currentAmount: current,
                targetDate: textInput(data, "targetDate") || null,
                priority: Number(data.get("priority")),
              });
              saved("Meta criada.");
            }}
          >
            <Field label="Nome da meta">
              <input
                required
                name="name"
                maxLength={160}
                placeholder="Ex.: Minha próxima viagem"
              />
            </Field>
            <div className="form-grid">
              <Field label="Valor da meta">
                <input
                  required
                  name="target"
                  type="number"
                  min="0.01"
                  step="0.01"
                />
              </Field>
              <Field label="Quanto já está guardado">
                <input
                  required
                  name="current"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                />
              </Field>
              <CurrencyField />
              <Field label="Prazo (opcional)">
                <input name="targetDate" type="date" />
              </Field>
              <Field label="Prioridade">
                <select name="priority" defaultValue="3">
                  <option value="1">1 — Mais importante</option>
                  <option value="2">2 — Alta</option>
                  <option value="3">3 — Média</option>
                  <option value="4">4 — Baixa</option>
                  <option value="5">5 — Menos importante</option>
                </select>
              </Field>
            </div>
          </SubmitForm>
        </Modal>
      )}
      {editing && editing !== "new" && (
        <Modal
          title="Atualizar progresso"
          description={editing.name}
          onClose={() => setEditing(null)}
        >
          <SubmitForm
            onCancel={() => setEditing(null)}
            submitLabel="Atualizar progresso"
            onSubmit={async (data) => {
              await api.patch(`/goals/${editing.id}/progress`, {
                currentAmount: {
                  amount: Number(data.get("amount")),
                  currency: editing.targetAmount.currency,
                },
              });
              saved("Progresso atualizado.");
            }}
          >
            <Field
              label={`Total já guardado (${editing.targetAmount.currency})`}
              hint="Informe o total acumulado, incluindo o que já havia guardado."
            >
              <input
                required
                name="amount"
                type="number"
                min="0"
                max={editing.targetAmount.amount}
                step="0.01"
                defaultValue={editing.currentAmount.amount}
              />
            </Field>
            <p className="muted">
              Meta: {currency(editing.targetAmount)}. Atualizar o progresso não
              transfere valores entre contas.
            </p>
          </SubmitForm>
        </Modal>
      )}
    </>
  );
}
