# Backlog Unificado — Produto e Tecnologia

**Versão 2.0 — 23/08/2026** · **Fonte de verdade do backlog.** O `roadmap.html` passa a ser visão derivada.

**Prioridade:** 1–5 (5 = máxima). **Esforço:** P ≤1 dia · M 2–5 dias · G 1–3 semanas · GG >3 semanas.
**Status:** ⬜ pendente · 🔵 em análise · 🟡 em andamento · ✅ concluído · 🚫 fora de escopo

> Escopo: só produto e tecnologia. INPI, aporte, CNPJ, contrato de sócios e registro de marca **não estão aqui** — ver `06-dependencias-externas.md`.

---

## A. Auditoria de UX/UI e benchmark competitivo (18/06/2026) — ✅ implementados

Os dois relatórios de junho — `ux_ui_audit_report.docx` e `ux_ui_benchmark_report.docx` — **já foram implementados no código**. Por isso não aparecem no `roadmap.html` e **não são backlog**. Nada deles é replicado aqui.

O que existe hoje na plataforma é preservado pela regra de **paridade** do playbook: *nada que funcionava parou de funcionar*. Não há lista de exceções — vale para tudo.

**Onde o que existe fica documentado:** em `docs/dev/modulos/`, escrito **a partir do código** durante a reescrita (spec 004 + playbook §6). Reconstruir o inventário de funcionalidades a partir de relatórios de junho produziria uma lista desatualizada e incompleta; ler o código produz a lista certa.

**A única coisa que este kit acrescenta sobre eles** é prevenção, não conteúdo: numa reescrita do zero, correção aplicada ao código antigo não viaja junto — o hábito de quem escreve, sim. Por isso a Onda 1 torna as classes de defeito mais caras impossíveis de reintroduzir: cinco `grep` no CI (spec 001, T-001.13) e os componentes do design system (spec 002). Isso é mecanismo próprio, não cópia de relatório.

## A2. ⚠️ Isolamento por link público — **ainda aberto**

Item **distinto** do `UX-07`, e ainda não resolvido. Registrado na ata de 18/08:

> *"Criar cadastro clientes: implementar sistema de cadastro e autenticação para clientes, eliminando o acesso aberto via link público para produtos capturados."*
> *"...ajustar a arquitetura do software para que as capturas de produtos fiquem vinculadas a identificadores de conta (account ID), garantindo privacidade em vez de manter links abertos."*

| ID | Item | Prio | Esf. | Spec | Status |
|---|---|---|---|---|---|
| `SEC-01` | Eliminar acesso por URL pública a produtos capturados; compartilhamento só por token assinado com escopo e expiração | **5** | M | 005 / 011 | ⬜ |

Além de ser furo de isolamento, viola a **diretriz nº 1 do parecer jurídico** do Web Clipper (Art. 11 §1). É bloqueante do Portão A do beta.

## B. Onda 1 — Fundação

| ID | Item | Prio | Esf. | Spec | Status |
|---|---|---|---|---|---|
| `EPIC-ARCH` | `account_id`/`user_id`/`created_by` separados + resolução no servidor | 5 | M | 001 | ⬜ |
| `EPIC-ENT` | Entitlements pela API (`GET /me`) | 5 | P | 001 | ⬜ |
| `EPIC-CI` | Esteira de desenvolvimento: lint, testes, migração, deploy | 5 | M | 001 | ⬜ |
| `EPIC-DS` | Design System: tokens, tipografia, componentes com 5 estados | 5 | M | 002 | ⬜ |
| `EPIC-TELE` | Eventos + dicionário + funil | 5 | M | 003 | ⬜ |
| `EPIC-REPLAY` | **Gravação de jornada** com mascaramento LGPD | 5 | M | 003 | ⬜ |
| `EPIC-DOCS` | `/docs/dev/` e `/docs/user/` com templates | 4 | P | 004 | ⬜ |

## C. Onda 2 — Reescrita das telas

