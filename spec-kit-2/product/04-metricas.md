# Métricas, Ação de Valor e Gravação da Jornada

**Versão 2.0 — 23/08/2026**

> A decisão de lançar vai ser tomada com dado ou com impressão. A diferença entre as duas coisas se define **agora**, escolhendo o que medir antes da primeira tela ser reescrita.

---

## 1. A Ação de Valor

> **O usuário exporta o primeiro orçamento completo de um ambiente** (≥5 itens, quantidades calculadas pelo Smart Core) **para WhatsApp, PDF ou Excel.**

Por que este momento:

- É a primeira vez que o produto entrega **algo que ele mandaria para o cliente** — o trabalho sai do sistema e vira dinheiro.
- É o ponto em que o cálculo automático substitui a planilha. É a promessa central.
- Cadastrar projeto, criar ambiente ou capturar produto são etapas de *setup*, não de valor.

`[DECISÃO PENDENTE]` Ratificar com a Giovanna antes do dia 1 do beta. Alternativa: `quantity_calculated` — acontece antes e é mais barata de atingir, mas é menos evidência de valor real. Escolha **uma**; duas Ações de Valor equivalem a nenhuma.

**Time to Value alvo:** menos de 30 minutos do primeiro login à Ação de Valor.

## 2. Árvore de métricas

```
                    ┌─ Ativação ──── % que atinge a Ação de Valor em 7 dias
                    │                  (meta beta: ≥60%)
                    │
Sucesso do Beta ────┼─ Retenção ──── D7 e D30 de usuários ativos
                    │                  (meta: D7 ≥50%, D30 ≥40%)
                    │
                    ├─ Frequência ─── orçamentos exportados / usuário / semana
                    │                  (meta: ≥1)
                    │
                    └─ Intenção ───── % "ficaria muito decepcionado" se sumisse
                                       (meta: ≥40% — teste de Sean Ellis)
```

## 3. Funil de ativação

| # | Etapa | Evento | Meta beta |
|---|---|---|---|
| 1 | Conta criada | `account_created` | 15/15 |
| 2 | Termos aceitos | `legal_terms_accepted` | 15 |
| 3 | Primeiro login | `session_started` (1º) | 15 |
| 4 | Onboarding concluído | `onboarding_completed` | ≥13 |
| 5 | Projeto criado | `project_created` | ≥13 |
| 6 | Ambiente criado com área | `environment_created` | ≥12 |
| 7 | Item na biblioteca | `library_item_created` | ≥12 |
| 8 | Item no ambiente | `project_item_added` | ≥11 |
| 9 | Quantidade calculada | `quantity_calculated` | ≥11 |
| 10 | **🎯 Orçamento exportado** | `budget_exported` | **≥9** |
| 11 | Segundo projeto | `project_created` (2º) | ≥6 |

Cada queda entre etapas consecutivas é um bug de produto esperando para ser encontrado.

## 4. Dicionário de eventos

Nomenclatura: `objeto_verbo_no_passado`, `snake_case`.
**Propriedades obrigatórias em todo evento:** `account_id`, `user_id`, `plan_type`, `session_id`, `timestamp`.

| Evento | Dispara quando | Propriedades | Origem |
|---|---|---|---|
| `account_created` | cadastro concluído | `source` | servidor |
| `legal_terms_accepted` | aceite dos termos | `document_type`, `document_version` | servidor |
| `session_started` | login | `is_first_session` | servidor |
| `screen_viewed` | qualquer tela | `screen`, `load_ms`, `is_empty` | cliente |
| `onboarding_step_completed` | passo do checklist | `step`, `step_index` | cliente |
| `onboarding_completed` | checklist concluído | `duration_minutes`, `skipped` | cliente |
| `project_created` | projeto salvo | `project_id`, `total_area_m2`, `project_index` | servidor |
| `environment_created` | ambiente salvo | `area_m2`, `waste_margin` | servidor |
| `library_item_created` | item entra na biblioteca | `source` (`manual`\|`clipper`), `category`, `has_ai_data` | servidor |
| `clipper_capture_attempted` | captura pela extensão | `domain`, `success`, `fields_extracted` | servidor |
| `ai_fill_requested` | preenchimento por IA | `model_name`, `token_count`, `cost_usd`, `latency_ms`, `success`, `feature` | servidor |
| `library_items_bulk_added` | adição em lote | `items_count`, `used_select_all` | servidor |
| `project_item_added` | item vinculado a ambiente | `quantity`, `from_bulk` | servidor |
| `quantity_calculated` | Smart Core devolve quantidade | `items_count` | servidor |
| `budget_exported` 🎯 | orçamento exportado | `format`, `items_count`, `total_value`, `environments_count` | **servidor** |
| `transaction_created` | lançamento financeiro | `type`, `category`, `linked_to_project` | servidor |
| `pricing_calculated` | Calculadora de Precificação | `total_value`, `factors_used[]` | servidor |
| `error_shown` | erro visível ao usuário | `error_code`, `screen` | cliente |
| `quota_limit_hit` | limite de plano atingido | `limit_type`, `plan_type`, `current`, `max` | servidor |
| `data_export_requested` | portabilidade LGPD | — | servidor |
| `account_deletion_requested` | exclusão de conta | `reason` | servidor |

