# Spec 003 — Telemetria e gravação da jornada do usuário

| Campo | Valor |
|---|---|
| **Onda** | 1 |
| **Prioridade** | 5 |
| **Esforço** | M (4 dias) |
| **Responsável** | Thiago · conteúdo para a política: Brenno ("Miguel") |
| **Cobre** | `EPIC-TELE`, `EPIC-REPLAY` |

---

## 1. Problema

O beta existe para responder se o produto entrega valor suficiente para alguém pagar. Sem instrumentação, o que chega na reunião de decisão é "acho que a Fulana gostou" e "o Beltrano parou de usar mas não sei por quê".

E há um segundo motivo, específico desta reescrita: estamos refazendo sete telas **sem saber onde as pessoas travavam nas telas antigas**. Se a reescrita sair sem gravação de jornada, vamos refazer tudo de novo daqui a seis meses, igualmente às cegas.

Evento não coletado é evento perdido para sempre. Não dá para reconstruir o funil de setembro em outubro.

## 2. Resultado esperado

Toda tela reescrita já nasce instrumentada. Em qualquer momento do beta, o time responde "quantos chegaram até o orçamento exportado?" em 30 segundos — e consegue **assistir** à sessão de quem não chegou.

## 3. Escopo

**Dentro:**
- Escolha e configuração da ferramenta.
- Camada de tracking de servidor e de cliente.
- Os eventos do dicionário (`product/04-metricas.md` §4).
- **Gravação de sessão com mascaramento de dado sensível.**
- Métricas por tela: `screen_viewed`, tempo até a primeira ação, rage clicks.
- Funil de 11 etapas montado.
- Registro de custo de IA em `ai_usage_logs`.
- Documento de "dados coletados" para a Política de Privacidade.

**Fora:**
- Dashboard de MRR/churn — spec 018.
- A/B testing.
- Consentimento LGPD em si — spec 012 (mas nada coleta antes dele).

## 4. Arquitetura de coleta

### Eventos de servidor vs. cliente

**Servidor** (fatos de negócio, não podem sumir): `account_created`, `legal_terms_accepted`, `project_created`, `environment_created`, `library_item_created`, `project_item_added`, `quantity_calculated`, **`budget_exported`**, `transaction_created`, `ai_fill_requested`, `quota_limit_hit`.

**Cliente** (interação): `screen_viewed`, `onboarding_step_completed`, `error_shown`, rage clicks, abandono de formulário.

Bloqueador de anúncio e aba fechada fazem evento de cliente sumir. `budget_exported` é a Ação de Valor — sai do servidor, sempre.

### Identificação

- Antes do login: `anonymous_id` de sessão.
- No login: `identify(user_id)` com `account_id`, `subscription_status`, `signup_date`, `is_beta_tester`.
- Todo evento carrega `account_id`, `user_id`, `plan_type`, `session_id`, `timestamp`.

## 5. Gravação da jornada

### O que se ganha

Eventos dizem **o que** aconteceu; o replay diz **como**. Com 15 beta-testers, é a fonte mais rica que o beta produz — ninguém consegue relatar com precisão o próprio atrito, e o onboarding 1:1 da Giovanna vai mascarar boa parte dele.

Três leituras que só o replay entrega:
- Onde a pessoa hesitou antes de clicar.
- O que ela clicou achando que era interativo (*rage click*).
- Em que ponto exato ela fechou a aba.

### Mascaramento — obrigatório

Somos **Operadores** dos dados dos clientes finais do arquiteto (Art. 12). Gravar a tela dele sem máscara significa gravar o nome, o telefone e o orçamento de terceiros que nunca consentiram conosco.

| Deve ser mascarado | Como |
|---|---|
| Valores financeiros (receitas, despesas, totais) | `data-private` via `CurrencyInput` e componentes de valor |
| Nome, telefone, e-mail e documento do cliente final | `data-private` no `FormField` e nos cards de cliente |
| Senha e token | máscara padrão da ferramenta + `data-private` |
| CPF/CNPJ do arquiteto | `data-private` |

A marcação sai do design system (spec 002 §8), não de cada tela lembrar. Tela esquece; componente não.

**Verificação obrigatória antes de liberar:** assistir a uma sessão real e confirmar visualmente que nada sensível aparece. Configurar máscara e não conferir é equivalente a não ter configurado.

### Volume

