# Tasks 015 — Calculadora de Precificação

## Bloqueador (antes de qualquer código)

- [ ] **T-015.1** — Sessão de 30 min com a Giovanna, planilha aberta
  - Definir como os 11 fatores se combinam (hipótese híbrida na spec §3)
  - Rodar 3 projetos reais dela, anotando entradas e resultado esperado
  - Aceite: fórmula escrita em ADR + 3 casos em `tests/fixtures/pricing_cases.json`

## Motor

- [ ] **T-015.2** — Migração das 3 tabelas + seed dos itens de sistema (19 serviços/ambientes, 10 custos diretos)
- [ ] **T-015.3** — `app/services/pricing/engine.py` — função pura, `Decimal`
  - Aceite: nenhum import de ORM, sessão ou request; roda em teste sem banco
- [ ] **T-015.4** — ≥15 testes unitários
  - Aceite: projeto mínimo, projeto máximo, todos os `n` de parcelamento; **os 3 casos da Giovanna com <1% de diferença**
- [ ] **T-015.5** — Cálculo de parcelamento (Price)
  - Aceite: `n=1` sem juros; `n=6` confere com cálculo manual
- [ ] **T-015.6** — `GET`/`PUT /api/v1/pricing/settings`
- [ ] **T-015.7** — CRUD de `/api/v1/pricing/items` com copy-on-write
  - Aceite: editar item de sistema cria cópia da conta; original intocado; existe "restaurar padrão"
- [ ] **T-015.8** — `POST /api/v1/pricing/calculate` (sem persistir)
  - Aceite: devolve o breakdown completo, com todas as parcelas intermediárias
- [ ] **T-015.9** — `GET`/`POST /api/v1/pricing/quotes`
  - Aceite: `breakdown` congelado; mudar premissas depois não altera orçamento salvo
- [ ] **T-015.10** — Teste de isolamento entre contas nos 3 endpoints

## Assistente

- [ ] **T-015.11** — Estrutura dos 4 passos + total fixo na lateral
  - Aceite: navegação preserva o preenchimento; funciona em 390px
- [ ] **T-015.12** — Passo 1: premissas pré-preenchidas
- [ ] **T-015.13** — Passo 2: serviços e ambientes com quantidade
- [ ] **T-015.14** — Passo 3: os 11 fatores, cada um com explicação do efeito
  - Aceite: `fieldset`/`legend`, navegável por teclado
- [ ] **T-015.15** — Passo 4: custos diretos + parcelamento
- [ ] **T-015.16** — Preview otimista em TS com debounce de 400 ms
  - Aceite: total atualiza na hora; valor do backend prevalece ao confirmar
- [ ] **T-015.17** — Teste de paridade Python ↔ TS no CI
  - Aceite: divergência >R$ 0,01 quebra o build
- [ ] **T-015.18** — Tela de resultado com memória de cálculo aberta
- [ ] **T-015.19** — Export do orçamento de honorários em PDF
- [ ] **T-015.20 [P]** — Vínculo opcional com projeto existente

## Telemetria, rollout e validação

- [ ] **T-015.21** — Os 4 eventos de §7
- [ ] **T-015.22** — Feature flag `pricing_calculator`, só para a Giovanna
- [ ] **T-015.23** — Validar os 3 projetos reais na plataforma
  - Aceite: <1% de diferença nos 3
- [ ] **T-015.24** — Liberar aos beta-testers com banner de validação
- [ ] **T-015.25** — Perguntar a 5 beta-testers como precificam hoje
  - Aceite: ≥3 reconhecem o método → segue. Senão, revisar antes de investir mais.
- [ ] **T-015.26** — Doc de dev + artigo "Precificando um projeto"

---

## Definition of Done

- [ ] Fórmula ratificada e em ADR antes do código
- [ ] 3 projetos reais batendo com <1%
- [ ] `Decimal` em todo cálculo monetário — zero `float`
- [ ] Orçamento salvo imune a mudança de premissas
- [ ] Paridade Python ↔ TS no CI
- [ ] Usável em celular
- [ ] Banner de validação retirado só após 10 orçamentos sem correção
