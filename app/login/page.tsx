import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata = { title: "Entrar | FinFlow" };

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="initial-loading" role="status">
          Carregando…
        </div>
      }
    >
      <AuthScreen mode="login" />
    </Suspense>
  );
}