- Durante o beta: 100% das sessões.
- Após o lançamento: amostragem, ou 100% apenas das sessões com `error_shown` ou abandono de funil.

## 6. Métricas por tela

Cada tela reescrita registra automaticamente (via o shell da spec 006):

| Métrica | Evento |
|---|---|
| Visualização e tempo de carga | `screen_viewed` com `screen`, `load_ms`, `is_empty` |
| Tempo até a primeira ação útil | propriedade `time_to_first_action_ms` |
| Erro visível | `error_shown` com `error_code`, `screen` |
| Rage click | `rage_click_detected` com `screen`, `element` |
| Abandono de formulário | `form_abandoned` com `form`, `last_field` |

`is_empty` é o mais subestimado: cruzado com abandono, mostra quantas pessoas desistem porque a tela estava vazia — que é o problema número um de produto vertical novo.

## 7. Custo de IA (Art. 9)

Toda chamada a LLM grava em `ai_usage_logs` **na mesma transação** da resposta:

```sql
ALTER TABLE ai_usage_logs
  ADD COLUMN account_id UUID NOT NULL REFERENCES accounts(id),
  ADD COLUMN latency_ms INTEGER,
  ADD COLUMN success BOOLEAN DEFAULT TRUE,
  ADD COLUMN feature TEXT;

CREATE INDEX idx_ai_usage_account_created ON ai_usage_logs (account_id, created_at);
```

Se a gravação falhar, a chamada falha. Não existe uso de IA não contabilizado.

## 8. Tabela própria em paralelo

```sql
CREATE TABLE product_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id),
    user_id UUID REFERENCES users(id),
    event_name TEXT NOT NULL,
    properties JSONB,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_events_name_created ON product_events (event_name, created_at);
CREATE INDEX idx_events_account ON product_events (account_id, created_at);
```

Custa pouco e garante que o dado do beta seja seu, mesmo que a ferramenta escolhida se mostre cara ou ruim. Em 15 usuários o volume é irrelevante.

## 9. Ferramenta

`[DECISÃO PENDENTE — timebox de 1 dia]` **Recomendação: PostHog.** É a única candidata que entrega eventos, funil e session replay no mesmo lugar, com free tier generoso e opção de self-host. Usar duas ferramentas para o que uma resolve significa dois consentimentos, dois contratos e dois lugares para olhar.

O dicionário de eventos é portável entre ferramentas. **Decida rápido e siga** — o erro caro não é escolher errado, é chegar em setembro sem nenhuma.

## 10. Entrega para o jurídico

Ação registrada na ata de 18/08: *"Definir dados coletados e comunicar os requisitos ao Miguel para inclusão na política de privacidade"* — **Miguel é o Brenno**.

Esta spec entrega um documento `docs/dev/dados-coletados.md` com: cada evento e suas propriedades, quais campos são pessoais, o que o replay grava e o que mascara, retenção de cada base, e a ferramenta usada com onde os dados residem.

Entregar isso resolve a ação da ata e é o insumo exato que a Política de Privacidade precisa.

## 11. Critérios de aceite

- [ ] Ferramenta escolhida, configurada, acessível aos 4 sócios.
- [ ] Todos os eventos do dicionário emitindo, **verificados um a um** (não por amostragem).
- [ ] Eventos de negócio saindo do servidor.
- [ ] `identify()` no login com as propriedades de conta.
- [ ] Funil de 11 etapas montado e visível.
- [ ] Replay gravando, **com mascaramento verificado manualmente numa sessão real**.
- [ ] `screen_viewed`, rage click e abandono de formulário funcionando.
- [ ] `ai_usage_logs` gravando `cost_usd` e `latency_ms` em toda chamada.
- [ ] Consulta salva: custo de IA por conta ativa no último mês.
- [ ] `product_events` gravando em paralelo.
- [ ] `docs/dev/dados-coletados.md` escrita e entregue ao Brenno.
- [ ] Nenhuma coleta acontece antes do consentimento (spec 012).

## 12. Riscos

- **Risco:** instrumentar "depois". → Por isso está na Onda 1, antes da primeira tela.
- **Risco:** replay vazar dado de cliente final. → Mascaramento no design system + verificação manual obrigatória.
- **Risco:** medir demais e não olhar. → O funil e o replay são revisados na weekly. Se o time não abrir o painel semanalmente, o problema não é a ferramenta.
- **Risco:** discussão longa sobre ferramenta. → Timebox de 1 dia.
