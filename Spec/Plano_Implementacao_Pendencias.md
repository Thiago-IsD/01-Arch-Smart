# Plano de Implementação — Pendências ArchSmart

**Data:** 2026-07-13
**Base:** Auditoria UX/UI + Benchmark (pasta `Spec/`), comparados 1:1 com o código atual.
**Status geral:** ✅ **CONCLUÍDO** — os 8 itens pendentes foram implementados em 2026-07-13. 100% das specs de auditoria/benchmark cobertas.

> Escopo executado: Grupos A + B + C. F2 (PDF) implementado como melhoria do print atual (toggle A4/A3 + links de compra), sem `@react-pdf/renderer`.

### ⚠️ Passos de deploy pendentes (ambiente)
- [ ] Rodar a migration do backend: `alembic upgrade head` (cria coluna `item_options.rejection_reason`, revisão `b7c9d1e2f3a4`).
- [ ] Rodar `tsc --noEmit` / `npm run build` no frontend (não executável neste ambiente por falta de Node).
- [ ] Rodar `pytest` no backend em ambiente com dependências de teste instaladas.

---

## Legenda de esforço
- 🟢 Baixo (minutos) · 🟡 Médio (1 componente) · 🟠 Alto (feature/refactor)

---

## Grupo A — Quick wins 🟢

### ✅ A1 · UX-03 — Limite de plano dinâmico no Dashboard
**Feito:** backend expõe `plan_limit` no `DashboardLeanResponse` (reaproveitando `_get_plan_limit`); frontend usa `data?.plan_limit ?? 2`.
- **Arquivo:** `ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx:168`
- **Problema:** `const planLimit = 2` hardcoded. A página de projetos já resolve isso via `data.plan_limit ?? 2` (`projects/page.tsx:44`).
- **Solução:**
  1. Verificar de onde `dashboard/page.tsx` já obtém os dados do usuário/assinatura (`data`/perfil).
  2. Substituir `2` por `data?.plan_limit ?? 2` (mesmo fallback da projects page), garantindo o mesmo campo do endpoint.
  3. Se o dashboard não buscar esse campo hoje, incluir `plan_limit` no fetch existente (não criar request novo).
- **Aceite:** alterar o plano no banco reflete o limite no dashboard sem deploy.

### ✅ A2 · A11y-02 — `htmlFor`/`id` nos campos do formulário financeiro
**Feito:** absorvido pelo refactor B3 (o `Form` do shadcn liga `htmlFor`/`id` automaticamente).
- **Arquivo:** `ArchSmart-web/src/app/(dashboard)/finance/components/QuickEntryDialog.tsx`
- **Problema:** labels em `:150,159,169,178,188,204` (Descrição, Valor, Vencimento, Categoria, Repetição, Parcelas) sem `htmlFor`; `<Input>` sem `id`. (O radio group de escopo em `:221-229` já está correto — usar como referência.)
- **Solução:** adicionar `id="..."` a cada input e `htmlFor` correspondente no `<label>`.
- **Nota:** se A5 (refatoração rhf+zod) for executado, este item é absorvido — fazer A2 isolado apenas se A5 não for feito agora.
- **Aceite:** clicar no label foca o input; leitor de tela anuncia o campo.

---

## Grupo B — Componentes médios 🟡

### ✅ B1 · UX-01 — Breadcrumbs dinâmicos no Header
**Feito:** componente `HeaderBreadcrumb` lê `usePathname`, resolve rótulos conhecidos + `customLabels`; consome o `DynamicBreadcrumb` já registrado pelo `ProjectHeader` → mostra o nome real do projeto.
- **Arquivo:** `ArchSmart-web/src/components/layout/AppShell.tsx:350` (Header)
- **Problema:** título estático `"Bem-vindo à Arch Smart"`. O `BreadcrumbProvider`/`useBreadcrumb` já estão importados (`:47`) mas o `Header` não consome o contexto.
- **Solução:**
  1. No `Header`, consumir `useBreadcrumb()` (ou derivar de `usePathname` como fallback).
  2. Renderizar trilha (ex: `Projetos › Apartamento 102 › Ambientes`) usando o componente `Breadcrumb` do shadcn (verificar se já existe em `components/ui`).
  3. Manter data atual; substituir só a mensagem estática.
  4. Fallback: em rotas sem breadcrumb setado, exibir o título da seção.
- **Aceite:** navegar para rota profunda atualiza a trilha no header.

### ✅ B2 · UX-02 — Skeleton screens no Dashboard
**Feito:** spinner full-screen substituído por skeleton (`Skeleton` do shadcn) espelhando banner, 4 métricas, ações rápidas e grid de 3 colunas.
- **Arquivo:** `ArchSmart-web/src/app/(dashboard)/dashboard/page.tsx:157-163`
- **Problema:** loading = `Loader2` full-screen a `min-h-[70vh]`.
- **Solução:**
  1. Confirmar/instalar `Skeleton` do shadcn (`components/ui/skeleton`).
  2. Criar layout de skeleton espelhando os cards de métricas e a grade de produtos recentes.
  3. Renderizar durante `isLoading` em vez do spinner central.
