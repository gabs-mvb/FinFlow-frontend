"use client";

import Link from "next/link";
import { useState } from "react";
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
import { invalidateResources, useResource } from "@/hooks/use-resource";
import { api } from "@/lib/finflow/api";
import type {
  ConsentScope,
  ConsentStatus,
  OpenFinanceConsent,
  OpenFinanceIntegrationStatus,
  RegisterConsentRequest,
} from "@/lib/finflow/types";

const scopeLabels: Record<ConsentScope, string> = {
  ACCOUNTS: "Contas",
  BALANCES: "Saldos",
  TRANSACTIONS: "Transações",
  CREDIT_CARDS: "Cartões de crédito",
  CREDIT_OPERATIONS: "Operações de crédito",
  INVESTMENTS: "Investimentos",
};

const statusLabels: Record<ConsentStatus, string> = {
  AWAITING_AUTHORIZATION: "Aguardando autorização",
  ACTIVE: "Ativo",
  EXPIRED: "Expirado",
  REVOKED: "Revogado",
  REJECTED: "Recusado",
  FAILED: "Falhou",
};

function formatInstant(value?: string | null) {
  if (!value) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function localDateTime(value?: string | null) {
  if (!value) return "";
  const instant = new Date(value);
  const local = new Date(
    instant.getTime() - instant.getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 16);
}

function effectiveStatus(consent: OpenFinanceConsent): ConsentStatus {
  return consent.status === "ACTIVE" &&
    (!consent.expiresAt || new Date(consent.expiresAt).getTime() <= Date.now())
    ? "EXPIRED"
    : consent.status;
}

export function ConnectionsPage() {
  const integration = useResource<OpenFinanceIntegrationStatus>(
    "/open-finance/status",
  );
  const consents = useResource<OpenFinanceConsent[]>("/open-finance/consents");
  const [editor, setEditor] = useState<OpenFinanceConsent | "new" | null>(null);
  const [saved, setSaved] = useState(false);

  function openEditor(consent: OpenFinanceConsent | "new") {
    setSaved(false);
    setEditor(consent);
  }

  return (
    <div className="stack">
      <PageHeading
        title="Conexões e consentimentos"
        description="Acompanhe as permissões registradas e a origem dos seus dados financeiros."
        actions={
          <Button onClick={() => openEditor("new")}>
            <Icon name="plus-lg" /> Registrar consentimento
          </Button>
        }
      />
      {saved && (
        <Alert tone="success">
          Consentimento salvo. O registro pode ser consultado abaixo.
        </Alert>
      )}

      <ResourceState resource={integration}>
        {integration.data && (
          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Como seus dados chegam ao FinFlow</h2>
                <p className="muted">
                  Você pode importar transações e manter os saldos das contas
                  atualizados.
                </p>
              </div>
              <Icon name="bank" />
            </div>
            <div className="stack">
              <div className="row">
                <span className="badge">Importação manual</span>
                {integration.data.configuredProvider !== "disabled" && (
                  <span className="muted">
                    Provedor informado: {integration.data.configuredProvider}
                  </span>
                )}
              </div>
              <p>
                {integration.data.liveSynchronizationAvailable
                  ? "Há um provedor informado na configuração. A atualização automática depende de uma integração com esse provedor; os dados podem ser mantidos por importação."
                  : "A sincronização bancária está indisponível. Importe as transações de suas contas para atualizar o extrato e os relatórios."}
              </p>
              <div className="row">
                <Link className="button button-secondary" href="/transacoes">
                  <Icon name="file-earmark-arrow-up" /> Ir para transações
                </Link>
                <Link className="button button-ghost" href="/contas">
                  Revisar saldos
                </Link>
              </div>
            </div>
          </section>
        )}
      </ResourceState>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Consentimentos registrados</h2>
            <p className="muted">
              Este registro guarda as informações da autorização fornecida pela
              instituição.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={consents.refresh}
            disabled={consents.isLoading}
            aria-label="Atualizar lista de consentimentos"
          >
            <Icon name="arrow-clockwise" />
          </Button>
        </div>
        <ResourceState resource={consents}>
          {consents.data &&
            (consents.data.length === 0 ? (
              <EmptyState
                icon="shield-check"
                title="Nenhum consentimento registrado"
                description="Se você já tem uma autorização com um provedor, registre as permissões e a validade para acompanhá-la aqui."
                action={
                  <Button variant="secondary" onClick={() => openEditor("new")}>
                    Registrar consentimento
                  </Button>
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <caption className="sr-only">
                    Consentimentos, permissões e validade
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Instituição</th>
                      <th scope="col">Permissões</th>
                      <th scope="col">Situação</th>
                      <th scope="col">Validade</th>
                      <th scope="col">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {consents.data.map((consent) => (
                      <tr key={consent.id}>
                        <td>
                          <strong>{consent.institution}</strong>
                          <small className="muted">{consent.provider}</small>
                        </td>
                        <td>
                          {consent.scopes
                            .map((scope) => scopeLabels[scope])
                            .join(", ")}
                        </td>
                        <td>
                          <span
                            className={`badge ${effectiveStatus(consent) === "ACTIVE" ? "badge-success" : ""}`}
                          >
                            {statusLabels[effectiveStatus(consent)]}
                          </span>
                        </td>
                        <td>{formatInstant(consent.expiresAt)}</td>
                        <td>
                          <Button
                            variant="ghost"
                            aria-label={`Editar consentimento de ${consent.institution}`}
                            onClick={() => openEditor(consent)}
                          >
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </ResourceState>
        <p className="muted section-description">
          Registrar ou alterar a situação aqui não autoriza acesso ao banco.
          Renove ou revogue a autorização no provedor e atualize o registro
          correspondente.
        </p>
      </section>

      {editor && (
        <ConsentEditor
          consent={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setSaved(true);
            invalidateResources(["/open-finance/consents", "/plans"]);
          }}
        />
      )}
    </div>
  );
}

function ConsentEditor({
  consent,
  onClose,
  onSaved,
}: {
  consent?: OpenFinanceConsent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<ConsentStatus>(
    consent?.status ?? "AWAITING_AUTHORIZATION",
  );

  return (
    <Modal
      title={consent ? "Editar consentimento" : "Registrar consentimento"}
      description="Use os dados da autorização que você recebeu do provedor."
      onClose={onClose}
    >
      <SubmitForm
        onCancel={onClose}
        submitLabel="Salvar consentimento"
        onSubmit={async (data) => {
          const scopes = data.getAll("scopes") as ConsentScope[];
          if (scopes.length === 0)
            throw new Error("Selecione pelo menos uma permissão.");
          const expiry = textInput(data, "expiresAt");
          const expiresAt = expiry ? new Date(expiry) : null;
          if (expiresAt && Number.isNaN(expiresAt.getTime()))
            throw new Error("Informe uma data de validade válida.");
          if (
            status === "ACTIVE" &&
            (!expiresAt || expiresAt.getTime() <= Date.now())
          ) {
            throw new Error(
              "Um consentimento ativo precisa ter validade futura. Atualize a data ou a situação.",
            );
          }
          const request: RegisterConsentRequest = {
            provider: consent?.provider ?? textInput(data, "provider"),
            externalConsentId:
              consent?.externalConsentId ??
              textInput(data, "externalConsentId"),
            institution: textInput(data, "institution"),
            scopes,
            status,
            expiresAt: expiresAt?.toISOString() ?? null,
          };
          await api.put<OpenFinanceConsent>("/open-finance/consents", request);
          onSaved();
        }}
      >
        <div className="form-grid">
          <Field label="Instituição">
            <input
              name="institution"
              defaultValue={consent?.institution}
              maxLength={120}
              required
              placeholder="Nome do banco ou instituição"
            />
          </Field>
          <Field
            label="Provedor"
            hint={
              consent
                ? "Identifica o registro original."
                : "Nome do provedor que emitiu a autorização."
            }
          >
            <input
              name="provider"
              defaultValue={consent?.provider}
              maxLength={80}
              required
              readOnly={Boolean(consent)}
            />
          </Field>
          <Field
            label="Identificador do consentimento"
            hint={
              consent
                ? "O identificador é mantido ao atualizar este registro."
                : "Código da autorização informado pelo provedor."
            }
          >
            <input
              name="externalConsentId"
              defaultValue={consent?.externalConsentId}
              maxLength={180}
              required
              readOnly={Boolean(consent)}
            />
          </Field>
          <Field label="Situação">
            <select
              name="status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ConsentStatus)
              }
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Válido até"
            hint="Data e horário local. Obrigatório para consentimentos ativos."
          >
            <input
              name="expiresAt"
              type="datetime-local"
              defaultValue={localDateTime(consent?.expiresAt)}
              required={status === "ACTIVE"}
            />
          </Field>
        </div>
        <fieldset className="stack">
          <legend>Permissões concedidas</legend>
          <div className="form-grid">
            {Object.entries(scopeLabels).map(([scope, label]) => (
              <label key={scope} className="checkbox-label">
                <input
                  type="checkbox"
                  name="scopes"
                  value={scope}
                  defaultChecked={
                    consent?.scopes.includes(scope as ConsentScope) ??
                    ["ACCOUNTS", "BALANCES", "TRANSACTIONS"].includes(scope)
                  }
                />{" "}
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </SubmitForm>
    </Modal>
  );
}
