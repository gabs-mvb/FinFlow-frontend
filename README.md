# FinFlow Frontend

Interface em português para o [FinFlow Backend](../FinFlow-backend), com contas, extrato, compromissos, dívidas, metas, carteira e planejamento financeiro. Os dados exibidos e as operações vêm da API; não há saldos demonstrativos misturados aos dados do usuário.

O projeto usa React, TypeScript e Next.js App Router. O navegador acessa um proxy na mesma origem; a URL do backend e a comunicação com `Authorization: Bearer` ficam no servidor do frontend.

## Rodar localmente

Pré-requisitos: Node.js **22.13 ou superior**, npm, Java **17 ou superior** e PostgreSQL. O repositório do backend inclui um Compose para PostgreSQL 17.

### Backend

Em um terminal PowerShell, na pasta `FinFlow-backend`:

```powershell
docker compose up -d
$env:DATABASE_URL = 'jdbc:postgresql://localhost:5432/finflow'
$env:DATABASE_USERNAME = 'finflow'
$env:DATABASE_PASSWORD = 'finflow'
$env:JWT_SECRET = 'configure-um-segredo-forte-compativel-com-o-backend'
.\gradlew.bat bootRun
```

As credenciais `finflow/finflow` correspondem ao `compose.yml` do backend. Se estiver usando outro PostgreSQL, informe as credenciais desse banco. A API local fica em `http://localhost:8080` e a saúde pode ser consultada em `http://localhost:8080/actuator/health`.

O módulo authentication usa JWT_SECRET e JWT_EXPIRATION. Preserve as configurações exigidas pelo backend e mantenha o segredo fora do frontend.

### Frontend

Na pasta `FinFlow-frontend`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 3000
```

Configure `.env.local`:

```dotenv
FINFLOW_API_URL=http://localhost:8080
```

A variável aceita a origem do backend ou uma base terminada em `/api/v1`. Ela é obrigatória em produção; em desenvolvimento, o padrão é `http://localhost:8080`. Reinicie o servidor do frontend após alterar o ambiente. Abra `http://127.0.0.1:3000/login` e entre com e-mail e senha; o cadastro fica em `/cadastro`.

O frontend chama o backend pelo servidor, então o navegador não depende do CORS do backend. A URL não é recebida do navegador e não deve usar o prefixo público `NEXT_PUBLIC_`.

### Vercel

O projeto usa o build nativo do Next.js. O `vercel.json` fixa o preset `nextjs`, executa `npm ci` na instalação e `npm run build` no build, inclusive quando o painel da Vercel contém comandos antigos. Configure `FINFLOW_API_URL` nas variáveis de ambiente do projeto com a URL HTTPS pública do backend e selecione Node.js 22. O valor `http://localhost:8080` serve apenas para desenvolvimento local; na Vercel, `localhost` aponta para a própria função do frontend.

## Acesso e sessão

- `/cadastro` envia nome (até 100 caracteres), e-mail (até 150) e senha para `POST /api/auth/register`. A confirmação é validada no navegador e não é enviada. O cadastro retorna usuário sem token; após o sucesso, a tela de login abre com o e-mail preenchido.
- `/login` chama `POST /api/auth/login`. O servidor do frontend recebe `{ id, name, email, token }`, guarda o JWT em cookie `HttpOnly` e devolve ao navegador somente usuário e expiração. Senhas não são persistidas.
- As chamadas financeiras exigem sessão e usam `Authorization: Bearer <token>`. O frontend não aceita a antiga chave de API nem o acesso automático por `FINFLOW_API_KEY`.
- `GET /api/finflow/session` verifica o JWT em uma rota protegida do backend. O cookie usa `SameSite=Strict`, `Secure` em produção e expira junto ao token, limitado a 24 horas. A leitura do campo `exp` controla o prazo do cookie; a assinatura é validada pelo backend.
- Logout remove a sessão e limpa o cache. Respostas 401 e o vencimento do JWT levam ao login. Como não há endpoint de refresh ou revogação, a renovação exige novo login e sair encerra apenas a sessão deste navegador.
- Login e cadastro passam por rotas locais `/api/finflow/auth/login` e `/api/finflow/auth/register`, com validação de origem, tamanho e dados. Cookies e tokens nunca vão para localStorage ou respostas de login do frontend. Use HTTPS em produção.

### Pontos de integração no backend atual

A inspeção encontrou duas configurações globais de `SecurityFilterChain`: `authentication/security/SecurityConfig.kt` (JWT) e `shared/security/ApiKeySecurityConfig.kt` (chave). Elas precisam de escopo/ordem coerentes ou de unificação para liberar `/api/auth/**` e validar JWT nas rotas `/api/v1/**`. O frontend não envia a chave antiga como alternativa.

O `ApiExceptionHandler` genérico também captura exceções da autenticação. O backend deve preservar os status de credenciais inválidas (401), conta desativada (403) e e-mail existente (400/409), em vez de convertê-los em 500. A interface trata ambos os casos, mas só apresenta uma causa específica quando a API a informa.

O cadastro de usuários não cria, por si só, isolamento dos dados financeiros: os repositórios financeiros inspecionados ainda não filtram por usuário. Essa associação precisa existir no backend antes de disponibilizar a aplicação a vários proprietários. Nenhum arquivo do backend foi alterado nesta implementação.

## Fluxo de uso

1. Configure a renda, o dia de recebimento, os limites e as preferências em **Perfil**.
2. Adicione contas e saldos, distinguindo dinheiro do dia a dia, reserva, metas e investimentos.
3. Cadastre compromissos, dívidas e metas; importe as transações para montar o extrato.
4. Configure posições e percentuais da carteira, se usar recomendações de aporte.
5. Gere o plano e revise as intenções propostas. Depois de alterar as informações financeiras, gere um novo plano para recalcular as recomendações.
6. Consulte o relatório do mês para revisar despesas, aportes e prioridades.

