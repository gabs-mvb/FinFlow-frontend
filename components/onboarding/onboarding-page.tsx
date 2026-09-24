"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { useOnboarding } from "@/hooks/use-onboarding";
import { AccountsPage } from "@/components/features/accounts";
import { CommitmentsPage } from "@/components/features/commitments";
import { GoalsPage } from "@/components/features/goals";
import { PortfolioPage } from "@/components/features/portfolio";
import { Alert, Button, Icon } from "@/components/ui";
import { migrateOnboardingStep, resumeStep } from "@/lib/onboarding";
import { deferPlan } from "@/lib/onboarding-progress";
import { PlanSetup } from "./plan-setup";

const steps = [
  {
    name: "Perfil financeiro",
    title: "Seu perfil financeiro, do seu jeito.",
    description:
      "Comece pela sua renda, despesas, reserva e preferências. Salve seu perfil para liberar as próximas etapas e preparar a base do seu plano.",
    hint: "Perfil obrigatório",
  },
  {
    name: "Contas",
    title: "Comece por onde seu dinheiro está.",
    description:
      "Adicione suas contas e o saldo atual de cada uma. O saldo disponível será calculado a partir delas. Escolha Dia a dia para o dinheiro usado nas despesas do mês.",
    hint: "Conta obrigatória",
  },
  {
    name: "Dívidas",
    title: "O que você precisa quitar?",
    description:
      "Revise as dívidas que você cadastrou no perfil. Elas já estão salvas aqui. Adicione outras apenas se faltou alguma; não repita as parcelas nos compromissos.",
    hint: "Opcional",
  },
  {
    name: "Compromissos",
    title: "Deixe os próximos vencimentos à vista.",
    description:
      "Os compromissos informados no perfil já estão aqui. Confira os vencimentos e adicione apenas o que faltou. Evite repetir parcelas que já cadastrou em Dívidas.",
    hint: "Opcional",
  },
  {
    name: "Metas",
    title: "Para o que você quer guardar?",
    description:
      "Dê um nome ao seu objetivo, defina o valor desejado e quanto já guardou. O prazo é opcional.",
    hint: "Opcional",
  },
  {
    name: "Carteira",
    title: "Organize o que você já investe.",
    description:
      "Registre os ativos que você já possui e seus valores atuais. Se ainda não investe, pode deixar para depois.",
    hint: "Opcional",
  },
  {
    name: "Seu plano",
    title: "Transforme seus dados em um plano.",
    description:
      "Revise seu perfil financeiro, escolha a data de referência e veja como organizar seu dinheiro até o próximo recebimento.",
    hint: "Última etapa",
  },
];

export function OnboardingPage() {
  const { session } = useSession();
  const onboarding = useOnboarding(!!session?.authenticated);
  if (!session?.authenticated) return null;
  if (onboarding.loading)
    return (
      <div className="initial-loading" role="status">
        Carregando sua configuração…
      </div>
    );
  // Keep the wizard mounted during background refreshes and mutations.
  if (!onboarding.status.data || !onboarding.accounts.data)
    return (
      <main className="onboarding-gate stack">
        <h1>Não foi possível carregar sua configuração</h1>
        <Alert tone="error">
          {onboarding.error?.message ?? "Tente novamente para continuar."}
        </Alert>
        <Button onClick={onboarding.refresh}>Tentar novamente</Button>
      </main>
    );
  return (
    <Journey
      key={session.user.id}
      userId={session.user.id}
      initialStep={onboarding.completed ? 6 : undefined}
    />
  );
}

