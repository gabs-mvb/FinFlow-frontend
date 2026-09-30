import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "FinFlow — Seu dinheiro, com clareza",
  description: "Organize suas contas, acompanhe os gastos e crie um plano financeiro que você pode revisar a qualquer momento.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7FAF8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
