# Roadmap de Produto e Tecnologia — Arq Smart

**Versão 2.0 — 23/08/2026**

> **Escopo deste documento:** apenas produto e tecnologia. Itens societários, fiscais, de marca (INPI) e de captação não entram aqui — estão listados em `06-dependencias-externas.md` só na medida em que bloqueiam desenvolvimento.

> **Como ler:** cada onda tem um objetivo único e um critério de saída objetivo. Onda não avança porque a data chegou — avança porque o critério foi atingido. Se a data chegar e o critério não, **corta escopo, não corta qualidade**.

---

## Panorama

| Onda | Objetivo | Specs | Critério de saída |
|---|---|---|---|
| **1 — Fundação** | A base sobre a qual a reescrita acontece | 001–004 | Arquitetura, design system, telemetria e docs de pé; primeira tela pode começar |
| **2 — Reescrita** | Todas as telas: rápidas, seguras, medidas, documentadas | 005–011 | 7 telas em produção, dentro do orçamento de performance, com jornada gravada |
| **3 — Compliance & beta** | O produto pode receber usuários reais | 012–013 | Aceites, LGPD, onboarding e docs de usuário funcionando |
| **4 — Funcionalidades** | O que o roadmap e a Giovanna pediram | 014–017 | Entregues e validadas com beta-testers |
| **5 — Admin Master** | Operar o produto sem abrir o banco | 018 | Investigar e ajustar uma conta pela interface |
| **6 — Billing (Asaas)** | Poder cobrar | 019 | Primeiro pagamento recebido |
| **7 — Escala** | Escritórios com equipe | 020+ | a redefinir |

**Por que esta ordem:** reescrever depois de construir funcionalidade nova significa reescrever a funcionalidade nova também. Toda hora gasta em feature sobre a base antiga é hora que será gasta de novo. E o billing vem por último por decisão prática — depende de conta e API do Asaas, que ainda serão criadas.

---

## Onda 1 — Fundação

Nada de tela ainda. Isto é o chão sobre o qual as 7 telas serão construídas — e é o que impede que a reescrita reproduza os mesmos problemas.

| Spec | Nome | Esf. | O que entrega |
|---|---|---|---|
| **001** | Arquitetura, multi-tenancy e esteira | M | `account_id`/`user_id`/`created_by` separados · resolução de conta no servidor · entitlements pela API · teste de isolamento no CI · pipeline de deploy |
| **002** | Design System e biblioteca de componentes | M | tokens de cor e tipografia nos dois temas · componentes base com os 5 estados · contraste AA validado |
| **003** | Telemetria e gravação da jornada | M | dicionário de eventos · session replay com mascaramento LGPD · funil montado |
| **004** | Estrutura de documentação | P | `/docs/dev/` e `/docs/user/` criados, com templates e as primeiras páginas |

**Critério de saída:** um dev consegue criar uma tela nova que já nasce isolada por conta, com tokens do design system, instrumentada e documentada — sem inventar padrão.

**Nota sobre a spec 002:** a identidade visual nova ainda não existe (o Thiago assumiu refazer logo e identidade). O design system nasce com tokens **semânticos** (`--primary`, `--surface`, `--warning`), preenchidos com valores provisórios. Quando a identidade sair, muda um arquivo. Esperar a identidade para começar a reescrita é o que trava tudo.

---

## Onda 2 — Reescrita das telas

Uma tela por vez, mergeada e medida antes da próxima. O padrão comum está em `memory/playbook-reescrita.md`.

| Spec | Tela | Esf. | Observação |
|---|---|---|---|
| **005** | Autenticação e conta | M | inclui `SEC-01` — **eliminar o acesso por link público** a produtos capturados (ainda aberto) |
| **006** | Dashboard e shell | M | define navegação, breadcrumbs e o padrão de carregamento de todas as outras |
| **007** | Projetos e Ambientes (DNA) | G | núcleo do modelo; Smart Core isolado como serviço puro |
| **008** | Biblioteca e Web Clipper | G | as 4 diretrizes do parecer jurídico entram aqui |
| **009** | Orçamento e Exportação | G | 🎯 é a Ação de Valor — inclui seleção múltipla e export WhatsApp/PDF/Excel |
| **010** | Financeiro (Wallet) | M | paridade + qualidade. Funcionalidade nova é a spec 014 |
| **011** | Apresentações e Portal do Cliente | M | escopo reduzido conforme a decisão sobre o módulo (`GIO-8`) |

**Marco intermediário:** ao terminar a **009**, o fluxo principal do beta está de pé. Se o calendário apertar, 010 e 011 podem entrar depois do início do beta.

