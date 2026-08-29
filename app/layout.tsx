import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinFlow — Seu dinheiro, com clareza',
  description: 'Painel financeiro pessoal conectado à API FinFlow.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
