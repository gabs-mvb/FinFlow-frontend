"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button, EmptyState, Field, Icon, Stat } from "@/components/ui";
import { invalidateResources } from "@/hooks/use-resource";
import { useOnboarding } from "@/hooks/use-onboarding";
import { api, ApiError } from "@/lib/finflow/api";
import { createFirstPlan, saveOnboardingProfile } from "@/lib/onboarding";
import { PlanDetailsView, PlanPreferences } from "@/components/plan-details";
import { CommitmentsPage } from "@/components/features/commitments";
import { useMonthlyBudget } from "@/hooks/use-monthly-budget";
import { MonthlyBudgetSummary, ProfileSteps } from "./monthly-budget";
import { localDate } from "@/lib/display";
import { formatDate, formatMoney, label } from "@/lib/finflow/format";
import type {
  FinancialPlan,
  FinancialProfile,
  UpsertFinancialProfileRequest,
} from "@/lib/finflow/types";

type Props = {
  stage: "profile" | "plan";
  onProfileSaved: () => void;
  onEditProfile: () => void;
  onBusyChange: (busy: boolean) => void;
  onFinish: () => void;
};

export function PlanSetup(props: Props) {
  const [profile, setProfile] = useState<FinancialProfile | null>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  // Seed the draft once. Revalidating the shared profile must not erase an in-progress form.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get<FinancialProfile>("/profile", { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setProfile(value ?? null);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 404) setProfile(null);
        else
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar seu perfil.",
          );
      });
    return () => controller.abort();
  }, [attempt]);
  if (profile !== undefined)
    return <PlanForm {...props} profile={profile ?? undefined} />;
  if (error)
    return (
      <Alert tone="error">
        {error}{" "}
        <Button
          variant="ghost"
          onClick={() => {
            setError("");
            setAttempt(attempt + 1);
          }}
        >
          Tentar novamente
        </Button>
      </Alert>
    );
  return <p role="status">Carregando seu perfil financeiro…</p>;
}