- **Aceite:** durante carregamento a estrutura da página aparece (sem tela cinza bloqueante).

### ✅ B3 · UX-09 + UX-10 + A11y-02 — Refatorar QuickEntryDialog (validação inline + máscara + labels)
**Feito:** reescrito com `react-hook-form` + `zod` (validação inline via `FormMessage`), máscara monetária BRL e labels ligados via `Form` do shadcn (fecha A11y-02).
- **Arquivo:** `ArchSmart-web/src/app/(dashboard)/finance/components/QuickEntryDialog.tsx`
- **Problema:**
  - UX-09: validação só no submit via `toast` (`:64-67`), sem feedback inline.
  - UX-10: campo de valor `type="number"` cru (`:160`), sem máscara `R$`.
  - A11y-02: labels sem `htmlFor`/`id`.
- **Solução (fazer os três juntos, mesmo arquivo):**
  1. Migrar para `react-hook-form` + `zodResolver` (verificar se ambos já são deps do projeto — provável, dado que ProductFormSheet usa zod).
  2. Definir schema zod (description obrigatório, amount > 0, dueDate válido, etc.) com `FormMessage` inline vermelho abaixo de cada campo.
  3. Máscara monetária no valor: input de texto controlado formatando `R$ 1.500,00` e convertendo para float no submit (ou usar helper de currency já existente no projeto — checar `lib/`).
  4. Usar componentes `Form`/`FormField`/`FormLabel` do shadcn (resolvem `htmlFor`/`id` automaticamente → fecha A11y-02).
- **Aceite:** campos inválidos mostram erro inline; valor formata como moeda; labels ligados aos inputs.

---

## Grupo C — Feature parcial 🟠

### ✅ C1 · F2 — Caderno de Obra PDF (melhorar o print existente)
**Feito:** toolbar extraída para o client component `PrintControls.tsx` com toggle **A4/A3** (`@page size` dinâmico) e link de compra (`source_url`) por item. Corrigido de brinde o `onClick` que estava num server component.
- **Arquivo:** `ArchSmart-web/src/app/(dashboard)/projects/[id]/print/page.tsx` + novo `PrintControls.tsx`
- **Estado atual:** já agrupa por ambiente, mostra foto, dimensões, marca/fornecedor, categoria, notas, qtd/preço; CSS A4 (`@media print`, `@page { size: A4 }` em `:235-251`), botão `window.print()` (`:104`). Usa `product.price` (venda).
- **Gaps a fechar (abordagem escolhida: manter print, sem `@react-pdf/renderer`):**
  1. **Opção A3:** permitir alternar `@page { size: A4 }` / `A3` (toggle no topo que ajusta a classe/estilo antes do `window.print()`).
  2. **Links de compra:** renderizar `source_url` do produto na ficha (hoje não é exibido). Verificar se `source_url` vem no fetch do budget; se não, incluir no select.
  3. (Opcional) revisar quebras `break-inside-avoid-page` com A3.
- **Fora de escopo:** `@react-pdf/renderer` (PDF programático) — descartado nesta rodada.
- **Aceite:** usuário escolhe A4/A3 e o PDF inclui links de compra por item.

### ✅ C2 · F3 — Justificativa por item no Portal
**Feito:** coluna `rejection_reason` no modelo `ItemOption` + migration `b7c9d1e2f3a4`; endpoint reject aceita body opcional `{ reason }` e persiste; approve limpa a razão; payload público expõe `rejection_reason`. Frontend com formulário inline de justificativa + exibição do motivo salvo.
- **Arquivos:** `ArchSmart-web/src/app/portal/[uuid]/components/PortalBudget.tsx` + backend `ArchSmart-api/app/api/endpoints/public.py` + `app/models/all_models.py` + migration.
- **Estado atual:** aprovar/recusar por item funciona e recalcula orçamento em tempo real, mas **não captura justificativa por item** (só há feedback no aceite geral do projeto `:409-419`).
- **Solução (se priorizado):**
  1. Backend: aceitar campo opcional `justification` nos endpoints approve/reject e persistir (nova coluna/migration).
  2. Frontend: ao recusar, abrir input de justificativa antes de confirmar.
- **Recomendação:** baixo valor imediato; deixar para depois salvo pedido do produto.

---

## Ordem sugerida de execução
1. **A1, A2** (quick wins isolados) — se B3 não for imediato.
2. **B3** (fecha UX-09 + UX-10 + A11y-02 de uma vez).
3. **B1, B2** (breadcrumbs + skeletons).
4. **C1** (caderno de obra A3 + links).
5. **C2** (opcional, só se produto pedir).

## Itens confirmados como JÁ FEITOS (não tocar)
UX-04, UX-05, UX-06, **UX-07** (vazamento accountId resolvido), UX-08, UI-01, UI-02, UI-03, UI-04, UI-05, A11y-01, A11y-03, SEO-01, **F1 Markup** (full-stack + migration), **F3 Aprovar/Recusar**, **F4 WhatsApp**.
