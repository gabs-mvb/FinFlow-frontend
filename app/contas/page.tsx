'use client';

import {FormEvent, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';

type Money = {amount: number; currency: string};
type Account = {
  id: string;
  institution: string;
  externalId: string;
  name: string;
  accountType: string;
  purpose: string;
  availableBalance: Money;
  lastSyncedAt?: string | null;
};
type Config = {url: string; key: string};
type AccountForm = {institution: string; externalId: string; name: string; accountType: string; purpose: string; amount: string; currency: string};

const emptyForm: AccountForm = {institution: '', externalId: '', name: '', accountType: 'CHECKING', purpose: 'OPERATING', amount: '', currency: 'BRL'};
const typeLabels: Record<string, string> = {CHECKING: 'Conta corrente', SAVINGS: 'Poupança', PAYMENT: 'Conta de pagamento', INVESTMENT: 'Investimentos'};
const purposeLabels: Record<string, string> = {OPERATING: 'Uso do dia a dia', EMERGENCY_RESERVE: 'Reserva de emergência', GOAL: 'Meta financeira', INVESTMENT: 'Investimentos'};
const accountIcons: Record<string, string> = {CHECKING: 'bi-bank', SAVINGS: 'bi-piggy-bank', PAYMENT: 'bi-credit-card', INVESTMENT: 'bi-graph-up-arrow'};

const formatMoney = (value: Money) => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: value.currency}).format(Number(value.amount));
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('pt-BR', {dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value)) : 'Ainda não sincronizada';

