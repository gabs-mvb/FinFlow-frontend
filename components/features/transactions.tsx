"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "@/lib/finflow/api";
import type {
  FinancialAccount,
  FinancialTransaction,
  ImportTransactionsResponse,
  ImportTransactionItem,
} from "@/lib/finflow/types";
import { useResource, invalidateResources } from "@/hooks/use-resource";
import { calendarDate, currency, localDate, monthRange } from "@/lib/display";
import { categories, labelFor } from "@/lib/labels";
import { parseTransactions } from "@/lib/import-transactions";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Icon,
  Modal,
  PageHeading,
  ResourceState,
  SubmitForm,
  textInput,
} from "@/components/ui";

export function TransactionsPage() {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"manual" | "import" | null>(null);
  const [notice, setNotice] = useState("");
  const range = monthRange(month);
  const query = new URLSearchParams({
    ...range,
    ...(category ? { category } : {}),
  });
  const resource = useResource<FinancialTransaction[]>(
    `/transactions?${query}`,
  );
  const accounts = useResource<FinancialAccount[]>("/accounts");
  const [page, setPage] = useState(1);
  const filtered = (resource.data ?? []).filter((item) =>
    `${item.description} ${item.merchant ?? ""}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const pageSize = 25;
  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, maxPage);
  const displayed = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function imported(result: ImportTransactionsResponse) {
    setModal(null);
    setNotice(
      `${result.imported} transação(ões) importada(s); ${result.duplicates} duplicada(s) ignorada(s).${result.idempotentReplay ? " Este envio já havia sido processado." : ""} O saldo da conta não foi alterado.`,
    );
    invalidateResources(["/transactions", "/reports", "/plans"]);
  }

  return (
    <>
      <PageHeading
        title="Transações"
        description="Entradas e saídas, com o contexto que você precisa."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={!accounts.data?.length}
              onClick={() => setModal("import")}
            >
              <Icon name="upload" />
              Importar arquivo
            </Button>
            <Button
              disabled={!accounts.data?.length}
              onClick={() => setModal("manual")}
            >
              <Icon name="plus-lg" />
              Registrar transação
            </Button>
          </>
        }
      />
      {notice && <Alert tone="success">{notice}</Alert>}
      {accounts.error && (
        <Alert tone="error">
          {accounts.error.message}
          <Button variant="secondary" onClick={accounts.refresh}>
            Carregar contas novamente
          </Button>
        </Alert>
      )}
      {accounts.data?.length === 0 && (
        <Alert>
          Adicione uma conta antes de registrar transações.{" "}
          <Link href="/contas">Ir para contas</Link>
        </Alert>
      )}
      <div className="toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            aria-label="Buscar transações"
            placeholder="Buscar descrição ou estabelecimento"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <input
          aria-label="Mês das transações"
          type="month"
          value={month}
          min="2000-01"
          max="2100-12"
          onChange={(event) => {
            if (event.target.value) {
              setMonth(event.target.value);
              setPage(1);
            }
          }}
        />
        <select
          aria-label="Categoria"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as categorias</option>
          {Object.entries(categories).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          aria-label="Atualizar transações"
          disabled={resource.isValidating}
          onClick={resource.refresh}
        >
          <Icon name="arrow-clockwise" />
        </Button>
      </div>
      <section className="panel flush">
        <ResourceState resource={resource}>
          {displayed.length ? (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Conta</th>
                      <th>Data</th>
                      <th className="numeric">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="identity">
                            <span
                              className={`transaction-icon ${item.type === "CREDIT" ? "income" : ""}`}
                            >
                              <Icon
                                name={
                                  item.type === "CREDIT"
                                    ? "arrow-down-left"
                                    : "arrow-up-right"
                                }
                              />
                            </span>
                            <div>
                              <strong>{item.description}</strong>
                              {item.merchant && <small>{item.merchant}</small>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge">
                            {labelFor(categories, item.category)}
                          </span>
                        </td>
                        <td>
                          {accounts.data?.find(
                            (account) => account.id === item.accountId,
                          )?.name ?? "Conta"}
                        </td>
                        <td className="muted">
                          {calendarDate(item.occurredAt)}
                        </td>
                        <td
                          className={`numeric ${item.type === "CREDIT" ? "income" : ""}`}
                        >
                          <strong>
                            {item.type === "CREDIT" ? "+" : "−"}{" "}
                            {currency({
                              amount: Number(item.amount.amount),
                              currency: item.amount.currency ?? "BRL",
                            })}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="pagination">
                <span>{filtered.length} transações no período</span>
                <div className="row">
                  <Button
                    variant="ghost"
                    aria-label="Página anterior"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <Icon name="chevron-left" />
                  </Button>
                  <span>
                    {currentPage} de {maxPage}
                  </span>
                  <Button
                    variant="ghost"
                    aria-label="Próxima página"
                    disabled={currentPage === maxPage}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <Icon name="chevron-right" />
                  </Button>
                </div>
              </footer>
            </>
          ) : (
            <EmptyState
              icon="arrow-left-right"
              title="Nenhuma transação neste período"
              description="Escolha outro mês, ajuste os filtros ou importe as movimentações de uma conta."
            />
          )}
        </ResourceState>
      </section>
      <p className="footnote">
        O período segue o mês em UTC, como no relatório mensal. A data de cada
        transação é exibida no seu fuso.
      </p>
      {modal === "manual" && accounts.data && (
        <ManualTransaction
          accounts={accounts.data}
          onClose={() => setModal(null)}
          onImported={imported}
        />
      )}
      {modal === "import" && accounts.data && (
        <ImportDialog
          accounts={accounts.data}
          onClose={() => setModal(null)}
          onImported={imported}
        />
      )}
    </>
  );
}

function ManualTransaction({
  accounts,
  onClose,
  onImported,
}: {
  accounts: FinancialAccount[];
  onClose: () => void;
  onImported: (result: ImportTransactionsResponse) => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0].id);
  const request = useRef({
    externalId: crypto.randomUUID(),
    payload: "",
    key: crypto.randomUUID(),
  });
  const selected = accounts.find((account) => account.id === accountId)!;
  return (
    <Modal
      title="Registrar transação"
      description="Registre uma movimentação que já aconteceu na sua conta."
      onClose={onClose}
    >
      <SubmitForm
        onCancel={onClose}
        submitLabel="Registrar transação"
        onSubmit={async (data) => {
          const body = {
            accountId,
            transactions: [
              {
                externalId: request.current.externalId,
                type: textInput(data, "type"),
                amount: {
                  amount: Number(data.get("amount")),
                  currency: selected.availableBalance.currency,
                },
                description: textInput(data, "description"),
                ...(textInput(data, "merchant") && {
                  merchant: textInput(data, "merchant"),
                }),
                ...(textInput(data, "category") && {
                  category: textInput(data, "category"),
                }),
                occurredAt: new Date(
                  textInput(data, "occurredAt"),
                ).toISOString(),
              },
            ],
          };
          const serialized = JSON.stringify(body);
          if (request.current.payload !== serialized) {
            request.current.payload = serialized;
            request.current.key = crypto.randomUUID();
          }
          onImported(
            await api.post<ImportTransactionsResponse>(
              "/transactions/imports",
              body,
              { "Idempotency-Key": request.current.key },
            ),
          );
        }}
      >
        <Field label="Conta">
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.availableBalance.currency})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição">
          <input
            required
            name="description"
            maxLength={300}
            placeholder="Ex.: Compra no supermercado"
          />
        </Field>
        <div className="form-grid">
          <Field label="Movimentação">
            <select name="type">
              <option value="DEBIT">Saída</option>
              <option value="CREDIT">Entrada</option>
            </select>
          </Field>
          <Field label={`Valor (${selected.availableBalance.currency})`}>
            <input
              name="amount"
              required
              type="number"
              min="0.01"
              step="0.01"
            />
          </Field>
          <Field label="Categoria">
            <select name="category">
              <option value="">Identificar automaticamente</option>
              {Object.entries(categories).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data e hora">
            <input
              required
              type="datetime-local"
              name="occurredAt"
              defaultValue={`${localDate()}T12:00`}
            />
          </Field>
        </div>
        <Field label="Estabelecimento (opcional)">
          <input name="merchant" maxLength={180} />
        </Field>
        <Alert>
          O registro não altera o saldo da conta. Atualize o saldo na tela
          Contas quando necessário.
        </Alert>
      </SubmitForm>
    </Modal>
  );
}

function ImportDialog({
  accounts,
  onClose,
  onImported,
}: {
  accounts: FinancialAccount[];
  onClose: () => void;
  onImported: (result: ImportTransactionsResponse) => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0].id);
  const [batch, setBatch] = useState<{
    transactions: ImportTransactionItem[];
    key: string;
    filename: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const generation = useRef(0);
  const selected = accounts.find((account) => account.id === accountId)!;
  function downloadTemplate() {
    const blob = new Blob(
      [
        "externalId;type;amount;currency;description;merchant;category;occurredAt\n",
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "finflow-modelo.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Modal
      title="Importar transações"
      description="Selecione uma conta e revise o arquivo antes de importar."
      onClose={onClose}
    >
      <SubmitForm
        onCancel={onClose}
        submitLabel="Confirmar importação"
        onSubmit={async () => {
          if (reading || !batch)
            throw new Error("Selecione um arquivo válido antes de importar.");
          if (
            new TextEncoder().encode(
              JSON.stringify({ accountId, transactions: batch.transactions }),
            ).length > 1_000_000
          )
            throw new Error(
              "O envio ultrapassa 1 MB. Divida o arquivo em lotes menores.",
            );
          onImported(
            await api.post<ImportTransactionsResponse>(
              "/transactions/imports",
              { accountId, transactions: batch.transactions },
              { "Idempotency-Key": batch.key },
            ),
          );
        }}
      >
        <Field label="Conta de destino">
          <select
            value={accountId}
            onChange={(event) => {
              generation.current++;
              setAccountId(event.target.value);
              setBatch(null);
              setError("");
              setReading(false);
            }}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.availableBalance.currency})
              </option>
            ))}
          </select>
        </Field>
        <div className="import-dropzone">
          <Icon name="file-earmark-arrow-up" />
          <Field
            label="Arquivo CSV ou JSON"
            hint="Até 1.000 transações. Arquivo e envio limitados a 1 MB."
          >
            <input
              key={accountId}
              type="file"
              accept=".csv,.json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                const current = ++generation.current;
                setBatch(null);
                setError("");
                if (!file) return;
                if (file.size > 1_000_000) {
                  setError(
                    "O arquivo ultrapassa 1 MB. Divida a importação em arquivos menores.",
                  );
                  return;
                }
                setReading(true);
                try {
                  const transactions = parseTransactions(
                    await file.text(),
                    file.name,
                    selected.availableBalance.currency,
                  );
                  if (generation.current === current)
                    setBatch({
                      transactions,
                      key: crypto.randomUUID(),
                      filename: file.name,
                    });
                } catch (failure) {
                  if (generation.current === current)
                    setError((failure as Error).message);
                } finally {
                  if (generation.current === current) setReading(false);
                }
              }}
            />
          </Field>
          <Button type="button" variant="ghost" onClick={downloadTemplate}>
            <Icon name="download" />
            Baixar modelo CSV
          </Button>
        </div>
        {reading && <p role="status">Lendo arquivo…</p>}
        {error && <Alert tone="error">{error}</Alert>}
        {batch && (
          <div className="import-preview">
            <h3>{batch.transactions.length} transações para importar</h3>
            <p className="muted">{batch.filename}</p>
            {batch.transactions.slice(0, 5).map((item) => (
              <div className="detail-row" key={item.externalId}>
                <span>{item.description}</span>
                <strong>
                  {item.type === "CREDIT" ? "+" : "−"}{" "}
                  {currency({
                    amount: Number(item.amount.amount),
                    currency: item.amount.currency ?? "BRL",
                  })}
                </strong>
              </div>
            ))}
            {batch.transactions.length > 5 && (
              <small>
                Mais {batch.transactions.length - 5} transações no arquivo.
              </small>
            )}
          </div>
        )}
        <details>
          <summary>Como preparar o arquivo</summary>
          <p>
            Use CREDIT para entradas e DEBIT para saídas. O campo occurredAt
            exige data e fuso, como 2026-09-15T12:00:00-03:00. Use um externalId
            único por movimentação.
          </p>
          <p>
            No CSV, separe colunas por ponto e vírgula; amount recebe somente o
            número. category e merchant são opcionais. No JSON, use uma lista de
            transações com amount no formato{" "}
            {`{"amount": 25.5, "currency": "${selected.availableBalance.currency}"}`}
            .
          </p>
        </details>
        <Alert>
          Duplicatas são ignoradas. A importação não altera o saldo da conta.
        </Alert>
      </SubmitForm>
    </Modal>
  );
}
