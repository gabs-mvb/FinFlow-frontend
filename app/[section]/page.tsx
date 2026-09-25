import { notFound } from "next/navigation";
import { TransactionsPage } from "@/components/features/transactions";
import { CommitmentsPage } from "@/components/features/commitments";
import { GoalsPage } from "@/components/features/goals";
import { ProfilePage } from "@/components/features/profile";
import { PlanPage } from "@/components/features/plan";
import { PortfolioPage } from "@/components/features/portfolio";
import { ReportsPage } from "@/components/features/reports";
import { ConnectionsPage } from "@/components/features/connections";

const pages: Record<string, React.ComponentType> = {
  transacoes: TransactionsPage,
  compromissos: () => <CommitmentsPage kind="obligations" />,
  dividas: () => <CommitmentsPage kind="debts" />,
  metas: GoalsPage,
  perfil: ProfilePage,
  plano: PlanPage,
  carteira: PortfolioPage,
  relatorios: ReportsPage,
  conexoes: ConnectionsPage,
};

export default async function Section({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!Object.hasOwn(pages, section)) notFound();
  const Page = pages[section];
  return <Page />;
}