export default function AccountsPage() {
  const initialized = useRef(false);
  const [config, setConfig] = useState<Config>({url: 'http://localhost:8080', key: ''});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [purpose, setPurpose] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [balance, setBalance] = useState('');
  const [form, setForm] = useState<AccountForm>(emptyForm);

  const request = useCallback(async <T,>(path: string, current: Config, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-API-Key', current.key);
    headers.set('X-FinFlow-Upstream', current.url.replace(/\/$/, ''));
    if (init?.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(`/api/finflow${path}`, {...init, headers, cache: 'no-store'});
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.detail || payload?.title || `Erro ${response.status}`);
    return payload as T;
  }, []);

  const loadAccounts = useCallback(async (current = config) => {
    if (!current.key) {
      setLoading(false);
      setShowConfig(true);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      setAccounts(await request<Account[]>('/api/v1/accounts', current));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as contas.');
    } finally {
      setLoading(false);
    }
  }, [config, request]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = localStorage.getItem('finflow-config');
    const current = saved ? JSON.parse(saved) as Config : {url: 'http://localhost:8080', key: ''};
    queueMicrotask(() => {
      setConfig(current);
      void loadAccounts(current);
    });
  }, [loadAccounts]);

  const total = useMemo(() => accounts.reduce((sum, account) => sum + Number(account.availableBalance.amount), 0), [accounts]);
  const currencies = useMemo(() => [...new Set(accounts.map(account => account.availableBalance.currency))], [accounts]);
  const filtered = useMemo(() => accounts.filter(account => {
    const matchesQuery = `${account.name} ${account.institution}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (purpose === 'ALL' || account.purpose === purpose);
  }), [accounts, query, purpose]);

  const saveConfig = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem('finflow-config', JSON.stringify(config));
    setShowConfig(false);
    void loadAccounts(config);
  };

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const created = await request<Account>('/api/v1/accounts', config, {method: 'POST', body: JSON.stringify({
        institution: form.institution.trim(), externalId: form.externalId.trim(), name: form.name.trim(),
        accountType: form.accountType, purpose: form.purpose,
        availableBalance: {amount: Number(form.amount), currency: form.currency.toUpperCase()},
        lastSyncedAt: new Date().toISOString(),
      })});
      setAccounts(current => [...current, created]);
      setForm(emptyForm);
      setShowCreate(false);
      setMessage('Conta adicionada com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível adicionar a conta.');
    } finally { setSaving(false); }
  };

  const updateBalance = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMessage('');
    try {
      const updated = await request<Account>(`/api/v1/accounts/${editing.id}/balance`, config, {method: 'PATCH', body: JSON.stringify({
        availableBalance: {amount: Number(balance), currency: editing.availableBalance.currency}, syncedAt: new Date().toISOString(),
      })});
      setAccounts(current => current.map(account => account.id === updated.id ? updated : account));
      setEditing(null);
      setBalance('');
      setMessage('Saldo atualizado com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o saldo.');
    } finally { setSaving(false); }
  };

  const openBalance = (account: Account) => { setEditing(account); setBalance(String(account.availableBalance.amount)); };

  return <div className="app-shell accounts-page">
    <aside className="sidebar">
      <Link className="brand brand-link" href="/"><span className="brand-mark"><i className="bi bi-graph-up-arrow"/></span><span>finflow</span></Link>
      <nav><Link className="nav-link" href="/"><i className="bi bi-grid-1x2-fill"/>Visão geral</Link><Link className="nav-link active" href="/contas"><i className="bi bi-wallet2"/>Contas</Link><Link className="nav-link" href="/#transactions"><i className="bi bi-arrow-left-right"/>Transações</Link><Link className="nav-link" href="/#goals"><i className="bi bi-bullseye"/>Metas</Link><Link className="nav-link" href="/#plan"><i className="bi bi-stars"/>Plano</Link></nav>
      <div className="sidebar-bottom"><button className="nav-link btn-reset" onClick={() => setShowConfig(true)}><i className="bi bi-sliders"/>Conexão API</button><div className="secure-note"><i className="bi bi-shield-check"/><span>Seus dados ficam entre você e sua API.</span></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><Link className="mobile-brand" href="/">finflow</Link><div className="connection"><span className={`status-dot ${config.key ? 'online' : ''}`}/>{config.key ? 'API configurada' : 'API desconectada'}</div><button className="icon-btn" aria-label="Configurar conexão" onClick={() => setShowConfig(true)}><i className="bi bi-gear"/></button><div className="avatar">GF</div></header>
      <div className="content accounts-content">
        <section className="accounts-heading"><div><p className="eyebrow">CONTAS</p><h1>Seu dinheiro, conta por conta.</h1><p className="subtitle">Acompanhe saldos e mantenha cada valor no lugar certo.</p></div><button className="btn-add-account" onClick={() => setShowCreate(true)} disabled={!config.key}><i className="bi bi-plus-lg"/>Adicionar conta</button></section>
        {message && <div className={`accounts-alert ${message.includes('sucesso') ? 'success' : ''}`} role="status"><i className={`bi ${message.includes('sucesso') ? 'bi-check-circle' : 'bi-exclamation-circle'}`}/>{message}<button aria-label="Fechar aviso" onClick={() => setMessage('')}><i className="bi bi-x"/></button></div>}
        <section className="accounts-total"><div><span>Saldo total disponível</span><strong>{currencies.length <= 1 ? formatMoney({amount: total, currency: currencies[0] || 'BRL'}) : 'Várias moedas'}</strong><small>{accounts.length} {accounts.length === 1 ? 'conta conectada' : 'contas conectadas'}</small></div><div className="total-art"><span/><span/><span/><i className="bi bi-wallet2"/></div></section>
        <section className="accounts-toolbar"><label className="account-search"><i className="bi bi-search"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por conta ou banco" aria-label="Buscar contas"/></label><div className="purpose-filters"><button className={purpose === 'ALL' ? 'active' : ''} onClick={() => setPurpose('ALL')}>Todas</button><button className={purpose === 'OPERATING' ? 'active' : ''} onClick={() => setPurpose('OPERATING')}>Dia a dia</button><button className={purpose === 'EMERGENCY_RESERVE' ? 'active' : ''} onClick={() => setPurpose('EMERGENCY_RESERVE')}>Reserva</button><button className={purpose === 'INVESTMENT' ? 'active' : ''} onClick={() => setPurpose('INVESTMENT')}>Investimentos</button></div><button className="refresh-accounts" onClick={() => void loadAccounts()} disabled={loading || !config.key} aria-label="Atualizar contas"><i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}/></button></section>
        <section className="account-list-panel"><div className="account-list-head"><span>Conta</span><span>Finalidade</span><span>Última atualização</span><span className="text-end">Saldo disponível</span><span/></div>
          {loading ? <div className="account-loading"><span/><span/><span/></div> : filtered.length ? filtered.map(account => <article className="account-list-item" key={account.id}><div className="account-identity"><span className="account-type-icon"><i className={`bi ${accountIcons[account.accountType] || 'bi-wallet2'}`}/></span><div><strong>{account.name}</strong><small>{account.institution} · {typeLabels[account.accountType] || account.accountType}</small></div></div><span className={`purpose-badge purpose-${account.purpose.toLowerCase()}`}>{purposeLabels[account.purpose] || account.purpose}</span><span className="account-updated">{formatDate(account.lastSyncedAt)}</span><strong className="account-balance">{formatMoney(account.availableBalance)}</strong><button className="account-more" onClick={() => openBalance(account)} aria-label={`Atualizar saldo de ${account.name}`}><i className="bi bi-pencil"/></button></article>) : <div className="accounts-empty"><span><i className="bi bi-wallet2"/></span><h2>{accounts.length ? 'Nenhuma conta encontrada' : 'Sua primeira conta começa aqui'}</h2><p>{accounts.length ? 'Tente ajustar a busca ou os filtros.' : 'Cadastre uma conta para acompanhar seu saldo disponível.'}</p>{!accounts.length && <button onClick={() => setShowCreate(true)} disabled={!config.key}>Adicionar conta</button>}</div>}
        </section>
      </div>
    </main>
    {showCreate && <Modal title="Adicionar nova conta" subtitle="Preencha os dados conforme aparecem na instituição." icon="bi-plus-lg" onClose={() => setShowCreate(false)}><form className="account-form" onSubmit={createAccount}><div className="form-grid"><Field label="Nome da conta"><input required maxLength={120} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex.: Conta principal"/></Field><Field label="Instituição"><input required maxLength={120} value={form.institution} onChange={e => setForm({...form, institution: e.target.value})} placeholder="Ex.: Nubank"/></Field><Field label="Identificador externo"><input required maxLength={160} value={form.externalId} onChange={e => setForm({...form, externalId: e.target.value})} placeholder="ID único da conta"/></Field><Field label="Tipo de conta"><select value={form.accountType} onChange={e => setForm({...form, accountType: e.target.value})}><option value="CHECKING">Conta corrente</option><option value="SAVINGS">Poupança</option><option value="PAYMENT">Conta de pagamento</option><option value="INVESTMENT">Investimentos</option></select></Field><Field label="Finalidade"><select value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})}><option value="OPERATING">Uso do dia a dia</option><option value="EMERGENCY_RESERVE">Reserva de emergência</option><option value="GOAL">Meta financeira</option><option value="INVESTMENT">Investimentos</option></select></Field><div className="money-fields"><Field label="Saldo disponível"><input required min="0" step="0.01" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0,00"/></Field><Field label="Moeda"><input required minLength={3} maxLength={3} value={form.currency} onChange={e => setForm({...form, currency: e.target.value.toUpperCase()})}/></Field></div></div><div className="modal-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Salvando…' : 'Adicionar conta'}</button></div></form></Modal>}
    {editing && <Modal title="Atualizar saldo" subtitle={`${editing.name} · ${editing.institution}`} icon="bi-pencil" onClose={() => setEditing(null)}><form className="account-form" onSubmit={updateBalance}><Field label={`Novo saldo em ${editing.availableBalance.currency}`}><input autoFocus required min="0" step="0.01" type="number" value={balance} onChange={e => setBalance(e.target.value)}/></Field><p className="balance-note"><i className="bi bi-info-circle"/>A atualização será registrada com a data e hora atuais.</p><div className="modal-actions"><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? 'Atualizando…' : 'Atualizar saldo'}</button></div></form></Modal>}
    {showConfig && <Modal title="Conectar ao FinFlow" subtitle="Use a URL e a mesma chave configurada no backend." icon="bi-plug" onClose={() => setShowConfig(false)}><form className="account-form" onSubmit={saveConfig}><Field label="URL da API"><input required type="url" value={config.url} onChange={e => setConfig({...config, url: e.target.value})}/></Field><Field label="Chave da API"><input required type="password" value={config.key} onChange={e => setConfig({...config, key: e.target.value})} placeholder="X-API-Key"/></Field><div className="modal-actions"><button type="button" onClick={() => setShowConfig(false)}>Cancelar</button><button className="primary">Salvar e conectar</button></div></form></Modal>}
  </div>;
}

function Field({label, children}: {label: string; children: React.ReactNode}) { return <label className="account-field"><span>{label}</span>{children}</label>; }
function Modal({title, subtitle, icon, onClose, children}: {title: string; subtitle: string; icon: string; onClose: () => void; children: React.ReactNode}) { return <div className="modal-backdrop-custom" onMouseDown={onClose}><section className="account-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()}><button className="modal-close" aria-label="Fechar" onClick={onClose}><i className="bi bi-x-lg"/></button><span className="modal-icon"><i className={`bi ${icon}`}/></span><h2>{title}</h2><p>{subtitle}</p>{children}</section></div>; }
