# Tasks 018 — Admin Master

> Entregar por módulo, na ordem **1 → 2 → 4 → 3**. Coloque o módulo 1 em uso antes de começar o 2.

## Base

- [ ] **T-018.1** — Migração: `plans`, `admin_audit_logs`, `ai_quotas`
- [ ] **T-018.2** — Ligar `accounts.plan_id` a `plans`; cadastrar o plano único do lançamento
- [ ] **T-018.3** — Dependência `require_admin`
  - Aceite: em **toda** rota `/api/v1/admin/*`; teste prova 403 para papel comum
- [ ] **T-018.4** — Varredura no CI de rota admin sem verificação
  - Aceite: rota nova sem `require_admin` quebra o build
- [ ] **T-018.5** — Serviço de audit log
  - Aceite: registra ação, alvo, motivo, antes/depois, IP; **sem endpoint de UPDATE ou DELETE**
- [ ] **T-018.6** — Layout do Admin com os 4 módulos

## Módulo 1 — Contas e Projetos

- [ ] **T-018.7** — Lista de contas com busca e filtros
- [ ] **T-018.8** — Detalhe da conta
  - Aceite: dados sensíveis mascarados por padrão; revelar gera log
- [ ] **T-018.9** — Ações administrativas (suspender, ajustar limites, conceder slot, resetar senha)
  - Aceite: cada ação com confirmação e registro no audit log
- [ ] **T-018.10** — Impersonation
  - Aceite: motivo obrigatório, banner permanente, expira em 30 min, somente leitura por padrão, tudo logado
- [ ] **T-018.11** — E-mail de notificação ao usuário impersonado
  - ⚠️ depende da `[DECISÃO PENDENTE]` de §5

## Módulo 2 — IA e Custos

- [ ] **T-018.12** — Agregação de `ai_usage_logs` por conta / período / feature
- [ ] **T-018.13** — Conversão USD → BRL com câmbio configurável
- [ ] **T-018.14** — Serviço de cota, verificado antes de cada chamada de IA
  - Aceite: soft limit em 80% avisa; hard limit bloqueia **só a IA**, nunca o produto
- [ ] **T-018.15** — Aviso no app e por e-mail no soft limit
- [ ] **T-018.16** — Tela de unit economics
  - Aceite: destaca contas acima de 25% do ticket

## Módulo 4 — Planos e Pagamentos

- [ ] **T-018.17** — CRUD de planos
  - Aceite: alterar preço, limites e features sem deploy (Art. 3)
- [ ] **T-018.18** — Cupons e trials
- [ ] **T-018.19** — Dashboard MRR / churn / LTV / ARPU
- [ ] **T-018.20** — Painel de inadimplência (integra com a spec 019)

## Módulo 3 — Uso e Telemetria

- [ ] **T-018.21** — Funil de ativação embutido (fonte: spec 003)
- [ ] **T-018.22** — **Saúde do Web Clipper**
  - Aceite: capturas/dia, taxa de erro **por domínio**, últimas falhas — se um fornecedor popular quebra, aparece aqui
- [ ] **T-018.23** — Engajamento: DAU/WAU/MAU e retenção por coorte
- [ ] **T-018.24** — Visualizador do audit log com filtros
- [ ] **T-018.25 [P]** — Atalho para o session replay da conta

## Segurança

- [ ] **T-018.26** — 2FA para contas ADMIN
  - ⚠️ recomendado antes do primeiro cliente pagante

---

## Definition of Done

- [ ] Critérios de aceite da spec §9 atendidos
- [ ] Nenhuma rota admin acessível a não-ADMIN
- [ ] Audit log registrando 100% das ações, sem caminho de edição
- [ ] Cota testada nos dois limites, com IA bloqueada e produto funcionando
- [ ] Zero necessidade de abrir o Postgres na operação do dia a dia
- [ ] Doc de dev escrita
