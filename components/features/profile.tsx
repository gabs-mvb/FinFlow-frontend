"use client";

import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Field,
  Icon,
  PageHeading,
  ResourceState,
} from "@/components/ui";
import { invalidateResources, useResource } from "@/hooks/use-resource";
import { api, ApiError } from "@/lib/finflow/api";
import { formatDate, formatMoney } from "@/lib/finflow/format";
import type { FinancialProfile } from "@/lib/finflow/types";

export function ProfilePage() {
  const resource = useResource<FinancialProfile>("/profile");
  const [saved, setSaved] = useState(false);
  const isNewProfile =
    resource.error instanceof ApiError && resource.error.status === 404;

  return (
    <>
      <PageHeading
        title="Seu perfil financeiro"
        description="Defina a base que o FinFlow usa para organizar seu dinheiro."
      />
      {saved && (
        <Alert tone="success">
          Perfil salvo. Gere um novo plano para considerar suas alterações.
        </Alert>
      )}
      {isNewProfile ? (
        <ProfileForm
          onSaved={() => setSaved(true)}
          onEditing={() => setSaved(false)}
        />
      ) : (
        <ResourceState resource={resource}>
          {resource.data && (
            <ProfileForm
              key={resource.data.updatedAt}
              profile={resource.data}
              onSaved={() => setSaved(true)}
              onEditing={() => setSaved(false)}
            />
          )}
        </ResourceState>
      )}
    </>
  );
}