function Journey({
  userId,
  initialStep,
}: {
  userId: number;
  initialStep?: number;
}) {
  const onboarding = useOnboarding();
  const { signOut } = useSession();
  const router = useRouter();
  const storageKey = `finflow:onboarding:v2:${userId}`;
  const [step, setStep] = useState(() => {
    let saved: string | null = null;
    try {
      saved =
        localStorage.getItem(storageKey) ??
        migrateOnboardingStep(
          localStorage.getItem(`finflow:onboarding:v1:${userId}`),
        );
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
    return (
      initialStep ??
      resumeStep(
        saved,
        !!onboarding.accounts.data?.length,
        onboarding.hasProfile,
      )
    );
  });
  const [furthest, setFurthest] = useState(step);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const currentStep = useRef<HTMLButtonElement>(null);
  const hasAccount =
    !!onboarding.accounts.data?.length && !onboarding.accounts.error;
  const current = steps[step];

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const mobile = window.matchMedia("(max-width: 760px)");
    const revealCurrentStep = () => {
      if (mobile.matches)
        currentStep.current?.scrollIntoView({
          block: "nearest",
          inline: "center",
        });
    };
    revealCurrentStep();
    mobile.addEventListener("change", revealCurrentStep);
    return () => mobile.removeEventListener("change", revealCurrentStep);
  }, [step]);

  function go(next: number) {
    if (
      editing ||
      (next > 0 && !onboarding.hasProfile) ||
      (next > 1 && !hasAccount)
    )
      return;
    openStep(next);
  }

  function openStep(next: number) {
    setStep(next);
    setFurthest(Math.max(furthest, next));
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      /* Saved API records remain available. */
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function exit() {
    setLeaving(true);
    try {
      await signOut();
      router.replace("/login");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível sair.",
      );
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="onboarding-shell">
      <a className="skip-link" href="#onboarding-content">
        Ir para a etapa atual
      </a>
      <header className="onboarding-topbar">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          finflow<span className="brand-dot">.</span>
        </span>
        <Button variant="ghost" onClick={exit} disabled={leaving || editing}>
          Sair e continuar depois <Icon name="box-arrow-right" />
        </Button>
      </header>
      <div className="onboarding-layout">
        <aside className="onboarding-rail">
          <h2>Seu ponto de partida</h2>
          <p>Uma visão completa começa com os seus dados.</p>
          <nav aria-label="Etapas da configuração">
            <ol>
              {steps.map((item, index) => (
                <li key={item.name}>
                  <button
                    ref={index === step ? currentStep : undefined}
                    type="button"
                    aria-current={index === step ? "step" : undefined}
                    disabled={
                      editing ||
                      index > furthest ||
                      (index > 0 && !onboarding.hasProfile) ||
                      (index > 1 && !hasAccount)
                    }
                    onClick={() => go(index)}
                  >
                    <span className="onboarding-step-number">{index + 1}</span>
                    <span>
                      {item.name}
                      <small>{item.hint}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <p className="onboarding-save-note">
            <Icon name="cloud-check" /> Os cadastros confirmados ficam salvos.
            Você pode continuar depois.
          </p>
        </aside>
        <main id="onboarding-content" className="onboarding-content">
          <header className="onboarding-heading">
            <p>
              Etapa {step + 1} de {steps.length} <span>{current.hint}</span>
            </p>
            <h1 ref={heading} tabIndex={-1}>
              {current.title}
            </h1>
            <p>{current.description}</p>
          </header>
          {error && <Alert tone="error">{error}</Alert>}
          {onboarding.error && (
            <Alert tone="error">
              {onboarding.error.message}{" "}
              <Button variant="ghost" onClick={onboarding.refresh}>
                Tentar novamente
              </Button>
            </Alert>
          )}
          <div className="onboarding-records">
            {step === 1 && <AccountsPage onboarding />}
            {step === 2 && (
              <CommitmentsPage key="debts" kind="debts" onboarding />
            )}
            {step === 3 && (
              <CommitmentsPage
                key="obligations"
                kind="obligations"
                onboarding
              />
            )}
            {step === 4 && <GoalsPage onboarding />}
            {step === 5 && (
              <PortfolioPage onboarding onEditingChange={setEditing} />
            )}
          </div>
          <div hidden={step !== 0 && step !== 6}>
            <PlanSetup
              stage={step === 6 ? "plan" : "profile"}
              onProfileSaved={() =>
                openStep(furthest === 6 && hasAccount ? 6 : 1)
              }
              onEditProfile={() => go(0)}
              onBusyChange={setEditing}
              onFinish={() => {
                try {
                  localStorage.removeItem(storageKey);
                  localStorage.removeItem(`finflow:onboarding:v1:${userId}`);
                } catch {
                  /* Optional progress storage. */
                }
                router.replace("/");
              }}
            />
            {step === 6 &&
              (!onboarding.plan.data || !onboarding.status.data?.completed) && (
                <div className="onboarding-defer-plan">
                  <p>Prefere organizar o orçamento em outro momento?</p>
                  <Button
                    variant="ghost"
                    disabled={editing || !hasAccount || !onboarding.hasProfile}
                    onClick={() => {
                      deferPlan(userId);
                      router.replace("/");
                    }}
                  >
                    Fazer o plano depois
                  </Button>
                </div>
              )}
          </div>
          {step > 0 && step < 6 && (
            <footer className="onboarding-footer">
              <div>
                {step === 1 ? (
                  <div>
                    <Button
                      variant="ghost"
                      disabled={editing}
                      onClick={() => go(0)}
                    >
                      Voltar ao perfil
                    </Button>
                    <p>
                      {hasAccount
                        ? "Conta cadastrada. Tudo pronto para seguir."
                        : "Cadastre uma conta para liberar a próxima etapa."}
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    disabled={editing}
                    onClick={() => go(step - 1)}
                  >
                    Voltar
                  </Button>
                )}
              </div>
              <div className="onboarding-next">
                {step > 1 && (
                  <Button
                    variant="ghost"
                    disabled={editing || !hasAccount || !onboarding.hasProfile}
                    onClick={() => go(step + 1)}
                  >
                    Deixar para depois
                  </Button>
                )}
                <Button
                  disabled={
                    editing ||
                    !hasAccount ||
                    !onboarding.hasProfile ||
                    onboarding.accounts.isValidating
                  }
                  onClick={() => go(step + 1)}
                >
                  Continuar <Icon name="chevron-right" />
                </Button>
              </div>
              {editing && <p>Salve ou cancele a edição para continuar.</p>}
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}