| ID | Tela | Prio | Esf. | Spec | Status |
|---|---|---|---|---|---|
| `RW-01` | Autenticação e conta (+ `SEC-01`: fim dos links públicos) | 5 | M | 005 | ⬜ |
| `RW-02` | Dashboard e shell | 5 | M | 006 | ⬜ |
| `RW-03` | Projetos e Ambientes (DNA) | 5 | G | 007 | ⬜ |
| `RW-04` | Biblioteca e Web Clipper | 5 | G | 008 | ⬜ |
| `RW-05` | Orçamento e Exportação 🎯 | 5 | G | 009 | ⬜ |
| `RW-06` | Financeiro (Wallet) | 4 | M | 010 | ⬜ |
| `RW-07` | Apresentações e Portal do Cliente | 3 | M | 011 | ⬜ |

Itens da Giovanna que entram **dentro** da reescrita (não são features novas — são o jeito certo de fazer a tela):

| ID | Item | Entra em |
|---|---|---|
| `GIO-3` | Seleção múltipla de itens da biblioteca | 008 / 009 |
| `GIO-4` | Export do orçamento em WhatsApp / PDF / Excel | 009 |
| `GIO-5` | Link de compra e observações no export | 009 |
| `GIO-1` | Terminologia: "normalizar"→"preencher", "builder"→"arquivo" | todas |
| `GIO-7` | Lista de serviços corrigida | 007 |
| `JUR-2` | `source_url` visível em card, prancha e export | 008 / 009 |

## D. Onda 3 — Compliance e beta

| ID | Item | Prio | Esf. | Spec | Status |
|---|---|---|---|---|---|
| `JUR-1` | Tabela `legal_acceptances` + telas de aceite | 5 | M | 012 | ⬜ |
| `JUR-3` | Canal de takedown (formulário + fluxo de remoção) | 4 | P | 012 | ⬜ |
| `JUR-4` | Export de todos os dados da conta (portabilidade) | 5 | M | 012 | ⬜ |
| `JUR-5` | Exclusão de conta e dados | 5 | M | 012 | ⬜ |
| `JUR-6` | Retenção de logs de acesso por 6 meses | 4 | P | 012 | ⬜ |
| `JUR-7` | Consentimento de analytics no primeiro acesso | 5 | P | 012 | ⬜ |
| `EPIC-ONB` | Onboarding: checklist, vídeo, projeto de exemplo, biblioteca semeada | 5 | M | 013 | ⬜ |
| `GIO-2` | Vídeo tutorial + flag de primeiro acesso | 4 | M | 013 | ⬜ |
| `EPIC-HELP` | Central de ajuda do usuário | 4 | M | 013 | ⬜ |
| `EPIC-SUP` | Suporte: e-mail com SLA 48h (chatbot e vídeos depois) | 3 | P | 013 | ⬜ |

## E. Onda 4 — Funcionalidades

| ID | Item | Prio | Esf. | Spec | Status |
|---|---|---|---|---|---|
| `MOD-1` | Receita sem validade, com data de inserção | 4 | P | 014 | ⬜ |
| `MOD-2` | Categorias pré-definidas de receita e despesa | 4 | P | 014 | ⬜ |
| `MOD-3` | Categoria personalizada | 4 | P | 014 | ⬜ |
| `SUG-1` | Vincular receita/despesa a projeto → margem por trabalho | 4 | M | 014 | 🔵 |
| `SUG-2` | Gráficos trimestral / semestral / anual | 3 | M | 014 | 🔵 |
| `EPIC-CALC` | **Calculadora de Precificação (Padrão Milar)** | 4 | G | 015 | ⬜ |
| `MOD-4` | Painel de leads e conversão | 3 | G | 016 | ⬜ |
| `MOD-6` | Contatos > Clientes | 3 | M | 016 | ⬜ |
| `MOD-7` | Contatos > Parceiros | 2 | M | 016 | ⬜ |
| `MOD-9` | Templates padrão de etapas de projeto | 3 | M | 017 | ⬜ |
| `MOD-10` | Templates personalizáveis | 3 | M | 017 | ⬜ |
| `SUG-7` | Pastas/arquivos por projeto | 3 | G | 017 | ⬜ |
| `MOD-5` | Aplicar a nova identidade visual | 4 | M | — | ⬜ |
| `MOD-11` | Dashboard: tarefas hoje / semana / atraso | 3 | P | — | ⬜ |
| `SUG-6` | Anotações rápidas | 2 | P | — | ⬜ |

## F. Onda 5 — Admin Master