**Critério de saída:** as 7 telas em produção, dentro do orçamento de performance medido em 4G throttled, com os 5 estados, sem violação de acessibilidade e com as duas documentações escritas.

---

## Onda 3 — Compliance e beta-ready

| Spec | Nome | Esf. | O que entrega |
|---|---|---|---|
| **012** | Compliance e LGPD no produto | M | `legal_acceptances` · export de dados · exclusão de conta · takedown · retenção de logs |
| **013** | Onboarding e documentação de usuário | M | checklist de primeiros passos · vídeo tutorial · projeto de exemplo · central de ajuda |

A spec 012 não é papelada: são features que a Política de Privacidade **já promete** ao usuário. Publicar a política sem elas implementadas é declarar algo que não existe.

**Critério de saída:** 3 pessoas de fora do time completam cadastro → projeto → ambiente → itens → orçamento → export, sozinhas, em menos de 30 minutos, com aceite dos termos registrado.

---

## Onda 4 — Funcionalidades novas

Agora sim, sobre uma base que aguenta.

| Spec | Nome | Prio | Esf. | Cobre |
|---|---|---|---|---|
| **014** | Financeiro v2 | 4 | M | `MOD-1/2/3`, `SUG-1/2`, categorias, máscara, margem por projeto |
| **015** | Calculadora de Precificação | 4 | G | `EPIC-CALC` — o Padrão Milar |
| **016** | Contatos e Comercial | 3 | G | `MOD-4/6/7` — validar demanda antes |
| **017** | Projetos: templates e pastas | 3 | M+G | `MOD-9/10`, `SUG-7` |

Mais os itens soltos de esforço baixo: dashboard de tarefas (`MOD-11`), anotações rápidas (`SUG-6`), aplicação da identidade visual nova (`MOD-5`).

---

## Onda 5 — Admin Master

**Spec 018** (G). Quatro módulos, entregues na ordem **1 → 2 → 4 → 3**:

1. Contas e Projetos (com impersonation auditada)
2. Tokens de IA e Custos (cotas com soft/hard limit)
3. Uso e Telemetria (reaproveita a spec 003; inclui saúde do Web Clipper)
4. Planos e Pagamentos (construtor de planos — simplificado, já que o lançamento tem um plano só)

O módulo 1 sozinho já elimina o acesso direto ao Postgres. Entregue e coloque em uso antes de começar o 2.

---

## Onda 6 — Billing e gateway (Asaas)

**Spec 019** (G). **Última feature**, por decisão: depende de criar a conta no Asaas e obter a API.

Escopo simplificado pelas decisões de 18/08: **um plano**, sem anual, **sem NFS-e**, estados `BETA`/`ACTIVE`/`READ_ONLY`.

⚠️ O cadastro e a homologação no Asaas (PIX e boleto) devem começar **em paralelo à Onda 4**, não quando a spec 019 iniciar. Burocracia bancária leva semanas e não depende de código.

---

## Onda 7 — Escala

**Spec 020** — Equipe, RBAC e aprovações (`SUG-4/9`). A própria Giovanna marcou como pós-lançamento.

Também no radar, sem prazo: formulários de briefing (`SUG-8`), Marketing & Conteúdo (`SUG-5`), metas financeiras (`SUG-3`), gerenciador de serviços com timer (`MOD-8`), gestão de obra.

**Catálogo agregado entre arquitetos** — continua sendo a hipótese mais valiosa do backlog, mas o parecer jurídico veta republicar imagem de terceiro em catálogo aberto. Se for feito, tem que ser com dado **agregado e anonimizado** (preço médio por categoria, rendimento típico), nunca republicando o acervo de um arquiteto para outro.

---

## Dependências entre ondas

```
Onda 1 (fundação)  ──►  Onda 2 (reescrita)  ──►  Onda 3 (beta-ready)  ──►  BETA
                                                        │
                                                        ▼
                                            Onda 4 (funcionalidades)
                                                        │
                                                        ▼
                                            Onda 5 (Admin Master)
                                                        │
                                                        ▼
                                            Onda 6 (Billing/Asaas)
```

**Fora de produto, mas bloqueiam o início do beta:** Termo de Uso, Política de Privacidade e Termo de Piloto publicados **com o nome corrigido para Arq Smart** e com e-mails que existem de verdade. Responsável: Brenno.

---

## Regras de mudança de roadmap

1. Item novo entra no backlog com prioridade, **nunca direto numa onda**.
2. Entrar numa onda em execução exige tirar outro item de esforço equivalente.
3. **Funcionalidade nova não entra na Onda 2.** Reescrita é paridade + qualidade; qualquer coisa nova vai para a Onda 4. Esta é a regra que decide se a reescrita termina.
4. Reordenação acontece só nos marcos: fim de cada onda.
