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
  CurrencyAmountInput,
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

export function CommitmentsPage({
  kind,
  onboarding = false,
  initialCurrency = "BRL",
  initialDueDate,
  compact = false,
}: {
  kind: "debts" | "obligations";
  onboarding?: boolean;
  initialCurrency?: string;
  initialDueDate?: string;
  compact?: boolean;
}) {
  const resource = useResource<Commitment[]>(`/${kind}`);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Commitment | null>(null);
  const [filter, setFilter] = useState("open");
  const [notice, setNotice] = useState("");
  const [newCurrency, setNewCurrency] = useState(initialCurrency);
  const [recurring, setRecurring] = useState(false);
  const debts = kind === "debts";
  const items = resource.data ?? [];
  const open = items.filter(
    (item) => item.status === "ACTIVE" || item.status === "PENDING",
  );
  const filtered = compact
    ? items.filter((item) =>
        isDebt(item) ? item.status === "ACTIVE" : item.status !== "CANCELLED",
      )
    : filter === "open"
      ? open
      : items;
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
        embedded={onboarding}
        title={title}
        description={
          debts
            ? "Acompanhe saldos devedores e o custo de cada dívida."
            : "Saiba o que vence a seguir e registre os pagamentos."
        }
        actions={
          (!onboarding || items.length > 0) && (
            <Button onClick={() => setCreating(true)}>
              <Icon name="plus-lg" />
              {action}
            </Button>
          )
        }
      />
      {notice && (
        <Alert tone="success">
          {notice}{" "}
          {onboarding
            ? "Cadastro salvo. Ele já aparece nas outras etapas, sem precisar cadastrar novamente."
            : "Gere um novo plano para considerar a mudança."}
        </Alert>
      )}
      {!compact && (!onboarding || items.length > 0) && (
        <>
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
        </>
      )}
      <section className="panel flush">
        <ResourceState resource={resource}>
          {compact && filtered.length ? (
            <ul className="onboarding-expense-items">
              {filtered.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {isDebt(item)
                        ? `Saldo devedor: ${currency(item.outstandingAmount)}`
                        : `${item.recurring ? `Todo mês, dia ${item.dueDay} • Próximo: ` : "Vencimento: "}${calendarDate(item.dueDate)}${item.status === "PAID" ? " • Pago" : ""}`}
                    </small>
                  </div>
                  <div>
                    <strong>
                      {currency(
                        isDebt(item) ? item.monthlyPayment : item.amount,
                      )}
                    </strong>
                    <small>
                      {isDebt(item) ? "Parcela mensal" : "Compromisso"}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : filtered.length ? (
            <div className="table-wrap">
              <table className="data-table" role="table">
                <thead>
                  <tr role="row">
                    <th role="columnheader">{debts ? "Dívida" : "Compromisso"}</th>
                    <th role="columnheader">{debts ? "Custo anual / parcela" : "Vencimento"}</th>
                    <th role="columnheader">Status</th>
                    <th role="columnheader" className="numeric">
                      {debts ? "Saldo devedor" : "Valor"}
                    </th>
                    <th role="columnheader">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr role="row" key={item.id}>
                      <td role="cell" data-label="Registro">
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
                        {!isDebt(item) && item.recurring && (
                          <span className="badge">Recorrente</span>
                        )}
                      </td>
                      <td role="cell" data-label="Vencimento / parcela">
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
                            {item.recurring && <small>Todo mês, dia {item.dueDay}</small>}
                            {item.status === "PENDING" &&
                              item.dueDate < localDate() && (
                                <small>Vencido</small>
                              )}
                          </span>
                        )}
                      </td>
                      <td role="cell" data-label="Status">
                        <span
                          className={`badge ${item.status === "PAID" ? "badge-success" : ""}`}
                        >
                          {statuses[item.status]}
                        </span>
                      </td>
                      <td role="cell" data-label="Valor" className="numeric">
                        <strong>
                          {currency(
                            isDebt(item) ? item.outstandingAmount : item.amount,
                          )}
                        </strong>
                      </td>
                      <td role="cell" data-label="Ações">
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
                      recurring,
                      ...(recurring
                        ? { dueDay: Number(data.get("dueDay")) }
                        : { dueDate: textInput(data, "dueDate") }),
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
              <CurrencyField value={newCurrency} onChange={setNewCurrency} />
              <Field label={debts ? "Saldo devedor" : "Valor"}>
                <CurrencyAmountInput
                  required
                  name="amount"
                  currency={newCurrency}
                  min="0.01"
                />
              </Field>
              {debts ? (
                <>
                  <Field label="Parcela mensal">
                    <CurrencyAmountInput
                      required
                      name="monthlyPayment"
                      currency={newCurrency}
                      min="0"
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
                <>
                  <Field label="Frequência">
                    <select
                      value={recurring ? "monthly" : "once"}
                      onChange={(event) =>
                        setRecurring(event.target.value === "monthly")
                      }
                    >
                      <option value="once">Vencimento único</option>
                      <option value="monthly">Repete todo mês</option>
                    </select>
                  </Field>
                  {recurring ? (
                    <Field
                      label="Dia do vencimento"
                      hint="Nos meses mais curtos, vence no último dia."
                    >
                      <input
                        required
                        type="number"
                        name="dueDay"
                        min="1"
                        max="31"
                        defaultValue={Number(
                          (initialDueDate ?? localDate()).slice(8),
                        )}
                      />
                    </Field>
                  ) : (
                    <Field label="Vencimento">
                      <input required type="date" name="dueDate" defaultValue={initialDueDate ?? localDate()} />
                    </Field>
                  )}
                </>
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
              {debts ? "zera o saldo devedor" : isDebt(paying) || !paying.recurring ? "marca o compromisso como pago" : "avança o próximo vencimento para o mês seguinte"}
              . Nenhum dinheiro será movimentado e o saldo das contas precisa
              ser atualizado separadamente.
            </Alert>
          </SubmitForm>
        </Modal>
      )}
    </>
  );
}