## Funcionalidades e contratos

| Área         | Operações disponíveis                                                             |
| ------------ | --------------------------------------------------------------------------------- |
| Visão geral  | Resumo dos dados financeiros, compromissos e último plano                         |
| Contas       | Listar, buscar, filtrar por finalidade, cadastrar e atualizar o saldo absoluto    |
| Transações   | Consultar por período/categoria e importar transações com controle de duplicidade |
| Compromissos | Cadastrar, listar, identificar vencidos e registrar pagamento                     |
| Dívidas      | Cadastrar, listar, acompanhar taxa/parcela/prioridade e registrar quitação        |
| Metas        | Criar e atualizar o total acumulado até o valor-alvo                              |
| Carteira     | Consultar e substituir posições/metas, com revisão antes de salvar                |
| Plano        | Gerar por data, consultar o último cálculo e aprovar/recusar intenções            |
| Relatórios   | Consultar receitas, despesas por categoria, aportes e prioridades mensais         |
| Conexões     | Consultar o estado da integração e registrar/atualizar consentimentos locais      |
| Perfil       | Consultar e configurar orçamento, reserva, risco e modo de acompanhamento         |

As requisições correspondem às rotas `/api/v1` do backend. A API não possui paginação: filtros de transações são enviados ao servidor; busca de contas e filtros simples de listagens são locais. Valores são exibidos em `pt-BR`, com saldos de moedas diferentes separados.

### Importação de transações

Cada lote é enviado para `POST /transactions/imports` com `Idempotency-Key`. A chave é preservada ao repetir o mesmo envio; uma alteração no conteúdo deve gerar uma nova chave. O backend aceita de 1 a 1.000 itens por lote e exige que a moeda de cada transação seja igual à moeda da conta. Valores são positivos; `CREDIT` ou `DEBIT` define a direção. A combinação de conta e identificador externo evita duplicações.

O proxy aceita corpos de até 1 MB. A importação altera o extrato, mas **não altera automaticamente o saldo da conta**. Revise os saldos após importar dados quando necessário.

### Limites que a interface preserva

- Aprovar uma intenção registra a decisão. O backend não executa pagamentos, transferências ou ordens de investimento; `executionAvailable` permanece falso.
- O modo piloto automático é uma preferência registrada, sem permissões bancárias adicionais.
- Consentimentos são registros locais. Cadastrar, renovar ou revogar um registro aqui não realiza a autorização no banco. A sincronização real depende de um adaptador externo ainda não fornecido pelo backend.
- Marcar compromisso ou dívida como pago não movimenta saldo. O saldo da conta deve ser atualizado separadamente.
- Carteira usa substituição integral: posições e metas removidas da edição deixam de existir ao salvar. Os percentuais-alvo devem somar 100%, com mínimo ≤ alvo ≤ máximo.
- Atualizar uma meta informa o valor total já acumulado, não um aporte adicional.
- O plano usa apenas a moeda do perfil e só considera contas de finalidade operacional como dinheiro disponível para o mês. Contas de reserva, metas e investimentos permanecem separadas.
- O último plano guarda o cálculo anterior. Alguns saldos retornados pelo backend são consultados ao vivo; a data de geração identifica quando as recomendações foram calculadas.
- Antes do primeiro cadastro, perfil ausente retorna 404; antes do primeiro plano, a API retorna 204. A interface trata esses estados como início da configuração.
- A API não oferece exclusão nem edição completa de contas, transações, dívidas e compromissos. A interface limita as ações aos contratos existentes.

## Organização do código

```text
app/                       Rotas de páginas e endpoints locais
app/api/finflow/            Sessão e proxy para o backend
components/features/       Interfaces por domínio financeiro
components/ui.tsx          Controles, formulários e estados compartilhados
hooks/use-resource.ts      Cache de consultas e invalidação após alterações
lib/finflow/types.ts        Contratos TypeScript da API Kotlin
lib/finflow/api.ts          Cliente HTTP e tratamento de Problem Details
lib/finflow/server.ts       Comunicação com o backend e cookie de sessão
lib/finflow/format.ts       Formatação e nomes de domínio
app/globals.css            Sistema visual e layouts responsivos
```

O cache de consultas vive em memória por navegador, reutiliza respostas por 30 segundos e deduplica solicitações simultâneas para o mesmo recurso. As alterações invalidam os domínios afetados, e respostas iniciadas antes da alteração são descartadas. Retornar à janela ou recuperar a conexão revalida os dados. Trocar ou encerrar a sessão limpa os dados privados do cache.

O cliente centraliza timeouts, cancelamento, respostas sem conteúdo e erros `application/problem+json`. O proxy mantém a chave no fluxo do servidor, preserva `Idempotency-Key` e não repete mutações automaticamente. Componentes compartilham estados de carregamento, vazio, erro e salvamento.

A direção visual usa tipografia, contraste e hierarquia adequados a dados financeiros. A skill `frontend-design`, instalada de `anthropics/skills`, está em `.agents/skills/frontend-design/SKILL.md`.

## Verificação

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

O build é feito pelo Next.js. Para iniciar o resultado local, use `npm run start`. Esses comandos não publicam a aplicação.

Para verificar o backend separadamente:

```powershell
.\gradlew.bat test
```

Em uma validação de integração, use uma base isolada: cadastro, importação, quitação e revisão de intenções persistem registros. Não há endpoint de limpeza no backend.
