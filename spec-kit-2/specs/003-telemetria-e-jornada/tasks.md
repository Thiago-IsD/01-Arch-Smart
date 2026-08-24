# Tasks 003 — Telemetria e jornada

## Decisão (timebox: 1 dia)

- [ ] **T-003.1** — Escolher a ferramenta (recomendação: PostHog)
  - Aceite: conta criada, 4 sócios com acesso, replay disponível no plano
- [ ] **T-003.2** — Ratificar a Ação de Valor com a Giovanna
  - Aceite: uma única definição escrita, sem alternativa em aberto

## Backend

- [ ] **T-003.3** — Serviço de tracking server-side
  - Arquivo: `app/services/analytics.py`
  - Aceite: `track(ctx, event_name, properties)` grava em `product_events` **e** envia à ferramenta; falha do envio externo não derruba a requisição
- [ ] **T-003.4** — Migração: `product_events` + colunas novas em `ai_usage_logs`
- [ ] **T-003.5** — Registro de custo de IA
  - Aceite: toda chamada grava `token_count`, `cost_usd`, `latency_ms`, `success`, `feature`, na mesma transação
- [ ] **T-003.6** — `POST /api/v1/events` para eventos de cliente
  - Aceite: `account_id`/`user_id` do contexto, nunca do payload; rate limit básico

## Frontend

- [ ] **T-003.7** — Provider de analytics + `identify()` no login
- [ ] **T-003.8** — Hook `useTrack()` e `screen_viewed` automático no shell
  - Aceite: toda tela emite com `screen`, `load_ms`, `is_empty`, sem a tela precisar lembrar
- [ ] **T-003.9** — Detecção de rage click e abandono de formulário

## Gravação de jornada

- [ ] **T-003.10** — Habilitar session replay
  - Aceite: 100% das sessões durante o beta
- [ ] **T-003.11** — Configurar mascaramento por seletor e `data-private`
  - Aceite: valores financeiros, dados de cliente final, senha e documento mascarados
- [ ] **T-003.12** — ⚠️ **Assistir a uma sessão real e conferir visualmente o mascaramento**
  - Aceite: nada sensível legível no replay. Esta tarefa não pode ser marcada sem alguém ter assistido de fato.

## Painel

- [ ] **T-003.13** — Montar o funil de 11 etapas
  - Aceite: queda percentual entre etapas visível
- [ ] **T-003.14** — Consulta de custo de IA por conta/mês
  - Arquivo: `scripts/queries/ai_cost_por_conta.sql`

## Entrega ao jurídico

- [ ] **T-003.15** — `docs/dev/dados-coletados.md`
  - Conteúdo: cada evento e propriedades · quais campos são pessoais · o que o replay grava e mascara · retenção · ferramenta e onde os dados residem
- [ ] **T-003.16** — Entregar o documento ao Brenno ("Miguel")
  - Aceite: fecha a ação da ata de 18/08

## Verificação

- [ ] **T-003.17** — Percorrer o fluxo inteiro como usuário novo
  - Aceite: os 11 eventos do funil aparecem na ordem, com as propriedades corretas
- [ ] **T-003.18** — Conferir cada evento do dicionário individualmente
  - Aceite: checklist evento a evento — não confie em amostragem

---

## Definition of Done

- [ ] Todos os eventos verificados um a um
- [ ] Funil montado e acessível aos 4 sócios
- [ ] Replay com mascaramento **conferido assistindo a uma sessão**
- [ ] Custo de IA por conta consultável
- [ ] `docs/dev/dados-coletados.md` entregue ao Brenno
- [ ] Nenhuma coleta antes do consentimento (spec 012)
