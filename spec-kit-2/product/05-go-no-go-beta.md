# Critérios de Go / No-Go do Beta

**Versão 2.0 — 23/08/2026**

Dois portões distintos:

- **Portão A — entrada:** o produto pode receber 15 arquitetos?
- **Portão B — lançamento:** o produto pode ser vendido?

Escrever os critérios **antes** de ter os números é o que impede o time de racionalizar um resultado ruim depois.

---

## Portão A — Entrada no beta

Todos bloqueantes. Um só reprovado = adiar.

### Reescrita (Onda 2)

- [ ] Telas 005 a 009 em produção (auth, dashboard, projetos/ambientes, biblioteca/clipper, orçamento/export).
  *Financeiro (010) e Apresentações (011) podem entrar depois do dia 1 — não estão no fluxo principal.*
- [ ] Cada tela dentro do orçamento de performance, medido em 4G throttled com dados realistas.
- [ ] Os 5 estados implementados em todas elas.
- [ ] axe sem violação · Lighthouse A11y ≥95 nas 5 telas.
- [ ] **Paridade funcional**: nada que funcionava antes parou de funcionar (única exceção deliberada: `GIO-8`).
- [ ] Nenhum dado comercial confidencial em payload destinado ao cliente final.

### Segurança

- [ ] Teste de isolamento entre contas rodando no CI e passando.
- [ ] **Nenhum recurso acessível por link público não autenticado** — produto capturado, orçamento e prancha exigem sessão ou token assinado.
- [ ] Nenhum `account_id`, URL, chave ou limite de plano literal no código.
- [ ] Backup do banco configurado **e uma restauração testada de verdade**.

### Compliance (Onda 3)

- [ ] `legal_acceptances` gravando aceite dos 3 documentos com versão e data.
- [ ] Consentimento de analytics e replay antes de qualquer coleta.
- [ ] **Replay com dado sensível mascarado, verificado manualmente numa sessão real.**
- [ ] Export de dados da conta funcionando.
- [ ] Exclusão de conta funcionando.
- [ ] `source_url` visível em card, prancha e orçamento exportado.
- [ ] Canal de takedown no ar.

### Medição

- [ ] Os 11 eventos do funil chegando e visíveis num painel.
- [ ] `error_shown` e `quota_limit_hit` instrumentados.
- [ ] Ação de Valor ratificada pela Giovanna.
- [ ] Custo de IA por conta sendo registrado.

### Onboarding

- [ ] **3 pessoas de fora do time** completam cadastro → projeto → ambiente → itens → orçamento → export, **sozinhas, em <30 min**.
- [ ] Vídeo tutorial no ar.
- [ ] Central de ajuda com os artigos do fluxo principal.
- [ ] Canal de suporte por e-mail testado, SLA 48h.

### Documentação

- [ ] `/docs/dev/` com uma página por módulo reescrito.
- [ ] `/docs/user/` com os artigos do fluxo principal.

### Fora de produto (bloqueiam igual)

- [ ] Termo de Uso, Política de Privacidade e Termo de Piloto **publicados, com o nome corrigido para Arq Smart** e e-mails que existem. — Brenno
- [ ] 10–15 arquitetos recrutados, com onboarding 1:1 agendado. — Giovanna

> Se o jurídico não estiver publicado, **não comece o beta**. Rodar piloto com dado de cliente de terceiros sem termo aceito é risco desproporcional ao ganho de duas semanas — e a tabela `legal_acceptances` existe justamente para provar o aceite.

---

## Portão B — Lançamento comercial

Aqui não há checklist binário: há um placar. **Verde em Ativação e Retenção é obrigatório**; os demais informam o *quando*, não o *se*.

| Métrica | 🟢 Go | 🟡 Ajustar | 🔴 No-Go |
|---|---|---|---|
| **Ativação** (Ação de Valor em 7 dias) | ≥60% | 40–59% | <40% |
| **Retenção D30** | ≥40% | 25–39% | <25% |
| **Frequência** (exports/usuário/semana) | ≥1,0 | 0,5–0,9 | <0,5 |
| **Sean Ellis** | ≥40% | 25–39% | <25% |
| **Intenção de pagar** (com preço na mesa) | ≥8 de 15 | 4–7 | <4 |
| **Bugs P0/P1 abertos** | 0 P0, ≤3 P1 | ≤5 P1 | qualquer P0 |
| **Custo de IA / ticket** | <15% | 15–25% | >25% |
| **Performance no P75** | dentro do orçamento | 1–2 telas fora | fluxo principal fora |
| **NPS** | ≥40 | 0–39 | <0 |

### Como ler o placar

- **Tudo verde:** Go. Executar as ondas 4→5→6 e lançar.
- **Ativação verde, resto amarelo:** Go condicional, escopo reduzido, corrigindo em paralelo.
- **Ativação amarela:** o problema é onboarding ou fluxo principal — caro de descobrir, barato de corrigir. Estender o beta 3–4 semanas.
- **Ativação vermelha:** No-Go. É proposta de valor ou ICP, não polimento. Lançar aqui queima o canal de indicação, que é o motor de aquisição do GTM.
- **Qualquer P0 aberto:** No-Go automático.

### Perguntas obrigatórias no formulário de fim de beta

1. Como você fazia isso antes do Arq Smart? *(revela o substituto real)*
2. O que você fez no produto que te deu mais tempo de volta?
3. Se o Arq Smart sumisse amanhã, como você se sentiria? (muito decepcionado / pouco / indiferente)
4. Pagaria R$__/mês por isso hoje? Se não, por quanto? *(preço real na mesa)*
5. O que quase te fez desistir na primeira semana?
6. Indicaria para outro arquiteto? Para quem, especificamente?
7. **O que você continuou fazendo fora do Arq Smart, e por quê?** *(a mais reveladora e a mais esquecida)*

### Regras da reunião de decisão

- Os números são apresentados **antes** de qualquer opinião.
- Quem defender "Go" com métrica vermelha precisa nomear qual hipótese mudou desde que este documento foi assinado.
- A decisão vai para o `HISTORICO.md` com os números que a fundamentaram — especialmente se for No-Go.
