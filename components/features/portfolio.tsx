"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Icon,
  Modal,
  PageHeading,
  ResourceState,
  Stat,
} from "@/components/ui";
import { invalidateResources, useResource } from "@/hooks/use-resource";
import { api } from "@/lib/finflow/api";
import { formatMoney, formatPercent, label } from "@/lib/finflow/format";
import type {
  AssetClass,
  Portfolio,
  ReplacePortfolioRequest,
} from "@/lib/finflow/types";

const assetClasses: AssetClass[] = [
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

type PositionDraft = {
  key: string;
  assetCode: string;
  assetName: string;
  assetClass: AssetClass;
  amount: string;
};

export function PortfolioPage({
  onboarding = false,
  onEditingChange,
}: {
  onboarding?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const resource = useResource<Portfolio>("/portfolio");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    onEditingChange?.(editing);
    return () => onEditingChange?.(false);
  }, [editing, onEditingChange]);
  const [saved, setSaved] = useState(false);
  const portfolio = resource.data;
  const total =
    portfolio?.positions.reduce(
      (sum, position) => sum + position.currentValue.amount,
      0,
    ) ?? 0;
  const currency = portfolio?.positions[0]?.currentValue.currency ?? "BRL";

  return (
    <>
      <PageHeading
        embedded={onboarding}
        title="Sua carteira"
        description="Acompanhe os ativos e o valor atual dos seus investimentos."
        actions={
          portfolio && !editing ? (
            <Button
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              <Icon name="pencil" />
              Editar carteira
            </Button>
          ) : undefined
        }
      />
      {saved && (
        <Alert tone="success">
          Carteira salva.{" "}
          {onboarding
            ? "Seus investimentos serão considerados na análise do plano."
            : "Gere um novo plano para atualizar as sugestões de aporte."}
        </Alert>
      )}
      <ResourceState resource={resource}>
        {portfolio &&
          (editing ? (
            <PortfolioEditor
              portfolio={portfolio}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                setSaved(true);
              }}
            />
          ) : portfolio.positions.length === 0 ? (
            <EmptyState
              icon="pie-chart"
              title="Cadastre seus investimentos"
              description="Informe os ativos que você já possui e o valor atual de cada um."
              action={
                <Button onClick={() => setEditing(true)}>
                  Configurar carteira
                </Button>
              }
            />
          ) : (
            <div className="stack">
              <div className="metric-grid">
                <Stat
                  label="Valor da carteira"
                  value={formatMoney(total, currency)}
                  detail="Valores informados por você"
                />
                <Stat
                  label="Ativos cadastrados"
                  value={portfolio.positions.length}
                  detail="Posições na carteira"
                />
              </div>
              <section className="panel">
                <div className="panel-head">
                  <h2>Posições atuais</h2>
                  <span className="badge">{currency}</span>
                </div>
                {portfolio.positions.length === 0 ? (
                  <EmptyState
                    title="Nenhuma posição cadastrada"
                    description="Adicione os ativos que você já possui."
                  />
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Ativo</th>
                          <th scope="col">Classe</th>
                          <th scope="col">Valor atual</th>
                          <th scope="col">Na carteira</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.positions.map((position) => (
                          <tr key={position.assetCode}>
                            <td>
                              <strong>{position.assetCode}</strong>
                              <small className="muted">
                                {position.assetName}
                              </small>
                            </td>
                            <td>{label(position.assetClass)}</td>
                            <td>{formatMoney(position.currentValue)}</td>
                            <td>
                              {total > 0
                                ? formatPercent(
                                    (position.currentValue.amount / total) *
                                      100,
                                  )
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              
            </div>
          ))}
      </ResourceState>
    </>
  );
}

function PortfolioEditor({
  portfolio,
  onCancel,
  onSaved,
}: {
  portfolio: Portfolio;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [positions, setPositions] = useState<PositionDraft[]>(() =>
    portfolio.positions.map((position, index) => ({
      key: `position-${index}`,
      assetCode: position.assetCode,
      assetName: position.assetName,
      assetClass: position.assetClass,
      amount: String(position.currentValue.amount),
    })),
  );
  const [currency, setCurrency] = useState(
    portfolio.positions[0]?.currentValue.currency ?? "BRL",
  );
  const [review, setReview] = useState<ReplacePortfolioRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removedCodes = review
    ? portfolio.positions
        .filter(
          (position) =>
            !review.positions.some(
              (replacement) => replacement.assetCode === position.assetCode,
            ),
        )
        .map((position) => position.assetCode)
    : [];

  function updatePosition(key: string, values: Partial<PositionDraft>) {
    setPositions((current) =>
      current.map((position) =>
        position.key === key ? { ...position, ...values } : position,
      ),
    );
  }

  function prepareReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const codes = positions.map((position) =>
      position.assetCode.trim().toUpperCase(),
    );
    if (
      positions.some(
        (position) => !position.assetCode.trim() || !position.assetName.trim(),
      )
    ) {
      setError("Preencha o código e o nome de cada ativo.");
      return;
    }
    if (new Set(codes).size !== codes.length) {
      setError(
        "Há códigos de ativo repetidos. Mantenha uma posição por ativo.",
      );
      return;
    }
    setReview({
      positions: positions.map((position) => ({
        assetCode: position.assetCode.trim().toUpperCase(),
        assetName: position.assetName.trim(),
        assetClass: position.assetClass,
        currentValue: {
          amount: position.amount,
          currency: currency.trim().toUpperCase(),
        },
      })),
    });
  }

  async function save() {
    if (!review || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.put<Portfolio>("/portfolio", review);
      invalidateResources(["/portfolio", "/plans"]);
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a carteira. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form className="stack" onSubmit={prepareReview}>
        <Alert tone="info">
          Edite sua carteira completa. As posições removidas desta lista
          deixarão de fazer parte da carteira ao salvar.
        </Alert>
        {error && !review && <Alert tone="error">{error}</Alert>}
        <section className="panel">
          <div className="panel-head">
            <h2>Posições</h2>
            <Button
              type="button"
              variant="secondary"
              disabled={positions.length >= 500}
              onClick={() =>
                setPositions((current) => [
                  ...current,
                  {
                    key: crypto.randomUUID(),
                    assetCode: "",
                    assetName: "",
                    assetClass: "FIXED_INCOME",
                    amount: "",
                  },
                ])
              }
            >
              <Icon name="plus-lg" />
              Adicionar ativo
            </Button>
          </div>
          <Field
            label="Moeda da carteira"
            hint="Todas as posições devem estar consolidadas nesta moeda. Alterar a moeda não converte os valores."
          >
            <input
              aria-label="Moeda da carteira"
              required
              minLength={3}
              maxLength={3}
              pattern="[A-Za-z]{3}"
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value.toUpperCase())
              }
              autoCapitalize="characters"
            />
          </Field>
          {positions.length === 0 && (
            <p className="muted section-description">
              Nenhum ativo nesta carteira. Adicione os investimentos que você já possui.
            </p>
          )}
          <div className="stack">
            {positions.map((position, index) => (
              <fieldset className="editor-row" key={position.key}>
                <legend>Posição {index + 1}</legend>
                <div className="form-grid">
                  <Field label="Código do ativo">
                    <input
                      aria-label={`Código do ativo ${index + 1}`}
                      required
                      maxLength={48}
                      value={position.assetCode}
                      onChange={(event) =>
                        updatePosition(position.key, {
                          assetCode: event.target.value,
                        })
                      }
                      placeholder="Ex.: TESOURO-SELIC"
                    />
                  </Field>
                  <Field label="Nome do ativo">
                    <input
                      aria-label={`Nome do ativo ${index + 1}`}
                      required
                      maxLength={160}
                      value={position.assetName}
                      onChange={(event) =>
                        updatePosition(position.key, {
                          assetName: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Classe">
                    <select
                      aria-label={`Classe do ativo ${index + 1}`}
                      value={position.assetClass}
                      onChange={(event) =>
                        updatePosition(position.key, {
                          assetClass: event.target.value as AssetClass,
                        })
                      }
                    >
                      {assetClasses.map((assetClass) => (
                        <option key={assetClass} value={assetClass}>
                          {label(assetClass)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Valor atual">
                    <input
                      aria-label={`Valor atual do ativo ${index + 1}`}
                      type="number"
                      inputMode="decimal"
                      required
                      min="0"
                      step="0.01"
                      value={position.amount}
                      onChange={(event) =>
                        updatePosition(position.key, {
                          amount: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setPositions((current) =>
                      current.filter((item) => item.key !== position.key),
                    )
                  }
                  aria-label={`Remover posição ${position.assetCode || index + 1}`}
                >
                  <Icon name="trash3" />
                  Remover posição
                </Button>
              </fieldset>
            ))}
          </div>
        </section>

        
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar edição
          </Button>
          <Button type="submit">Revisar alterações</Button>
        </div>
      </form>

      {review && (
        <Modal
          title="Revisar carteira"
          description="Confira a composição que será salva."
          onClose={() => {
            if (!saving) setReview(null);
          }}
        >
          <div className="stack">
            <Alert tone="info">
              Ao salvar, a carteira atual será substituída integralmente pelas
              posições desta revisão.
            </Alert>
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Posições</dt>
                <dd>
                  {portfolio.positions.length} → {review.positions.length}
                </dd>
              </div>
              <div className="detail-row">
                <dt>Novo valor da carteira</dt>
                <dd>
                  {formatMoney(
                    review.positions.reduce(
                      (sum, position) =>
                        sum + Number(position.currentValue.amount),
                      0,
                    ),
                    currency,
                  )}
                </dd>
              </div>
            </dl>
            {removedCodes.length > 0 && (
              <p>
                Ativos que serão removidos:{" "}
                <strong>{removedCodes.join(", ")}</strong>.
              </p>
            )}
            <div className="table-wrap">
              <table className="data-table">
                <caption>Posições a salvar</caption>
                <thead>
                  <tr>
                    <th scope="col">Ativo</th>
                    <th scope="col">Classe</th>
                    <th scope="col">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {review.positions.map((position) => (
                    <tr key={position.assetCode}>
                      <td>
                        {position.assetCode}
                        <small className="muted">{position.assetName}</small>
                      </td>
                      <td>{label(position.assetClass)}</td>
                      <td>
                        {formatMoney(
                          Number(position.currentValue.amount),
                          currency,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {error && <Alert tone="error">{error}</Alert>}
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setReview(null)}
              >
                Voltar à edição
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Salvando carteira…" : "Salvar carteira"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
