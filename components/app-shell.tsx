"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Button, Icon } from "./ui";
import { useOnboarding } from "@/hooks/use-onboarding";
import {
  SessionProvider,
  useSession,
} from "@/components/auth/session-provider";

const navigation = [
  { href: "/", label: "Visão geral", icon: "grid-1x2" },
  { href: "/contas", label: "Contas", icon: "wallet2" },
  { href: "/transacoes", label: "Transações", icon: "arrow-left-right" },
  { href: "/compromissos", label: "Compromissos", icon: "calendar2-check" },
  { href: "/dividas", label: "Dívidas", icon: "receipt" },
  { href: "/metas", label: "Metas", icon: "bullseye" },
  { href: "/plano", label: "Meu plano", icon: "signpost-split" },
  { href: "/carteira", label: "Carteira", icon: "pie-chart" },
  { href: "/relatorios", label: "Relatórios", icon: "bar-chart-line" },
];
const settings = [
  { href: "/conexoes", label: "Conexões", icon: "link-45deg" },
  { href: "/perfil", label: "Perfil financeiro", icon: "sliders2" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionGate>{children}</SessionGate>
    </SessionProvider>
  );
}

function SessionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useSession();
  const [sessionError, setSessionError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const current = [...navigation, ...settings].find(
    (item) => item.href === pathname,
  );
  const authRoute = pathname === "/login" || pathname === "/cadastro";
  const onboardingRoute = pathname === "/onboarding";
  const unknownRoute = !current && !authRoute && !onboardingRoute;
  const onboarding = useOnboarding(
    !!session?.authenticated && !authRoute && !unknownRoute,
  );

  useEffect(() => {
    if (session && !session.authenticated && !authRoute && !unknownRoute) {
      router.replace(
        pathname === "/"
          ? "/login"
          : `/login?next=${encodeURIComponent(pathname)}`,
      );
    }
  }, [session, authRoute, unknownRoute, pathname, router]);

  useEffect(() => {
    if (
      session?.authenticated &&
      !authRoute &&
      !unknownRoute &&
      !onboardingRoute &&
      !onboarding.loading &&
      !onboarding.error &&
      !onboarding.completed
    ) {
      router.replace("/onboarding");
    }
  }, [
    session,
    authRoute,
    unknownRoute,
    onboardingRoute,
    onboarding.loading,
    onboarding.error,
    onboarding.completed,
    router,
  ]);

  async function disconnect() {
    setSigningOut(true);
    setSessionError("");
    try {
      await signOut();
      setMobileOpen(false);
      router.replace("/login");
    } catch (cause) {
      setSessionError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível sair. Tente novamente.",
      );
    } finally {
      setSigningOut(false);
    }
  }

  if (authRoute || unknownRoute) return children;
  if (!session?.authenticated || (!onboardingRoute && onboarding.loading))
    return (
      <div className="initial-loading" role="status">
        <span className="brand-mark">
          <span />
          <span />
          <span />
        </span>
        <p>Preparando seu espaço…</p>
      </div>
    );
  if (onboardingRoute) return children;
  if (onboarding.error)
    return (
      <main className="onboarding-gate stack">
        <h1>Vamos retomar sua configuração</h1>
        <Alert tone="error">{onboarding.error.message}</Alert>
        <Button onClick={onboarding.refresh}>Tentar novamente</Button>
        <Button variant="ghost" onClick={disconnect} disabled={signingOut}>
          Sair da conta
        </Button>
        {sessionError && <Alert tone="error">{sessionError}</Alert>}
      </main>
    );
  if (!onboarding.completed)
    return (
      <div className="initial-loading" role="status">
        Abrindo sua configuração inicial…
      </div>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir para o conteúdo
      </a>
      {mobileOpen && (
        <button
          className="nav-scrim"
          aria-label="Fechar navegação"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link href="/" className="brand" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          finflow<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Icon name="person" />
          </span>
          <div>
            {session.user.name}
            <small>Finanças pessoais</small>
          </div>
          <Icon name="chevron-down" />
        </div>
        <nav aria-label="Navegação principal">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
              aria-current={pathname === item.href ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              onClick={() => setMobileOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {pathname === item.href && <span className="nav-current-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <nav aria-label="Preferências">
            {settings.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${pathname === item.href ? "active" : ""}`}
                aria-current={pathname === item.href ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                onClick={() => setMobileOpen(false)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <Icon name="shield-check" />
            <span>Você decide cada movimento.</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Button
            variant="ghost"
            className="mobile-menu"
            aria-label="Abrir navegação"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="list" />
          </Button>
          <div className="breadcrumb">
            Meu espaço <Icon name="chevron-right" />{" "}
            <span>{current?.label ?? "FinFlow"}</span>
          </div>
          <div className="topbar-end">
            <span
              className={`connection-status ${session?.authenticated ? "connected" : ""}`}
            >
              <span />
              {session === null
                ? "Verificando conexão"
                : session.authenticated
                  ? "Sessão conectada"
                  : "Não conectado"}
            </span>
            {session.authenticated && (
              <Button
                variant="ghost"
                onClick={disconnect}
                disabled={signingOut}
                aria-label="Encerrar sessão"
              >
                <Icon name="box-arrow-right" />
              </Button>
            )}
            <span
              className="profile-avatar"
              aria-label={session.user.name}
              title={session.user.email}
            >
              <Icon name="person" />
            </span>
          </div>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          {sessionError && session?.authenticated && (
            <Alert tone="error">{sessionError}</Alert>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <span>FinFlow</span>
          <span>Clareza para decidir. Controle para agir.</span>
        </footer>
      </div>
    </div>
  );
}
