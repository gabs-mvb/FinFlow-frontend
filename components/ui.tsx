"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return <i className={`bi bi-${name} ${className}`} aria-hidden="true" />;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props} />
  );
}

export function PageHeading({
  title,
  description,
  actions,
  embedded = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  embedded?: boolean;
}) {
  if (embedded)
    return actions ? (
      <div className="onboarding-record-actions">{actions}</div>
    ) : null;
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </header>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="modal-content">
        <header className="modal-heading">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <Button
            type="button"
            variant="ghost"
            aria-label="Fechar janela"
            onClick={onClose}
          >
            <Icon name="x-lg" />
          </Button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Alert({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "error" | "success" | "info";
}) {
  return (
    <div
      className={`alert alert-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon
        name={
          tone === "error"
            ? "exclamation-circle"
            : tone === "success"
              ? "check-circle"
              : "info-circle"
        }
      />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ResourceState({
  resource,
  children,
  empty = false,
}: {
  resource: {
    isLoading: boolean;
    error: Error | null;
    data: unknown;
    refresh: () => void;
  };
  children: ReactNode;
  empty?: boolean;
}) {
  if (resource.isLoading && resource.data === undefined)
    return (
      <div className="loading-state" role="status">
        <span className="loading-line" />
        <span className="loading-line" />
        <span className="loading-line" />
        <span className="sr-only">Carregando dados…</span>
      </div>
    );
  if (resource.error)
    return (
      <Alert tone="error">
        <p>{resource.error.message}</p>
        <Button variant="secondary" onClick={resource.refresh}>
          Tentar novamente
        </Button>
      </Alert>
    );
  if (empty)
    return (
      <EmptyState
        title="Ainda não há registros"
        description="Os registros adicionados aparecerão aqui."
      />
    );
  return <>{children}</>;
}

export function Stat({
  label,
  value,
  detail,
  tone = "",
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className={`stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function SubmitForm({
  children,
  onSubmit,
  onCancel,
  submitLabel = "Salvar",
  initialError,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  initialError?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const submitting = useRef(false);
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        const data = new FormData(event.currentTarget);
        submitting.current = true;
        setBusy(true);
        setError("");
        try {
          await onSubmit(data);
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Não foi possível salvar. Tente novamente.",
          );
        } finally {
          submitting.current = false;
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="form-fields">
        {children}
      </fieldset>
      {error && <Alert tone="error">{error}</Alert>}
      <footer className="form-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </Button>
        <Button disabled={busy}>{busy ? "Salvando…" : submitLabel}</Button>
      </footer>
    </form>
  );
}

export function CurrencyField({
  value = "BRL",
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <Field label="Moeda">
      <select
        name="currency"
        {...(onChange
          ? { value, onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value) }
          : { defaultValue: value })}
      >
        <option value="BRL">BRL — Real</option>
        <option value="USD">USD — Dólar</option>
        <option value="EUR">EUR — Euro</option>
      </select>
    </Field>
  );
}

/** Converts the Brazilian decimal notation used in forms into a number. */
export function parseCurrencyAmount(value: unknown): number {
  const input = String(value ?? "").trim();
  if (!input) return Number.NaN;
  const clean = input.replace(/[^\d,.-]/g, "");
  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  const separator = Math.max(comma, dot);
  const integer =
    separator < 0
      ? clean
      : clean.slice(0, separator).replace(/[.,]/g, "");
  const fraction = separator < 0 ? "" : clean.slice(separator + 1).replace(/[.,]/g, "");
  return Number(`${integer}${fraction ? `.${fraction}` : ""}`);
}

type CurrencyAmountInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  currency: string;
  value?: string;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
};

/**
 * A money field with a live currency mask. Each digit is treated as cents,
 * like bank and card-payment inputs (e.g. 123456 becomes R$ 1.234,56).
 */
export function CurrencyAmountInput({
  currency,
  value,
  defaultValue = "",
  onValueChange,
  onFocus,
  onBlur,
  inputMode = "decimal",
  ...props
}: CurrencyAmountInputProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue));
  const raw = value ?? uncontrolledValue;
  const parsed = parseCurrencyAmount(raw);
  const displayed =
    !raw || !Number.isFinite(parsed)
      ? raw
      : new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency,
        }).format(parsed);

  function change(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    const next = digits
      ? String(Number((Number(digits) / 100).toFixed(2)))
      : "";
    if (value === undefined) setUncontrolledValue(next);
    onValueChange?.(next);
  }

  return (
    <input
      {...props}
      type="text"
      inputMode={inputMode}
      value={displayed}
      onChange={change}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

export function moneyInput(data: FormData, field = "amount") {
  return {
    amount: parseCurrencyAmount(data.get(field)),
    currency: String(data.get("currency") || "BRL"),
  };
}

export function textInput(data: FormData, field: string) {
  return String(data.get(field) ?? "").trim();
}