**Por que eventos de negócio saem do servidor:** bloqueador de anúncio, aba fechada antes do flush e falha de rede fazem eventos de cliente sumirem — e os que mais importam para a decisão são justamente os que não podem sumir. `budget_exported` é a Ação de Valor; ele **tem** que ser server-side.

## 5. Gravação da jornada (session replay)

Os eventos dizem **o que** aconteceu. O replay diz **como** — onde a pessoa hesitou, o que ela clicou achando que era botão, onde leu duas vezes, onde desistiu. Com 15 beta-testers, isso vale mais do que qualquer reunião de feedback, porque ninguém consegue relatar com precisão o próprio atrito.

**O que gravar:**
- Todas as sessões durante o beta (volume baixo, custo irrelevante).
- Após o lançamento, amostragem — ou 100% só das sessões com `error_shown` ou abandono no funil.

**O que mascarar — obrigatório (Art. 12):**

| Deve ser mascarado | Por quê |
|---|---|
| Valores financeiros (receitas, despesas, orçamentos totais) | dado sensível do escritório |
| Nome, telefone, e-mail e documento do **cliente final** | somos Operadores desse dado, não Controladores |
| Campos de senha e token | óbvio, mas some com frequência |
| CPF/CNPJ do arquiteto | dado pessoal |

Implementação: atributo `data-private` nos elementos, configuração de máscara por seletor, e **verificação manual do replay de uma sessão real antes de liberar** — configurar mascaramento e não conferir é como não ter configurado.

O replay tem que estar coberto na Política de Privacidade. Isso é insumo direto para o Brenno (a ação de 18/08 "definir dados coletados e comunicar ao Miguel" se resolve entregando este documento).

**Além do replay, cada tela registra:** tempo até a primeira ação útil, taxa de abandono do formulário, e cliques em elementos não interativos (*rage clicks* — o melhor detector de "isso parecia um botão").

## 6. Métricas de saúde técnica

Coletadas desde a Onda 1, por tela:

| Métrica | Alvo |
|---|---|
| LCP | < 2,0 s no P75, em 4G throttled |
| INP | < 200 ms no P75 |
| CLS | < 0,1 |
| Resposta da API | < 400 ms no P95 |
| Queries por carregamento | < 8 |
| JS por rota | < 200 KB gzip |
| Taxa de erro 5xx | < 0,5% |
| Cold start (Render free tier) | medir e registrar |
| Custo de IA por conta ativa/mês | < 15% do ticket |

O último protege a margem. É a métrica que ninguém olha até a fatura chegar.

## 7. Ferramenta

`[DECISÃO PENDENTE — timebox de 1 dia]` **Recomendação: PostHog.** É a única das candidatas que entrega **eventos + funil + session replay no mesmo lugar**, tem free tier generoso, e pode ser self-hosted se a LGPD apertar. Mixpanel não tem replay nativo; Hotjar não tem funil de produto decente. Usar duas ferramentas para o que uma resolve significa dois consentimentos, dois contratos e dois lugares para olhar.

Manter em paralelo uma tabela própria `product_events`: custa pouco, e garante que o dado do beta seja seu mesmo que a ferramenta se mostre cara ou ruim.

**LGPD:** eventos e replay contêm dado pessoal. Precisam de consentimento (spec 012) e de menção explícita na Política de Privacidade, com a ferramenta nomeada e a base legal declarada.
