import Link from "next/link";
import styles from "./landing-page.module.css";

const features = [
  ["Contas e gastos", "Acompanhe saldos por conta, registre transações e importe seu histórico em CSV ou JSON."],
  ["Compromissos e dívidas", "Organize vencimentos, contas recorrentes e parcelas antes de decidir quanto gastar."],
  ["Reserva, metas e investimentos", "Separe o dinheiro para imprevistos, acompanhe suas metas e registre sua carteira."],
  ["Relatórios do mês", "Veja entradas, despesas e aportes para entender o que mudou e ajustar o próximo plano."],
];

export function LandingPage() {
  return (
    <div className={styles.landing}>
      <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="FinFlow, início">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          finflow.
        </Link>
        <nav aria-label="Navegação do site">
          <a className={styles.desktopLink} href="#como-funciona">Como funciona</a>
          <a className={styles.desktopLink} href="#recursos">Recursos</a>
          <Link href="/login" className={styles.login}>Entrar</Link>
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <h1 id="hero-title">Seu dinheiro,<br />com calma.</h1>
            <p>Saiba o que cabe no seu dia sem perder de vista o mês. Reúna suas contas, organize os compromissos e crie um plano para o seu momento.</p>
            <Link className={styles.primary} href="/cadastro">Criar minha conta</Link>
            <a className={styles.secondary} href="#como-funciona">Conhecer o FinFlow</a>
            <small>Seu plano pode mudar. Você continua no controle.</small>
          </div>
          <figure className={styles.preview}>
            <div className={styles.period} aria-hidden="true"><span>Hoje</span><span /> <span>Próximo recebimento</span></div>
            <div className={styles.phone}>
              <div className={styles.phoneTop} aria-hidden="true"><span>finflow.</span><span className={styles.phoneDot} /></div>
              <p className={styles.greeting}>Um dia de cada vez.</p>
              <div className={styles.daily}>
                <span>Você pode gastar hoje</span>
                <strong>R$ 65,00</strong>
                <p>Com os compromissos previstos no seu plano.</p>
              </div>
              <div className={styles.ledger}>
                <p>Antes do próximo recebimento</p>
                <div><span>Contas e compromissos</span><strong>R$ 1.200,00</strong></div>
                <div><span>Para sua reserva</span><strong>R$ 300,00</strong></div>
                <div><span>Disponível para o período</span><strong>R$ 650,00</strong></div>
              </div>
              <div className={styles.planNote}><span aria-hidden="true">✓</span> Priorize as contas do mês e mantenha um valor para imprevistos.</div>
            </div>
            <figcaption>Exemplo ilustrativo. Seu plano usa os dados que você informa.</figcaption>
          </figure>
        </section>
        <section id="como-funciona" className={styles.how} aria-labelledby="how-title">
          <div><h2 id="how-title">Um plano que começa<br />pela sua realidade.</h2><p>Organizar não precisa virar mais uma tarefa difícil no seu dia.</p></div>
          <ol className={styles.steps}>
            <li><h3>Conte como está hoje</h3><p>Cadastre suas contas, renda e compromissos. O saldo vem das contas cadastradas.</p></li>
            <li><h3>Veja o que faz sentido agora</h3><p>Gere um plano para a data escolhida, com sugestões para gastos, reserva e investimentos. A IA considera seu perfil e os dados disponíveis quando habilitada.</p></li>
            <li><h3>Revise do seu jeito</h3><p>Entenda os motivos, edite os valores e acompanhe as revisões. Recalcule quando sua situação mudar.</p></li>
          </ol>
        </section>
        <section id="recursos" className={styles.resources} aria-labelledby="resources-title">
          <div className={styles.sectionIntro}><h2 id="resources-title">Do gasto de hoje<br />aos próximos planos.</h2><p>No celular ou no computador, suas informações ficam juntas para ajudar na próxima decisão.</p></div>
          <dl className={styles.featureList}>{features.map(([title, description]) => <div key={title}><dt>{title}</dt><dd>{description}</dd></div>)}</dl>
        </section>
        <section className={styles.faq} aria-labelledby="faq-title">
          <h2 id="faq-title">Antes de começar</h2>
          <div>
            <details><summary>Preciso conectar meu banco?</summary><p>Você pode começar cadastrando as contas e as transações manualmente ou importando um arquivo. No app Android, a leitura de notificações de bancos compatíveis é opcional e depende da sua autorização.</p></details>
            <details><summary>Posso alterar o plano sugerido?</summary><p>Sim. Você pode revisar os valores, as categorias, as recomendações e as ações do plano. O histórico ajuda a acompanhar essas mudanças.</p></details>
            <details><summary>O FinFlow movimenta meu dinheiro?</summary><p>Não. O plano oferece orientações. Aprovar uma sugestão ou marcar um compromisso como pago registra sua decisão e não faz transferências ou investimentos no banco.</p></details>
            <details><summary>Consigo usar pelo celular?</summary><p>Sim. O site se adapta à tela do celular, com navegação inferior, formulários e todas as áreas de gestão financeira acessíveis pelo navegador.</p></details>
          </div>
        </section>
        <section className={styles.closing} aria-labelledby="start-title"><div><h2 id="start-title">Comece pelo que você sabe hoje.</h2><p>Cadastre suas contas. O próximo passo fica mais claro.</p></div><Link href="/cadastro" className={styles.primary}>Criar minha conta</Link></section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.brand}>finflow.</Link><span>Você decide cada movimento.</span><Link href="/login">Acessar minha conta</Link></footer>
    </div>
  );
}
