"use client";

import { useState } from "react";
import { api } from "@/lib/finflow/api";
import type { FinancialAccount } from "@/lib/finflow/types";
import { useResource, invalidateResources } from "@/hooks/use-resource";
import { currency, calendarDate, totalByCurrency } from "@/lib/display";
import { accountTypes, purposes, labelFor } from "@/lib/labels";
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

export function AccountsPage() {
  const resource = useResource<FinancialAccount[]>("/accounts");
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState("");
  const [editing, setEditing] = useState<FinancialAccount | "new" | null>(null);
  const [message, setMessage] = useState("");
  const accounts = resource.data ?? [];
  const filtered = accounts.filter(
    (account) =>
      `${account.name} ${account.institution}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")) &&
      (!purpose || account.purpose === purpose),
  );
  function saved(message: string) {
    setEditing(null);
    setMessage(message);
    invalidateResources(["/accounts", "/plans"]);
  }

  return (
    <>
      <PageHeading
        title="Contas"
        description="Seu dinheiro, organizado por finalidade."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Icon name="plus-lg" />
            Adicionar conta
          </Button>
        }
      />
      {message && (
        <Alert tone="success">
          {message} Gere um novo plano para recalcular os valores disponíveis.
        </Alert>
      )}
      <div className="account-summary">
        <div>
          <span>Saldo nas suas contas</span>
          <div className="currency-totals">
            {resource.data ? (
              totalByCurrency(
                accounts.map((account) => account.availableBalance),
              ).map((value) => (
                <strong key={value.currency}>{currency(value)}</strong>
              ))
            ) : (
              <strong>—</strong>
            )}
            {resource.data && !accounts.length && <strong>Sem contas</strong>}
          </div>
          <small>
            {accounts.length}{" "}
            {accounts.length === 1 ? "conta cadastrada" : "contas cadastradas"}
            {new Set(accounts.map((a) => a.availableBalance.currency)).size >
              1 && " • Saldos separados por moeda"}
          </small>
        </div>
        <Icon name="wallet2" />
      </div>
      <div className="toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            aria-label="Buscar conta ou instituição"
            placeholder="Buscar conta ou instituição"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar finalidade"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
        >
          <option value="">Todas as finalidades</option>
          {Object.entries(purposes).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          aria-label="Atualizar contas"
          disabled={resource.isValidating}
          onClick={resource.refresh}
        >
          <Icon name="arrow-clockwise" />
        </Button>
      </div>
      <section className="panel flush">
        <ResourceState resource={resource}>
          {filtered.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Conta</th>
                    <th>Finalidade</th>
                    <th>Última atualização</th>
                    <th className="numeric">Saldo disponível</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div className="identity">
                          <span className="entity-icon">
                            <Icon
                              name={
                                account.purpose === "EMERGENCY_RESERVE"
                                  ? "shield-check"
                                  : "bank"
                              }
                            />
                          </span>
                          <div>
                            <strong>{account.name}</strong>
                            <small>
                              {account.institution} •{" "}
                              {labelFor(accountTypes, account.accountType)}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge">
                          {labelFor(purposes, account.purpose)}
                        </span>
                      </td>
                      <td className="muted">
                        {account.lastSyncedAt
                          ? calendarDate(account.lastSyncedAt)
                          : "Não informada"}
                      </td>
                      <td className="numeric">
                        <strong>{currency(account.availableBalance)}</strong>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          aria-label={`Atualizar saldo de ${account.name}`}
                          onClick={() => setEditing(account)}
                        >
                          <Icon name="pencil" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="wallet2"
              title={
                accounts.length
                  ? "Nenhuma conta encontrada"
                  : "Onde você guarda seu dinheiro?"
              }
              description={
                accounts.length
                  ? "Ajuste a busca ou a finalidade."
                  : "Adicione sua primeira conta para começar a organizar os saldos."
              }
              action={
                !accounts.length && (
                  <Button onClick={() => setEditing("new")}>
                    Adicionar conta
                  </Button>
                )
              }
            />
          )}
        </ResourceState>
      </section>
      {editing === "new" && (
        <Modal
          title="Adicionar conta"
          description="Informe o saldo atual e escolha a finalidade desta conta."
          onClose={() => setEditing(null)}
        >
          <SubmitForm
            onCancel={() => setEditing(null)}
            submitLabel="Adicionar conta"
            onSubmit={async (data) => {
              await api.post("/accounts", {
                institution: textInput(data, "institution"),
                externalId:
                  textInput(data, "externalId") || crypto.randomUUID(),
                name: textInput(data, "name"),
                accountType: textInput(data, "accountType"),
                purpose: textInput(data, "purpose"),
                availableBalance: moneyInput(data),
                lastSyncedAt: new Date().toISOString(),
              });
              saved("Conta adicionada.");
            }}
          >
            <div className="form-grid">
              <Field label="Nome da conta">
                <input
                  required
                  name="name"
                  maxLength={120}
                  placeholder="Ex.: Conta principal"
                />
              </Field>
              <Field label="Instituição">
                <input
                  required
                  name="institution"
                  maxLength={120}
                  placeholder="Nome do banco ou instituição"
                />
              </Field>
              <Field label="Tipo de conta">
                <select name="accountType">
                  {Object.entries(accountTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Finalidade">
                <select name="purpose">
                  {Object.entries(purposes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Saldo disponível">
                <input
                  name="amount"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                />
              </Field>
              <CurrencyField />
            </div>
            <details>
              <summary>Identificador de importação (opcional)</summary>
              <Field
                label="Identificador da conta"
                hint="Use o identificador da instituição se pretende importar dados dessa conta. Caso contrário, criaremos um identificador."
              >
                <input name="externalId" maxLength={160} />
              </Field>
            </details>
          </SubmitForm>
        </Modal>
      )}
      {editing && editing !== "new" && (
        <Modal
          title="Atualizar saldo"
          description={`${editing.name} — ${editing.institution}`}
          onClose={() => setEditing(null)}
        >
          <SubmitForm
            onCancel={() => setEditing(null)}
            submitLabel="Atualizar saldo"
            onSubmit={async (data) => {
              await api.patch(`/accounts/${editing.id}/balance`, {
                availableBalance: {
                  amount: Number(data.get("amount")),
                  currency: editing.availableBalance.currency,
                },
                syncedAt: new Date().toISOString(),
              });
              saved("Saldo atualizado.");
            }}
          >
            <Field label={`Saldo atual (${editing.availableBalance.currency})`}>
              <input
                required
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={editing.availableBalance.amount}
              />
            </Field>
            <p className="muted">
              Informe o saldo total atual. Este valor substitui o saldo anterior
              e não cria uma transação.
            </p>
          </SubmitForm>
        </Modal>
      )}
    </>
  );
}
