# Arq Smart — Spec Kit

Kit de desenvolvimento orientado a especificação do Arq Smart.
A regra é simples: **nada entra em código sem uma spec.** A spec descreve o *que* e o *porquê*; o tasks é a lista executável que você — ou um agente de IA — segue.

**Versão 2.0 — 23 de agosto de 2026**

> **Escopo:** apenas produto e tecnologia. Itens societários, fiscais, de marca e de captação estão fora — aparecem só em `product/06-dependencias-externas.md`, na medida em que bloqueiam desenvolvimento.

---

## O que mudou da v1 para a v2

A v1 assumia correções pontuais sobre o código existente. As atas de 11/08 e 18/08 mudaram a premissa: **a plataforma vai ser reescrita**. Isso reordenou tudo.

| | v1 | v2 |
|---|---|---|
| Estratégia | corrigir achados de auditoria | **reescrever as 7 telas** — a auditoria e o benchmark de junho já foram implementados no código e não são backlog |
| Ordem | funcionalidades → admin → billing | **fundação → reescrita → compliance → funcionalidades → admin → billing** |
| Infra | "decidir após profiling" | ✅ decidido: Vercel + Render + Supabase no beta |
| Planos | Solo/Pro/Studio | ✅ **um plano** no lançamento |
| Gateway | comparar candidatos | ✅ **Asaas**, e é a **última** feature |
| NFS-e e plano anual | no escopo | ❌ adiados |
| Jornada do usuário | só eventos | ✅ eventos **+ gravação de sessão** com mascaramento LGPD |
| Documentação | não existia | ✅ dev + usuário, como entrega obrigatória |
| Compliance jurídico | disperso | ✅ spec própria (012) + Art. 11 e 12 |

---

## Estrutura

```
spec-kit/
├── README.md                       ← você está aqui
├── memory/
│   ├── constitution.md             ← 15 princípios não-negociáveis. Leia antes de tudo.
│   └── playbook-reescrita.md       ← o padrão que toda tela reescrita segue
├── product/
│   ├── 01-visao-de-produto.md      ICP, JTBD, moat, não-objetivos, glossário
│   ├── 02-roadmap.md               as 7 ondas, com critério de saída
│   ├── 03-backlog.md               backlog unificado com IDs estáveis
│   ├── 04-metricas.md              eventos, Ação de Valor, gravação de jornada
│   ├── 05-go-no-go-beta.md         critérios objetivos dos dois portões
│   └── 06-dependencias-externas.md o que não é dev mas bloqueia dev
├── docs/
│   ├── README-estrutura-docs.md    como a documentação do produto se organiza
│   ├── template-doc-modulo.md
│   └── template-artigo-ajuda.md
├── templates/
│   ├── spec-template.md
│   ├── tasks-template.md
│   └── guia-de-uso-com-ia.md       como rodar isso com Antigravity/Claude/Cursor
└── specs/
    ├── 001-fundacao-arquitetura-e-esteira/     ┐
    ├── 002-design-system/                      │ Onda 1 — Fundação
    ├── 003-telemetria-e-jornada/               │
    ├── 004-documentacao/                       ┘
    ├── 005-reescrita-autenticacao/             ┐
    ├── 006-reescrita-dashboard/                │
    ├── 007-reescrita-projetos-e-ambientes/     │ Onda 2 — Reescrita
    ├── 008-reescrita-biblioteca-e-clipper/     │
    ├── 009-reescrita-orcamento-e-export/  🎯   │
    ├── 010-reescrita-financeiro/               │
    ├── 011-reescrita-apresentacoes-e-portal/   ┘
    ├── 012-compliance-e-lgpd/                  ┐ Onda 3 — Beta-ready
    ├── 013-onboarding-e-ajuda/                 ┘
    ├── 014-financeiro-v2/                      ┐
    ├── 015-calculadora-de-precificacao/        │ Onda 4 — Funcionalidades
    ├── 016-contatos-e-comercial/               │
    ├── 017-templates-e-arquivos/               ┘
    ├── 018-admin-master/                       ← Onda 5
    ├── 019-billing-asaas/                      ← Onda 6 (última)
    └── 020-equipe-rbac-e-aprovacoes/           ← Onda 7
```

---

## Como usar

**1. Leia `memory/constitution.md`.** São 15 artigos. Eles valem mais que qualquer spec: se uma spec os contradiz, a constitution ganha e a spec está errada.

**2. Se for tela da Onda 2, leia também `memory/playbook-reescrita.md`.** Ele carrega tudo que é comum às 7 telas — por isso as specs 005 a 011 são curtas.

**3. Escolha a próxima spec em `product/02-roadmap.md`.** As ondas têm critério de saída explícito. **Não pule onda** — a fundação existe justamente para as telas não repetirem os erros do código antigo.

**4. Resolva os `[DECISÃO PENDENTE]` da spec antes de começar.** São pontos onde falta uma escolha de negócio. Codar por cima de premissa inventada é como o produto chegou onde chegou.

**5. Execute o `tasks.md`,** em ordem, marcando `[x]`.

**6. Antes do merge**, rode o Anexo B da constitution.

---

## Por onde começar hoje

```
1. spec 001 — Fundação          ← nenhuma tela começa antes desta
2. spec 002 — Design System     ← em paralelo com a 001, se houver capacidade
3. spec 003 — Telemetria        ← antes da primeira tela, sempre
4. spec 004 — Documentação      ← 2 dias, e vira hábito
```

Só depois disso a primeira tela (spec 005) começa.

---

## Convenções

| Prefixo | Origem |
|---|---|
| `SEC-` | achados de segurança ainda abertos (ata de 18/08) |
| `MOD-` `SUG-` | reunião de 27/07 (`roadmap.html`) |
| `GIO-` | considerações da Giovanna em 21/07 |
| `JUR-` | requisitos do parecer jurídico e da LGPD |
| `RW-` | telas da reescrita |
| `EPIC-` `ADM-` `BILL-` | épicos novos |
| `T-NNN.x` | tarefas dentro de um `tasks.md` |

**Prioridade** 1–5 (5 = máxima) · **Esforço** P ≤1 dia · M 2–5 dias · G 1–3 semanas · GG >3 semanas.

---

## Sobre o `roadmap.html`

Continua útil como visualizador, mas tem dois problemas: os 22 itens estão todos com prioridade `1` (ou seja, sem prioridade), e ele não contém a auditoria, os pedidos da Giovanna de 21/07, os requisitos jurídicos nem os épicos novos.

**`product/03-backlog.md` é a fonte de verdade.** Se quiser manter o HTML, atualize-o a partir do backlog — nunca o contrário.

---

## As três regras que decidem se isso funciona

1. **Nenhuma tela começa antes da Onda 1 estar fechada.** É o que impede a reescrita de reproduzir os mesmos defeitos.
2. **Funcionalidade nova não entra na Onda 2.** Reescrita é paridade + qualidade. Tudo que é novo já tem spec esperando nas ondas 4 a 7.
3. **Uma tela por vez, mergeada e medida.** Sete telas abertas em paralelo viram sete telas pela metade na semana do beta.