| ID | Item | Prio | Esf. | Spec | Status |
|---|---|---|---|---|---|
| `ADM-1` | Contas e Projetos + impersonation auditada | 5 | G | 018 | ⬜ |
| `ADM-2` | Tokens de IA e Custos (cotas soft/hard) | 5 | M | 018 | ⬜ |
| `ADM-3` | Uso e Telemetria + saúde do Web Clipper | 4 | M | 018 | ⬜ |
| `ADM-4` | Planos e Pagamentos (simplificado: 1 plano) | 4 | M | 018 | ⬜ |

## G. Onda 6 — Billing (Asaas)

| ID | Item | Prio | Esf. | Spec | Status |
|---|---|---|---|---|---|
| `BILL-1` | Integração Asaas: assinatura, cartão, PIX, boleto | 5 | G | 019 | ⬜ |
| `BILL-2` | Trial e transição para `READ_ONLY` | 5 | M | 019 | ⬜ |
| `BILL-3` | Slot avulso (pay-per-project) | 3 | M | 019 | ⬜ |
| `BILL-4` | Webhooks idempotentes + dunning | 5 | M | 019 | ⬜ |
| `BILL-5` | Preço-base + tributo por fora (IBS/CBS) | 4 | P | 019 | ⬜ |
| — | Plano anual | — | — | — | 🚫 adiado (18/08) |
| — | Emissão de NFS-e | — | — | — | 🚫 adiado (18/08) |

## H. Onda 7 — Escala

| ID | Item | Prio | Esf. | Spec | Status |
|---|---|---|---|---|---|
| `SUG-4` | RBAC: equipe vê só as próprias tarefas | 3 | G | 020 | 🔵 |
| `SUG-9` | Aprovação de tarefas/despesas criadas pela equipe | 2 | M | 020 | ⬜ |
| `SUG-8` | Formulário público de briefing | 3 | G | — | ⬜ |
| `SUG-5` | Marketing & Conteúdo (calendário editorial) | 2 | GG | — | ⬜ |
| `SUG-3` | Metas financeiras | 2 | M | — | ⬜ |
| `MOD-8` | Gerenciador de serviços com urgência e timer | 2 | M | — | ⬜ |
| `GIO-6` | Gestão de obra / assessoria de execução | 2 | M | — | ⬜ |
| `EPIC-DATA` | Catálogo **agregado e anonimizado** entre arquitetos | 3 | GG | — | 💡 |

## I. Anti-requisitos (não construir)

| ID | Item | Motivo |
|---|---|---|
| `GIO-8` | Avaliação/aprovação do cliente sobre a apresentação | a apresentação é ao vivo; alterações acontecem na reunião (Giovanna, 21/07). Se existir hoje, a reescrita não reconstrói — ver spec 011 |
| `MOD-13` | Galeria de modelos de apresentação editáveis | não competimos com Canva |
| — | Editor de slides | idem |
| `JUR-X` | Scraping automatizado em lote de catálogos | proibido pelo parecer nº 01/2026 |
| `JUR-Y` | Catálogo global aberto com acervo de terceiros | idem |

---

## Resumo por onda

| Onda | Itens | Esforço agregado |
|---|---|---|
| 1 — Fundação | 7 | ~2 semanas |
| 2 — Reescrita | 7 telas + 6 embutidos | ~7–9 semanas |
| 3 — Compliance e beta | 10 | ~3 semanas |
| 4 — Funcionalidades | 15 | ~8 semanas |
| 5 — Admin Master | 4 | ~3 semanas |
| 6 — Billing | 5 | ~3 semanas |
| 7 — Escala | 8 | a redefinir |

**Realidade de capacidade:** um dev principal (Thiago), com apoio parcial do Brenno, e com possível redução de disponibilidade por mudança na carga horária presencial do emprego (registrado na ata de 11/08).

Ondas 1 + 2 + 3 ≈ **12 a 14 semanas** de trabalho de um dev. Essa é a conta honesta até um beta sobre a base reescrita. Se a meta de setembro precisar ser mantida, as opções são:

1. **Reduzir a Onda 2** — entrar no beta com 5 telas reescritas (005 a 009) e deixar Financeiro e Apresentações para depois. O fluxo principal do beta não passa por elas.
2. **Aumentar capacidade** — o Brenno codificando junto, como já foi combinado em 11/08.
3. **Mover a data do beta** — a mais honesta, se as duas anteriores não fecharem.

Decidir isso agora custa uma conversa. Descobrir em setembro custa o beta.
