import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata = { title: "Criar conta | FinFlow" };

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="initial-loading" role="status">
          Carregando…
        </div>
      }
    >
      <AuthScreen mode="register" />
    </Suspense>
  );
}
