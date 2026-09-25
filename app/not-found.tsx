import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.brand} aria-label="FinFlow — início">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        finflow.
      </Link>
      <div className={styles.content}>
        <p className={styles.code}>404</p>
        <h1>Página não encontrada</h1>
        <p className={styles.description}>
          Este endereço não existe ou a página foi movida. Confira o link ou
          volte ao início para continuar organizando suas finanças.
        </p>
        <Link href="/" className="button button-primary">
          <i className="bi bi-house-door" aria-hidden="true" />
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
