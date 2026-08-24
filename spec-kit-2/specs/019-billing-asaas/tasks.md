# Tasks 019 — Billing (Asaas)

## Antes de tudo — começar durante a Onda 4

- [ ] **T-019.1** — Criar a conta no Asaas e obter as chaves de sandbox
- [ ] **T-019.2** — Iniciar homologação de PIX e boleto
  - ⚠️ **Fazer em paralelo à Onda 4.** Burocracia bancária leva semanas e não depende de código.
- [ ] **T-019.3** — Definir o preço do plano único — João Lucas
  - Aceite: preço, `max_projects`, cota de IA e features. **Antes do fim do beta**, para testar intenção de pagar com o número real.

## Base

- [ ] **T-019.4** — Migração: colunas em `accounts`, `payments`, `subscription_addons`, `webhook_events`
- [ ] **T-019.5** — Cadastrar o plano em `plans` (spec 018)
- [ ] **T-019.6** — Camada de abstração do gateway
  - Arquivos: `app/services/billing/{gateway,asaas,service}.py`
  - Aceite: nenhum código de negócio importa o SDK do Asaas diretamente

## Assinatura

- [ ] **T-019.7** — Trial de 14 dias no cadastro (sem cartão)
  - Aceite: dias restantes visíveis; avisos em D-3 e D-1
- [ ] **T-019.8** — Transição para `READ_ONLY`
  - Aceite: acessa e **exporta** tudo; não cria projeto novo
- [ ] **T-019.9** — `POST /billing/checkout` com cartão, PIX e boleto
- [ ] **T-019.10** — `POST /billing/cancel` com captura do motivo
  - Aceite: motivo obrigatório, gravado e analisável
- [ ] **T-019.11** — Slot avulso
  - Aceite: entra no `max_projects` efetivo do `GET /me`
- [ ] **T-019.12** — Founder Discount como cupom permanente na conta

## Webhooks e cobrança

- [ ] **T-019.13** — `POST /api/v1/webhooks/asaas`
  - Aceite: assinatura verificada; idempotente por `UNIQUE (provider, event_id)`
- [ ] **T-019.14** — Máquina de estados `BETA → ACTIVE → READ_ONLY`
  - Aceite: cada transição testada individualmente
- [ ] **T-019.15** — Dunning nos prazos de §5
- [ ] **T-019.16** — `price_base` + `tax_amount` + `price_total`
  - Aceite: modelo e tela suportam tributo por fora, mesmo com valor zero (IBS/CBS)

## Frontend

- [ ] **T-019.17** — Tela do plano
- [ ] **T-019.18** — Checkout com escolha de meio de pagamento
  - Aceite: PIX com QR Code e copia-e-cola; boleto com linha digitável
- [ ] **T-019.19** — "Minha assinatura": status, faturas, cancelar
- [ ] **T-019.20** — Modal de upgrade ao bater o limite de projetos
  - Aceite: oferece assinatura **e** slot avulso; conectado ao `quota_limit_hit`

## Telemetria e testes

- [ ] **T-019.21** — Os 6 grupos de eventos de §9
- [ ] **T-019.22** — Ciclo completo em sandbox: assinar, pagar, falhar, estornar, cancelar
- [ ] **T-019.23** — Reenviar manualmente um webhook e provar que não duplica
- [ ] **T-019.24** — Teste em produção com valor baixo, cobrado e estornado
- [ ] **T-019.25** — Conferir MRR do Admin Master contra o painel do Asaas
- [ ] **T-019.26** — Doc de dev + artigos de usuário

---

## Definition of Done

- [ ] Critérios de aceite da spec §10 atendidos
- [ ] Nenhuma chave de gateway no front-end
- [ ] Idempotência provada com reenvio manual
- [ ] Cancelamento e `READ_ONLY` **nunca** apagam dado do usuário
- [ ] Um pagamento real recebido e conferido
