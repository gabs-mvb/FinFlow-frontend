"use client";

import { useState } from "react";
import { api } from "@/lib/finflow/api";
import type { Debt, MonthlyObligation } from "@/lib/finflow/types";
import { useResource, invalidateResources } from "@/hooks/use-resource";
import {
  calendarDate,
  currency,
  localDate,
  totalByCurrency,
} from "@/lib/display";
import { debtTypes, obligationTypes, labelFor, statuses } from "@/lib/labels";
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

type Commitment = Debt | MonthlyObligation;
const isDebt = (item: Commitment): item is Debt => "outstandingAmount" in item;

export function CommitmentsPage({ kind }: { kind: "debts" | "obligations" }) {
  const resource = useResource<Commitment[]>(`/${kind}`);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Commitment | null>(null);
  const [filter, setFilter] = useState("open");
  const [notice, setNotice] = useState("");
  const debts = kind === "debts";
  const items = resource.data ?? [];
  const open = items.filter(
    (item) => item.status === "ACTIVE" || item.status === "PENDING",
  );
  const filtered = filter === "open" ? open : items;
  const title = debts ? "Dívidas" : "Compromissos";
  const action = debts ? "Adicionar dívida" : "Adicionar compromisso";

  function saved(message: string) {
    setCreating(false);
    setPaying(null);
    setNotice(message);
    invalidateResources([`/${kind}`, "/plans"]);
  }

  return (
    <>
      <PageHeading
        title={title}
        description={
          debts
            ? "Acompanhe saldos devedores e o custo de cada dívida."
            : "Saiba o que vence a seguir e registre os pagamentos."
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Icon name="plus-lg" />
            {action}
          </Button>
        }
      />
      {notice && (
        <Alert tone="success">
          {notice} Gere um novo plano para considerar a mudança.
        </Alert>
      )}
      <section className="summary-strip">
        <div>
          <span>
            {debts ? "Saldo devedor em aberto" : "Compromissos em aberto"}
          </span>
          <strong>
            {resource.data
              ? totalByCurrency(
                  open.map((item) =>
                    isDebt(item) ? item.outstandingAmount : item.amount,
                  ),
                )
                  .map((value) => currency(value))
                  .join(" / ") || "Nenhum valor pendente"
              : "—"}
          </strong>
        </div>
        <div>
          <span>{debts ? "Dívidas ativas" : "Pagamentos pendentes"}</span>
          <strong>{resource.data ? open.length : "—"}</strong>
        </div>
        {!debts && (
          <div>
            <span>Vencidos</span>
            <strong className="expense">
              {
                open.filter(
                  (item) => !isDebt(item) && item.dueDate < localDate(),
                ).length
              }
            </strong>
          </div>
        )}
      </section>
      <div className="toolbar">
        <div className="segmented">
          <button
            aria-pressed={filter === "open"}
            onClick={() => setFilter("open")}
          >
            Em aberto
          </button>
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>
        </div>
        <Button
          variant="secondary"
          onClick={resource.refresh}
          disabled={resource.isValidating}
        >
          <Icon name="arrow-clockwise" />
          Atualizar
        </Button>
      </div>
      <section className="panel flush">
        <ResourceState resource={resource}>
          {filtered.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{debts ? "Dívida" : "Compromisso"}</th>
                    <th>{debts ? "Custo anual / parcela" : "Vencimento"}</th>
                    <th>Status</th>
                    <th className="numeric">
                      {debts ? "Saldo devedor" : "Valor"}
                    </th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>
                          {labelFor(
                            debts ? debtTypes : obligationTypes,
                            item.type,
                          )}
                        </small>
                        {isDebt(item) && item.priority === "HIGH_COST" && (
                          <span className="badge badge-warning">
                            Juros altos
                          </span>
                        )}
                      </td>
                      <td>
                        {isDebt(item) ? (
                          <>
                            {new Intl.NumberFormat("pt-BR", {
                              style: "percent",
                              maximumFractionDigits: 2,
                            }).format(item.annualEffectiveRate)}{" "}
                            a.a.
                            <small>{currency(item.monthlyPayment)} / mês</small>
                          </>
                        ) : (
                          <span
                            className={
                              item.status === "PENDING" &&
                              item.dueDate < localDate()
                                ? "expense"
                                : ""
                            }
                          >
                            {calendarDate(item.dueDate)}
                            {item.status === "PENDING" &&
                              item.dueDate < localDate() && (
                                <small>Vencido</small>
                              )}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${item.status === "PAID" ? "badge-success" : ""}`}
                        >
                          {statuses[item.status]}
                        </span>
                      </td>
                      <td className="numeric">
                        <strong>
                          {currency(
                            isDebt(item) ? item.outstandingAmount : item.amount,
                          )}
                        </strong>
                      </td>
                      <td>
                        {(item.status === "ACTIVE" ||
                          item.status === "PENDING") && (
                          <Button
                            variant="secondary"
                            onClick={() => setPaying(item)}
                          >
                            {debts
                              ? "Registrar quitação"
                              : "Registrar pagamento"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={debts ? "receipt" : "calendar2-check"}
              title={
                items.length
                  ? "Tudo em dia por aqui"
                  : debts
                    ? "Nenhuma dívida cadastrada"
                    : "Seu calendário começa aqui"
              }
              description={
                debts
                  ? "Cadastre dívidas para que o plano considere seus custos."
                  : "Adicione aluguel, faturas e outros compromissos para planejar o saldo."
              }
              action={
                <Button onClick={() => setCreating(true)}>{action}</Button>
              }
            />
          )}
        </ResourceState>
      </section>
      {creating && (
        <Modal title={action} onClose={() => setCreating(false)}>
          <SubmitForm
            submitLabel={action}
            onCancel={() => setCreating(false)}
            onSubmit={async (data) => {
              const common = {
                name: textInput(data, "name"),
                type: textInput(data, "type"),
              };
              await api.post(
                `/${kind}`,
                debts
                  ? {
                      ...common,
                      outstandingAmount: moneyInput(data),
                      monthlyPayment: moneyInput(data, "monthlyPayment"),
                      annualEffectiveRate: Number(data.get("rate")) / 100,
                      priority: textInput(data, "priority"),
                    }
                  : {
                      ...common,
                      amount: moneyInput(data),
                      dueDate: textInput(data, "dueDate"),
                    },
              );
              saved(debts ? "Dívida adicionada." : "Compromisso adicionado.");
            }}
          >
            <Field label="Nome">
              <input
                name="name"
                required
                maxLength={160}
                placeholder={
                  debts ? "Ex.: Financiamento do carro" : "Ex.: Aluguel"
                }
              />
            </Field>
            <div className="form-grid">
              <Field label="Tipo">
                <select name="type">
                  {Object.entries(debts ? debtTypes : obligationTypes).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <CurrencyField />
              <Field label={debts ? "Saldo devedor" : "Valor"}>
                <input
                  required
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                />
              </Field>
              {debts ? (
                <>
                  <Field label="Parcela mensal">
                    <input
                      required
                      type="number"
                      name="monthlyPayment"
                      min="0"
                      step="0.01"
                    />
                  </Field>
                  <Field label="Taxa efetiva anual (%)">
                    <input
                      required
                      type="number"
                      name="rate"
                      min="0"
                      step="0.01"
                    />
                  </Field>
                  <Field label="Prioridade">
                    <select name="priority">
                      <option value="REGULAR">Regular</option>
                      <option value="HIGH_COST">Juros altos</option>
                    </select>
                  </Field>
                </>
              ) : (
                <Field label="Vencimento">
                  <input
                    required
                    type="date"
                    name="dueDate"
                    defaultValue={localDate()}
                  />
                </Field>
              )}
            </div>
          </SubmitForm>
        </Modal>
      )}
      {paying && (
        <Modal
          title={debts ? "Registrar quitação" : "Registrar pagamento"}
          description={paying.name}
          onClose={() => setPaying(null)}
        >
          <SubmitForm
            submitLabel={debts ? "Confirmar quitação" : "Confirmar pagamento"}
            onCancel={() => setPaying(null)}
            onSubmit={async () => {
              await api.patch(`/${kind}/${paying.id}/paid`);
              saved(debts ? "Quitação registrada." : "Pagamento registrado.");
            }}
          >
            <p>
              Você já pagou{" "}
              <strong>
                {currency(
                  isDebt(paying) ? paying.outstandingAmount : paying.amount,
                )}
              </strong>
              ?
            </p>
            <Alert>
              Este registro{" "}
              {debts ? "zera o saldo devedor" : "marca o compromisso como pago"}
              . Nenhum dinheiro será movimentado e o saldo das contas precisa
              ser atualizado separadamente.
            </Alert>
          </SubmitForm>
        </Modal>
      )}
    </>
  );
}
