# Tasks 002 — Design System

## Tokens

- [ ] **T-002.1** — Definir os tokens semânticos nos dois temas
  - Aceite: nenhuma cor literal fora do arquivo de tokens
- [ ] **T-002.2** — Validador de contraste no CI
  - Aceite: percorre todos os pares (fundo, texto) nos dois temas; falha abaixo de 4.5:1 / 3:1
- [ ] **T-002.3 [P]** — Escala tipográfica, espaçamento e raio
- [ ] **T-002.4 [P]** — Breakpoints 390 / 768 / 1440 e regras de grid

## Componentes que resolvem dores conhecidas (façam primeiro)

- [ ] **T-002.5** — `FormField` (label + input + erro inline + ajuda)
  - Aceite: clicar no rótulo foca o campo; erro aparece abaixo; marca `data-private` quando sensível
- [ ] **T-002.6** — `CurrencyInput`
  - Aceite: `150000` → `R$ 1.500,00`; envia `1500.00`; testado com centavos, milhares e colagem
- [ ] **T-002.7** — `AlertDialog`
  - Aceite: foco preso, fecha por Esc, ação destrutiva destacada
- [ ] **T-002.8** — `EmptyState`
  - Aceite: título, explicação, ação primária, link de ajuda
- [ ] **T-002.9** — `Skeleton`
  - Aceite: acompanha a forma do conteúdo; nunca ocupa a tela toda
- [ ] **T-002.10** — `DropdownMenu`
  - Aceite: visível em hover, `focus-within` e **sempre** em viewport de toque

## Demais componentes

- [ ] **T-002.11** — Formulário: `Input`, `Select`, `Combobox`, `Textarea`, `Checkbox`, `Radio`, `Switch`, `DatePicker`
- [ ] **T-002.12** — Ação: `Button` (variantes + loading), `IconButton`
- [ ] **T-002.13** — Dados: `Table` (ordenação + paginação), `Card`, `Badge`
- [ ] **T-002.14** — Sobreposição: `Dialog`, `Sheet`, `Tooltip`, `Toast`
- [ ] **T-002.15** — Navegação: `Sidebar`, `Breadcrumbs`, `Tabs`, `Pagination`
- [ ] **T-002.16** — Feedback: `Alert`, `ProgressBar`, `ErrorBoundary`
  - Aceite: `ErrorBoundary` emite `error_shown` sozinho

## Galeria e verificação

- [ ] **T-002.17** — Rota `/dev/componentes` com os 5 estados de cada componente
  - Aceite: protegida, não indexável
- [ ] **T-002.18** — axe na galeria
  - Aceite: zero violação
- [ ] **T-002.19** — Percorrer a galeria inteira só com teclado
- [ ] **T-002.20** — Conferir a galeria em 360px, 390px e 1440px, nos dois temas
- [ ] **T-002.21** — `docs/dev/design-system.md`
  - Aceite: quando usar cada componente, como criar um novo, como preencher os tokens quando a identidade sair

---

## Definition of Done

- [ ] Critérios de aceite da spec §9 atendidos
- [ ] Validador de contraste rodando no CI
- [ ] Todos os componentes com os 5 estados
- [ ] Nenhuma tela da Onda 2 iniciada antes desta spec estar fechada
- [ ] `docs/dev/design-system.md` escrita