function PlanForm({
  profile,
  stage,
  onProfileSaved,
  onEditProfile,
  onBusyChange,
  onFinish,
}: Props & { profile?: FinancialProfile }) {
  const onboarding = useOnboarding();
  const [profilePage, setPage] = useState(0);
  const page = stage === "plan" ? 3 : profilePage;
  const [editableDraft, setDraft] = useState(() => ({
    currency:
      profile?.monthlyIncome.currency ??
      onboarding.accounts.data?.[0]?.availableBalance.currency ??
      "BRL",
    monthlyIncome: String(profile?.monthlyIncome.amount ?? ""),
    payDay: String(profile?.payDay ?? 5),
    essentialMonthlyExpenses: String(
      profile?.essentialMonthlyExpenses.amount ?? "",
    ),
    variableMonthlyBudget: String(profile?.variableMonthlyBudget.amount ?? ""),
    minimumCashBuffer: String(profile?.minimumCashBuffer.amount ?? ""),
    emergencyTargetMonths: String(profile?.emergencyTargetMonths ?? 6),
    reserveContributionRate: String(
      Number(((profile?.reserveContributionRate ?? 0.1) * 100).toFixed(4)),
    ),
    investmentContributionRate: String(
      Number(((profile?.investmentContributionRate ?? 0.1) * 100).toFixed(4)),
    ),
    riskProfile: profile?.riskProfile ?? "CONSERVATIVE",
    autopilotMode: profile?.autopilotMode ?? "OBSERVER",
  }));
  const [savedDraft, setSavedDraft] = useState(profile ? editableDraft : null);
  // Review only saved values; returning to the plan must not submit an unfinished edit.
  const draft = stage === "plan" && savedDraft ? savedDraft : editableDraft;
  const [asOf, setAsOf] = useState(localDate);
  const [preferences, setPreferences] = useState("");
  const budget = useMonthlyBudget(
    draft.currency,
    asOf,
    Number(draft.variableMonthlyBudget),
  );
  const [result, setResult] = useState<FinancialPlan | undefined>(
    onboarding.completed ? onboarding.plan.data : undefined,
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const money = (
    key:
      | "monthlyIncome"
      | "essentialMonthlyExpenses"
      | "variableMonthlyBudget"
      | "minimumCashBuffer",
  ) => ({ amount: Number(draft[key]), currency: draft.currency });
  const fields = [
    {
      key: "monthlyIncome",
      title: "Renda mensal",
      hint: "Quanto você recebe por mês, já descontados os impostos.",
    },
    {
      key: "essentialMonthlyExpenses",
      title: "Base mensal da reserva",
      hint: "Custo essencial que sua reserva deve cobrir. Este valor não é somado novamente aos gastos do mês.",
    },
    {
      key: "variableMonthlyBudget",
      title: "Lazer e outros gastos variáveis",
      hint: "Seu limite mensal para lazer, compras e despesas variáveis. Não inclua aqui parcelas ou contas que vai cadastrar nos gastos do mês.",
    },
    {
      key: "minimumCashBuffer",
      title: "Saldo mínimo em conta",
      hint: "Uma margem que deve ficar disponível além do orçamento. Pode ser zero.",
    },
  ] as const;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [page, result]);
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    setError("");
    if (page === 0) {
      setPage(page + 1);
      return;
    }
    const payload: UpsertFinancialProfileRequest = {
      monthlyIncome: money("monthlyIncome"),
      payDay: Number(draft.payDay),
      essentialMonthlyExpenses: money("essentialMonthlyExpenses"),
      variableMonthlyBudget: money("variableMonthlyBudget"),
      minimumCashBuffer: money("minimumCashBuffer"),
      emergencyTargetMonths: Number(draft.emergencyTargetMonths),
      reserveContributionRate: Number(draft.reserveContributionRate) / 100,
      investmentContributionRate:
        Number(draft.investmentContributionRate) / 100,
      riskProfile: draft.riskProfile,
      autopilotMode: draft.autopilotMode,
    };
    busyRef.current = true;
    setBusy(true);
    try {
      if (stage === "profile") {
        await saveOnboardingProfile(payload);
        setSavedDraft({ ...editableDraft });
        setResult(undefined);
        invalidateResources(["/profile", "/onboarding", "/reports"]);
      } else {
        const plan = await createFirstPlan(payload, asOf, preferences);
        setResult(plan);
        invalidateResources([
          "/onboarding",
          "/profile",
          "/plans",
          "/accounts",
          "/reports",
        ]);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : stage === "profile"
            ? "Não foi possível salvar seu perfil. Tente novamente."
            : "Não foi possível gerar seu plano. Tente novamente.",
      );
      return;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (stage === "profile") onProfileSaved();
  }

  if (stage === "plan" && !savedDraft)
    return (
      <section className="panel">
        <EmptyState
          icon="person-gear"
          title="Seu plano precisa de um perfil financeiro"
          description="Preencha e salve sua renda, despesas e preferências na primeira etapa para continuar."
          action={<Button onClick={onEditProfile}>Preencher meu perfil</Button>}
        />
      </section>
    );

  if (stage === "plan" && result)
    return (
      <section className="stack onboarding-plan-result">
        <div className="onboarding-result-heading">
          <Icon name="check2-circle" />
          <div>
            <h2 ref={heading} tabIndex={-1}>
              Seu primeiro plano está pronto.
            </h2>
            <p>
              De {formatDate(result.asOf)} até o próximo recebimento, em{" "}
              {formatDate(result.nextIncomeDate)}.
            </p>
          </div>
        </div>
        <div className="metric-grid">
          <Stat
            label="Saldo livre real"
            value={formatMoney(result.freeRealBalance)}
            detail="Após os compromissos e as reservas do plano"
          />
          <Stat
            label="Limite diário"
            value={formatMoney(result.dailySpendingLimit)}
            detail="Referência de gasto até o próximo recebimento"
          />
          <Stat
            label="Falta projetada"
            value={formatMoney(result.projectedShortfall)}
            detail="Valor que pode faltar para cobrir o período"
          />
        </div>
        <PlanDetailsView plan={result} />
        {result.warnings.map((warning, i) => (
          <Alert key={i} tone="info">
            {warning}
          </Alert>
        ))}
        <details className="panel">
          <summary>Entenda os valores e as recomendações</summary>
          <dl className="onboarding-review">
            {(
              [
                ["Saldo consolidado", result.totalConsolidatedBalance],
                ["Saldo para o dia a dia", result.operatingBalance],
                ["Compromissos reservados", result.committedObligations],
                ["Orçamento variável restante", result.remainingVariableBudget],
                ["Saldo mínimo protegido", result.minimumCashBuffer],
                [
                  "Pagamento sugerido de dívidas",
                  result.debtPaymentRecommendation,
                ],
                ["Aporte sugerido à reserva", result.reserveContribution],
                [
                  "Aporte sugerido a investimentos",
                  result.investmentContribution,
                ],
                ["Reserva atual", result.emergencyReserveBalance],
                ["Meta de reserva", result.emergencyReserveTarget],
              ] as const
            ).map(([title, value]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{formatMoney(value)}</dd>
              </div>
            ))}
          </dl>
          {result.actions.map((action) => (
            <article className="onboarding-recommendation" key={action.id}>
              <h3>
                {label(action.type)} · {formatMoney(action.amount)}
              </h3>
              <p>{action.rationale}</p>
              <small>
                Risco: {label(action.riskLevel)}.{" "}
                {action.requiresApproval
                  ? "Requer sua aprovação."
                  : "Revise no seu plano."}
              </small>
            </article>
          ))}
          {result.contributionAllocation.length > 0 && (
            <>
              <h3>Distribuição dos aportes</h3>
              {result.contributionAllocation.map((item) => (
                <p key={item.assetClass}>
                  {label(item.assetClass)}: {formatMoney(item.amount)}.{" "}
                  {item.reason}
                </p>
              ))}
            </>
          )}
        </details>
        <p className="muted">
          Nenhum dinheiro foi movimentado. Você pode revisar as recomendações e
          ajustar seus dados no painel.
        </p>
        {onboarding.error && (
          <Alert tone="error">
            Não foi possível confirmar a conclusão.{" "}
            <Button variant="ghost" onClick={onboarding.refresh}>
              Tentar novamente
            </Button>
          </Alert>
        )}
        <div className="form-actions">
          <Button
            disabled={!onboarding.completed || !!onboarding.error}
            onClick={onFinish}
          >
            {onboarding.completed
              ? "Ir para meu painel"
              : "Confirmando conclusão…"}
          </Button>
        </div>
      </section>
    );

  if (stage === "profile" && page === 1)
    return (
      <section className="onboarding-plan stack">
        <ProfileSteps current={page} />
        <h2 ref={heading} tabIndex={-1}>
          Cadastre seus gastos uma única vez.
        </h2>
        <p className="muted">
          Inclua o que já sabe sobre suas dívidas e contas do mês. Cada cadastro
          é salvo na sua conta e aparecerá preenchido nas etapas seguintes para
          revisão. Se não tiver algum desses gastos, siga sem adicioná-lo.
        </p>
        <MonthlyBudgetSummary
          budget={budget}
          currency={draft.currency}
          asOf={asOf}
        />
        <p className="muted">
          Cadastre cada gasto em uma seção: uma parcela informada em Dívidas não
          deve ser repetida em Compromissos. Em lazer, informe apenas os gastos
          variáveis que ainda não estão cadastrados.
        </p>
        <details className="onboarding-budget-records" open>
          <summary>Dívidas e parcelas</summary>
          <p>
            O total mensal usa o valor da parcela, não o saldo devedor inteiro.
          </p>
          <CommitmentsPage
            kind="debts"
            onboarding
            compact
            initialCurrency={draft.currency}
          />
        </details>
        <details className="onboarding-budget-records">
          <summary>Compromissos do mês</summary>
          <p>Aluguel, contas da casa e outras despesas com vencimento.</p>
          <CommitmentsPage
            kind="obligations"
            onboarding
            compact
            initialCurrency={draft.currency}
            initialDueDate={asOf}
          />
        </details>
        <footer className="onboarding-footer">
          <Button type="button" variant="secondary" onClick={() => setPage(0)}>
            Voltar
          </Button>
          <Button
            type="button"
            disabled={budget.isLoading || budget.isValidating || !!budget.error}
            onClick={() => {
              if (editableDraft.essentialMonthlyExpenses === "")
                setDraft({
                  ...editableDraft,
                  essentialMonthlyExpenses: String(budget.fixed),
                });
              setPage(2);
            }}
          >
            Continuar para reserva
          </Button>
        </footer>
      </section>
    );

  return (
    <form className="onboarding-plan stack" onSubmit={submit}>
      {stage === "profile" && <ProfileSteps current={page} />}
      <h2 ref={heading} tabIndex={-1}>
        {
          [
            "Como funciona seu orçamento?",
            "Gastos do mês",
            "Quanto você quer proteger e guardar?",
            "Meu perfil financeiro",
          ][page]
        }
      </h2>
      {error && <Alert tone="error">{error}</Alert>}
      <fieldset hidden={page !== 0} disabled={busy || page !== 0}>
        <div className="form-grid">
          <Field
            label="Moeda do perfil"
            hint="Contas de outras moedas não são convertidas para esta moeda."
          >
            <select
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            >
              {Array.from(new Set(["BRL", "USD", "EUR", draft.currency])).map(
                (code) => (
                  <option key={code}>{code}</option>
                ),
              )}
            </select>
          </Field>
          <Field
            label="Dia do recebimento"
            hint="De 1 a 28, para funcionar em todos os meses."
          >
            <input
              type="number"
              required
              min="1"
              max="28"
              step="1"
              value={draft.payDay}
              onChange={(e) => setDraft({ ...draft, payDay: e.target.value })}
            />
          </Field>
          {fields
            .filter((field) => field.key !== "essentialMonthlyExpenses")
            .map((field) => (
              <Field
                key={field.key}
                label={`${field.title} (${draft.currency})`}
                hint={field.hint}
              >
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={draft[field.key]}
                  placeholder="0,00"
                  onChange={(e) =>
                    setDraft({ ...draft, [field.key]: e.target.value })
                  }
                />
              </Field>
            ))}
        </div>
      </fieldset>
      <fieldset hidden={page !== 2} disabled={busy || page !== 2}>
        <p className="muted">
          Os valores abaixo são ajustáveis. O plano calcula os aportes
          respeitando o dinheiro disponível e suas prioridades.
        </p>
        <div className="form-grid">
          <Field
            label={`Base mensal da reserva (${draft.currency})`}
            hint="Estimativa dos gastos indispensáveis que você quer proteger. Partimos das parcelas e compromissos cadastrados; ajuste para incluir outras necessidades. Não é um gasto extra."
          >
            <input
              required
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={draft.essentialMonthlyExpenses}
              onChange={(e) =>
                setDraft({ ...draft, essentialMonthlyExpenses: e.target.value })
              }
            />
          </Field>
          <div className="onboarding-reserve-basis">
            <p>
              Parcelas + compromissos:{" "}
              {budget.error || budget.isLoading
                ? "—"
                : formatMoney(budget.fixed, draft.currency)}
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={!!budget.error || budget.isLoading}
              onClick={() =>
                setDraft({
                  ...draft,
                  essentialMonthlyExpenses: String(budget.fixed),
                })
              }
            >
              Usar esse valor como base
            </Button>
          </div>
          <Field
            label="Meses de reserva"
            hint="Sua meta é esse número multiplicado pela base mensal da reserva."
          >
            <input
              required
              type="number"
              min="1"
              max="24"
              step="1"
              value={draft.emergencyTargetMonths}
              onChange={(e) =>
                setDraft({ ...draft, emergencyTargetMonths: e.target.value })
              }
            />
          </Field>
          <div className="onboarding-reserve">
            <span>Meta de reserva</span>
            <strong>
              {formatMoney(
                Number(draft.essentialMonthlyExpenses) *
                  Number(draft.emergencyTargetMonths),
                draft.currency,
              )}
            </strong>
          </div>
          {(
            [
              ["reserveContributionRate", "Renda destinada à reserva (%)"],
              [
                "investmentContributionRate",
                "Renda destinada a investimentos (%)",
              ],
            ] as const
          ).map(([key, title]) => (
            <Field key={key} label={title}>
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.0001"
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Perfil de risco">
            <select
              value={draft.riskProfile}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  riskProfile: e.target
                    .value as FinancialProfile["riskProfile"],
                })
              }
            >
              {["CONSERVATIVE", "MODERATE", "BOLD", "AGGRESSIVE"].map(
                (value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Modo de acompanhamento">
            <select
              value={draft.autopilotMode}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  autopilotMode: e.target
                    .value as FinancialProfile["autopilotMode"],
                })
              }
            >
              {["OBSERVER", "COPILOT", "AUTOPILOT"].map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="muted">
          Mesmo no modo piloto automático, esta versão apresenta recomendações.
          Pagamentos e transferências continuam sob seu controle.
        </p>
      </fieldset>
      {page === 3 && (
        <section>
          <MonthlyBudgetSummary
            budget={budget}
            currency={draft.currency}
            asOf={asOf}
          />
          {budget.debtPayments > 0 && (
            <Alert tone="info">
              O gasto mensal previsto inclui suas parcelas. No cálculo atual do
              plano, confira os pagamentos recomendados e os compromissos
              protegidos antes de usar o saldo livre como referência.
            </Alert>
          )}
          <p className="muted">
            Confira os dados salvos no seu perfil. Eles orientam os limites e as
            recomendações do plano.
          </p>
          <dl className="onboarding-review">
            {fields.map((field) => (
              <div key={field.key}>
                <dt>{field.title}</dt>
                <dd>{formatMoney(Number(draft[field.key]), draft.currency)}</dd>
              </div>
            ))}
            <div>
              <dt>Recebimento</dt>
              <dd>Dia {draft.payDay} de cada mês</dd>
            </div>
            <div>
              <dt>Meta de reserva</dt>
              <dd>
                {draft.emergencyTargetMonths} meses ·{" "}
                {formatMoney(
                  Number(draft.essentialMonthlyExpenses) *
                    Number(draft.emergencyTargetMonths),
                  draft.currency,
                )}
              </dd>
            </div>
            <div>
              <dt>Aportes da renda mensal</dt>
              <dd>
                {draft.reserveContributionRate}% à reserva /{" "}
                {draft.investmentContributionRate}% a investimentos
              </dd>
            </div>
            <div>
              <dt>Preferências</dt>
              <dd>
                {label(draft.riskProfile)} / {label(draft.autopilotMode)}
              </dd>
            </div>
          </dl>
          <p className="muted">
            O cálculo usa os cadastros salvos nas etapas anteriores. Você pode
            voltar para incluir outros dados antes de gerar.
          </p>
          {!onboarding.accounts.data?.some(
            (account) =>
              account.purpose === "OPERATING" &&
              account.availableBalance.currency === draft.currency,
          ) && (
            <Alert tone="info">
              Você não tem uma conta de Dia a dia em {draft.currency}. O saldo
              disponível para as despesas pode aparecer zerado. Revise suas
              contas se necessário.
            </Alert>
          )}
          <Field
            label="Data de referência"
            hint="O plano considera este dia e o período até o próximo recebimento."
          >
            <input
              type="date"
              required
              value={asOf}
              disabled={busy}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </Field>
          <PlanPreferences
            value={preferences}
            onChange={setPreferences}
            disabled={busy}
          />
          <p className="muted">
            A geração usa IA quando habilitada no serviço. Preferências
            solicitam uma análise com IA. Isso pode levar até três minutos.
          </p>
        </section>
      )}
      <div className="onboarding-footer">
        {page > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              if (stage === "plan") {
                setPage(0);
                onEditProfile();
              } else setPage(page - 1);
            }}
          >
            {stage === "plan" ? "Editar perfil financeiro" : "Voltar"}
          </Button>
        ) : (
          <p>Você poderá ajustar estes valores depois.</p>
        )}
        <Button
          type="submit"
          disabled={
            busy ||
            (page > 0 &&
              (budget.isLoading || budget.isValidating || !!budget.error))
          }
        >
          {busy
            ? stage === "profile"
              ? "Salvando perfil…"
              : "Gerando seu plano…"
            : page === 3
              ? "Gerar meu primeiro plano"
              : page === 0
                ? "Organizar gastos do mês"
                : "Salvar perfil e continuar"}
        </Button>
      </div>
    </form>
  );
}
