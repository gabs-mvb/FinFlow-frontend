"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/finflow/api";
import { clearResources } from "@/hooks/use-resource";
import type { Session } from "@/lib/auth/types";

interface SessionContextValue {
  session: Session | null;
  error: string;
  notice: string;
  registeredEmail: string;
  acceptSession: (session: Session) => void;
  completeRegistration: (email: string) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const pending = useRef<AbortController | null>(null);

  const acceptSession = useCallback((value: Session) => {
    pending.current?.abort();
    clearResources();
    setError("");
    setNotice("");
    setRegisteredEmail("");
    setSession(value);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    try {
      localStorage.removeItem("finflow-config");
    } catch {
      /* Legacy credential cleanup. */
    }
    api
      .get<Session>("/session", { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setSession(value);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível verificar sua sessão.",
        );
        setSession({ authenticated: false });
      });
    const expire = () => {
      controller.abort();
      clearResources();
      setSession({ authenticated: false });
      setNotice("Sua sessão expirou. Entre novamente para continuar.");
    };
    window.addEventListener("finflow:unauthorized", expire);
    return () => {
      controller.abort();
      window.removeEventListener("finflow:unauthorized", expire);
    };
  }, []);

  useEffect(() => {
    if (!session?.authenticated) return;
    const timer = window.setTimeout(
      () => window.dispatchEvent(new Event("finflow:unauthorized")),
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session]);

  async function signOut() {
    await api.delete("/session");
    acceptSession({ authenticated: false });
  }

  function completeRegistration(email: string) {
    setRegisteredEmail(email);
    setNotice("Conta criada! Entre com seu e-mail e senha para começar.");
    setError("");
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        error,
        notice,
        registeredEmail,
        acceptSession,
        completeRegistration,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context)
    throw new Error("useSession must be used within SessionProvider.");
  return context;
}

const destinations = new Set([
  "/",
  "/contas",
  "/transacoes",
  "/compromissos",
  "/dividas",
  "/metas",
  "/plano",
  "/carteira",
  "/relatorios",
  "/conexoes",
  "/perfil",
]);
export function safeReturnPath(value: string | null) {
  return value && destinations.has(value) ? value : "/";
}