function ProfileForm({
  profile,
  onSaved,
  onEditing,
}: {
  profile?: FinancialProfile;
  onSaved: () => void;
  onEditing: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(profile?.autopilotMode ?? "OBSERVER");
  const currency = profile?.monthlyIncome.currency ?? "BRL";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedCurrency = String(form.get("currency")).trim().toUpperCase();
    const amount = (name: string) => ({
      amount: Number(form.get(name)),
      currency: selectedCurrency,
    });
    setSaving(true);
    setError(null);
    onEditing();
    try {
      await api.put<FinancialProfile>("/profile", {
        monthlyIncome: amount("monthlyIncome"),
        payDay: Number(form.get("payDay")),
        essentialMonthlyExpenses: amount("essentialMonthlyExpenses"),
        variableMonthlyBudget: amount("variableMonthlyBudget"),
        minimumCashBuffer: amount("minimumCashBuffer"),
        emergencyTargetMonths: Number(form.get("emergencyTargetMonths")),
        reserveContributionRate:
          Number(form.get("reserveContributionRate")) / 100,
        investmentContributionRate:
          Number(form.get("investmentContributionRate")) / 100,
        riskProfile: form.get("riskProfile"),
        autopilotMode: mode,
      });
      onSaved();
      invalidateResources(["/profile", "/plans", "/reports"]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar seu perfil. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} onChange={onEditing} className="stack">
      {!profile && (
        <Alert tone="info">
          Comece pelo seu orçamento. Você pode ajustar estes valores quando sua
          rotina mudar.
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>O seu mês</h2>
            <p className="muted">
              Renda e limites para planejar até o próximo recebimento.
            </p>
          </div>
          <Icon name="calendar2-week" />
        </div>
        <div className="form-grid">
          <Field
            label="Moeda"
            hint="Use a mesma moeda nas contas incluídas no plano."
          >
            <input
              name="currency"
              aria-label="Moeda"
              defaultValue={currency}
              required
              minLength={3}
              maxLength={3}
              pattern="[A-Za-z]{3}"
              placeholder="BRL"
              autoCapitalize="characters"
            />
          </Field>
          <Field
            label="Dia do recebimento"
            hint="De 1 a 28, para funcionar em todos os meses."
          >
            <input
              name="payDay"
              aria-label="Dia do recebimento"
              type="number"
              min="1"
              max="28"
              step="1"
              required
              defaultValue={profile?.payDay ?? 1}
            />
          </Field>
          <Field label="Renda mensal">
            <input
              name="monthlyIncome"
              aria-label="Renda mensal"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              defaultValue={profile?.monthlyIncome.amount}
              placeholder="0,00"
            />
          </Field>
          <Field
            label="Despesas essenciais por mês"
            hint="Moradia, alimentação básica e outras despesas indispensáveis."
          >
            <input
              name="essentialMonthlyExpenses"
              aria-label="Despesas essenciais por mês"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              defaultValue={profile?.essentialMonthlyExpenses.amount}
              placeholder="0,00"
            />
          </Field>
          <Field
            label="Orçamento de gastos variáveis"
            hint="Limite mensal para gastos como lazer, transporte e assinaturas."
          >
            <input
              name="variableMonthlyBudget"
              aria-label="Orçamento de gastos variáveis"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              defaultValue={profile?.variableMonthlyBudget.amount}
              placeholder="0,00"
            />
          </Field>
          <Field
            label="Saldo mínimo em conta"
            hint="Valor que você quer manter disponível, além do orçamento."
          >
            <input
              name="minimumCashBuffer"
              aria-label="Saldo mínimo em conta"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              defaultValue={profile?.minimumCashBuffer.amount}
              placeholder="0,00"
            />
          </Field>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Reserva e aportes</h2>
            <p className="muted">
              Os aportes sugeridos respeitam o saldo disponível e as prioridades
              do plano.
            </p>
          </div>
          <Icon name="shield-check" />
        </div>
        <div className="form-grid">
          <Field
            label="Meses de reserva"
            hint="Quantidade de meses de despesas essenciais que deseja proteger."
          >
            <input
              name="emergencyTargetMonths"
              aria-label="Meses de reserva"
              type="number"
              min="1"
              max="24"
              step="1"
              required
              defaultValue={profile?.emergencyTargetMonths ?? 6}
            />
          </Field>
          <Field label="Renda destinada à reserva (%)">
            <input
              name="reserveContributionRate"
              aria-label="Renda destinada à reserva (%)"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.0001"
              required
              defaultValue={
                profile
                  ? Number((profile.reserveContributionRate * 100).toFixed(4))
                  : 10
              }
            />
          </Field>
          <Field label="Renda destinada a investimentos (%)">
            <input
              name="investmentContributionRate"
              aria-label="Renda destinada a investimentos (%)"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.0001"
              required
              defaultValue={
                profile
                  ? Number(
                      (profile.investmentContributionRate * 100).toFixed(4),
                    )
                  : 10
              }
            />
          </Field>
        </div>
        {profile && (
          <p className="muted section-description">
            Meta atual de reserva:{" "}
            {formatMoney(
              profile.essentialMonthlyExpenses.amount *
                profile.emergencyTargetMonths,
              currency,
            )}
            .
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Suas preferências</h2>
            <p className="muted">
              Registre como você prefere acompanhar suas finanças.
            </p>
          </div>
          <Icon name="sliders" />
        </div>
        <div className="form-grid">
          <Field label="Perfil de risco">
            <select
              name="riskProfile"
              aria-label="Perfil de risco"
              defaultValue={profile?.riskProfile ?? "CONSERVATIVE"}
            >
              <option value="CONSERVATIVE">Conservador</option>
              <option value="MODERATE">Moderado</option>
              <option value="BOLD">Arrojado</option>
              <option value="AGGRESSIVE">Agressivo</option>
            </select>
          </Field>
          <Field label="Modo de acompanhamento">
            <select
              name="autopilotMode"
              aria-label="Modo de acompanhamento"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as FinancialProfile["autopilotMode"])
              }
            >
              <option value="OBSERVER">Observador</option>
              <option value="COPILOT">Copiloto</option>
              <option value="AUTOPILOT">Piloto automático</option>
            </select>
          </Field>
        </div>
        <p className="muted section-description">
          {mode === "AUTOPILOT"
            ? "A preferência por piloto automático fica registrada. Nesta versão, o FinFlow apresenta recomendações; pagamentos e transferências continuam sob seu controle."
            : "O FinFlow organiza recomendações e registra suas decisões. Pagamentos e transferências continuam sob seu controle."}
        </p>
      </section>
      <div className="form-actions">
        {profile && (
          <span className="muted">
            Atualizado em {formatDate(profile.updatedAt)}
          </span>
        )}
        <Button type="submit" disabled={saving}>
          <Icon name={saving ? "hourglass-split" : "check2"} />
          {saving ? "Salvando perfil…" : "Salvar perfil"}
        </Button>
      </div>
    </form>
  );
}
