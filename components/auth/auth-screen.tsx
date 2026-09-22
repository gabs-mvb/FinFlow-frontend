"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/finflow/api";
import type { Session } from "@/lib/auth/types";
import { Alert, Button, Icon } from "@/components/ui";
import { safeReturnPath, useSession } from "./session-provider";

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const {
    session,
    error: sessionError,
    notice,
    registeredEmail,
    acceptSession,
    completeRegistration,
  } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const registering = mode === "register";
  const next = safeReturnPath(params.get("next"));
  const nextQuery = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;

  useEffect(() => {
    if (session?.authenticated) router.replace(next);
  }, [session, router, next]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setError("");
    if (registering && !name) {
      setError("Informe seu nome.");
      return;
    }
    if (!password.trim()) {
      setError("Informe sua senha.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError(
        "Sua senha ultrapassa o limite de 72 bytes. Acentos e símbolos podem ocupar mais de um byte.",
      );
      return;
    }
    if (registering && password !== data.get("confirmation")) {
      setError("As senhas não coincidem. Confira a confirmação.");
      form.querySelector<HTMLInputElement>('[name="confirmation"]')?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      if (registering) {
        await api.post("/auth/register", { name, email, password });
        form.reset();
        completeRegistration(email);
        router.replace(`/login${nextQuery}`);
      } else {
        const result = await api.post<Session>("/auth/login", {
          email,
          password,
        });
        if (!result.authenticated)
          throw new Error(
            "Não foi possível iniciar sua sessão. Tente novamente.",
          );
        form.reset();
        acceptSession(result);
        router.replace(next);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível concluir. Tente novamente.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="FinFlow">
        <Link
          href="/login"
          className="brand auth-brand"
          aria-label="FinFlow — entrar"
        >
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          finflow<span className="brand-dot">.</span>
        </Link>
        <div className="auth-story-content">
          <h2>
            Mais clareza para
            <br />o seu próximo passo.
          </h2>
          <p>
            Do dinheiro do dia a dia aos planos para o futuro. Tudo começa com
            uma visão completa.
          </p>
          <div className="auth-flow" aria-hidden="true">
            <div className="auth-flow-source">
              <Icon name="wallet2" />
              <span>Seu dinheiro</span>
            </div>
            <div className="auth-flow-connector" />
            <div className="auth-flow-destinations">
              <div>
                <Icon name="calendar2-check" />
                <span>Compromissos</span>
              </div>
              <div>
                <Icon name="shield-check" />
                <span>Reserva</span>
              </div>
              <div>
                <Icon name="bullseye" />
                <span>Seus planos</span>
              </div>
            </div>
          </div>
        </div>
        <p className="auth-story-footer">Você decide cada movimento.</p>
      </section>
      <section className="auth-form-section">
        <div className="auth-top-link">
          <span>
            {registering ? "Já tem uma conta?" : "Ainda não tem conta?"}
          </span>
          <Link href={`${registering ? "/login" : "/cadastro"}${nextQuery}`}>
            {registering ? "Entrar" : "Criar conta"}
          </Link>
        </div>
        <div className="auth-form-container">
          <span className="auth-form-icon">
            <Icon name={registering ? "person-plus" : "person-circle"} />
          </span>
          <h1>{registering ? "Crie sua conta" : "Bom ter você de volta."}</h1>
          <p className="auth-description">
            {registering
              ? "Comece a organizar suas finanças com o FinFlow."
              : "Entre para acompanhar suas finanças."}
          </p>
          {!registering && notice && (
            <Alert tone={registeredEmail ? "success" : "info"}>{notice}</Alert>
          )}
          {sessionError && <Alert tone="error">{sessionError}</Alert>}
          <form className="auth-form" onSubmit={submit} aria-busy={busy}>
            <fieldset
              disabled={busy || session === null}
              className="form-fields"
            >
              {registering && (
                <label className="field">
                  <span>Seu nome</span>
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    placeholder="Como você se chama?"
                  />
                </label>
              )}
              <label className="field">
                <span>E-mail</span>
                <input
                  key={`${mode}-${registeredEmail}`}
                  name="email"
                  autoComplete="email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={150}
                  defaultValue={!registering ? registeredEmail : ""}
                  placeholder="voce@exemplo.com"
                />
              </label>
              <PasswordField
                name="password"
                label="Senha"
                autoComplete={registering ? "new-password" : "current-password"}
              />
              {registering && (
                <PasswordField
                  name="confirmation"
                  label="Confirme a senha"
                  autoComplete="new-password"
                />
              )}
            </fieldset>
            {error && <Alert tone="error">{error}</Alert>}
            <Button disabled={busy || session === null} className="auth-submit">
              {busy
                ? registering
                  ? "Criando sua conta…"
                  : "Entrando…"
                : registering
                  ? "Criar minha conta"
                  : "Entrar"}
              <Icon name="arrow-right" />
            </Button>
          </form>
          <div className="auth-security">
            <Icon name="shield-lock" />
            <p>Seu acesso é mantido em uma sessão protegida.</p>
          </div>
        </div>
        <footer className="auth-footer">FinFlow • Finanças com clareza</footer>
      </section>
    </main>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete: "new-password" | "current-password";
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          placeholder={
            name === "confirmation"
              ? "Digite a senha novamente"
              : "Digite sua senha"
          }
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${name === "confirmation" ? "confirmação de senha" : "senha"}`}
          aria-pressed={visible}
        >
          <Icon name={visible ? "eye-slash" : "eye"} />
        </button>
      </div>
    </div>
  );
}
