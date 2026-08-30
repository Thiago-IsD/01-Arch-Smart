# Spec 002 — Design System e biblioteca de componentes

| Campo | Valor |
|---|---|
| **Onda** | 1 |
| **Prioridade** | 5 |
| **Esforço** | M (4–5 dias) |
| **Responsável** | Thiago |
| **Cobre** | `EPIC-DS` · previne `UI-01`, `UI-02`, `UI-03`, `UX-02`, `UX-06`, `A11y-01/02/03` |

---

## 1. Problema

No código antigo, cor virou classe estática espalhada (`bg-[#008080]`, `bg-emerald-600`, `text-amber-600`), o contraste reprovou em AA nos dois temas, o carregamento era um spinner de 70vh, a confirmação de exclusão era o `confirm()` do navegador e o menu de ações só aparecia no hover — invisível para teclado e para toque.

Nenhum desses é um bug de tela. São seis telas repetindo a ausência de uma base comum.

E há um agravante de calendário: **a identidade visual nova ainda não existe** — o Thiago assumiu refazer logo e identidade. Se a reescrita esperar por ela, tudo trava; se a reescrita chumbar cores, o rebranding vira uma varredura manual de dias.

## 2. Resultado esperado

Toda tela da Onda 2 monta-se a partir de componentes que já vêm com os 5 estados, contraste aprovado nos dois temas e acessibilidade resolvida. E, quando a identidade nova sair, muda **um arquivo**.

## 3. Escopo

**Dentro:**
- Tokens semânticos de cor, tipografia, espaçamento e raio — claro e escuro.
- Validador de contraste rodando no CI.
- Componentes base com os 5 estados.
- Padrões de carregamento (skeleton), vazio, erro e confirmação.
- Grid e breakpoints (390px / 1440px).

**Fora:**
- A identidade visual em si (logo, paleta definitiva) — chega depois e preenche os tokens.
- Telas (Onda 2).
- Ilustrações e ícones customizados.

## 4. Tokens semânticos

A regra: **o componente nunca sabe qual cor é. Ele sabe qual papel a cor exerce.**

```css
:root {
  /* superfícies */
  --background: …;  --surface: …;  --surface-raised: …;  --border: …;
  /* texto */
  --text-primary: …;  --text-secondary: …;  --text-muted: …;
  /* ação */
  --primary: …;  --primary-foreground: …;  --primary-hover: …;
  /* status */
  --success: …;  --success-foreground: …;
  --warning: …;  --warning-foreground: …;
  --destructive: …;  --destructive-foreground: …;
  --info: …;  --info-foreground: …;
  /* foco */
  --ring: …;
}
```

Valores provisórios agora; definitivos quando a identidade sair. O que **não** muda é o conjunto de nomes.

⚠️ Dois erros específicos do código antigo, endereçados aqui:
- O Teal `#008080` era idêntico nos dois temas e dava 4.25:1 sobre fundo escuro. **Cada token tem valor próprio por tema.**
- `text-amber-600` sobre `bg-amber-50` dava 2.91:1. **Par de status é sempre `--warning` + `--warning-foreground`, validado junto.**

### Validador de contraste no CI

Um teste que percorre todos os pares (fundo, texto) definidos nos tokens e falha se algum ficar abaixo de 4.5:1 para texto normal ou 3:1 para elemento gráfico — **nos dois temas**.

Isso transforma acessibilidade de intenção em build vermelho. É a diferença entre "vamos lembrar de checar" e checado.

## 5. Componentes base

Cada um entregue com **os 5 estados** e história de uso documentada.

| Grupo | Componentes |
|---|---|
| Formulário | `Input`, `CurrencyInput`, `Select`, `Combobox`, `Textarea`, `Checkbox`, `Radio`, `Switch`, `DatePicker`, `FormField` (label + erro + ajuda) |
| Ação | `Button` (variantes e loading), `IconButton`, `DropdownMenu` |
| Dados | `Table` (com ordenação e paginação), `Card`, `Badge`, `EmptyState`, `Skeleton` |
| Sobreposição | `Dialog`, `Sheet`, `AlertDialog`, `Tooltip`, `Toast` |
| Navegação | `Sidebar`, `Breadcrumbs`, `Tabs`, `Pagination` |
| Feedback | `Alert`, `ProgressBar`, `ErrorBoundary` |

**Componentes que resolvem dores específicas do código antigo:**

- **`FormField`** — encapsula `<label htmlFor>` + input com `id` + mensagem de erro inline + texto de ajuda. Usar `FormField` torna `A11y-02` impossível. É o componente mais importante desta lista.
- **`CurrencyInput`** — máscara pt-BR em tempo real (`R$ 1.500,00`), enviando `Decimal` para a API. Resolve `UX-10` de uma vez para o produto inteiro.
- **`AlertDialog`** — substitui `confirm()` nativo (`UX-06`). Focável, fechável por Esc, com foco preso.
- **`EmptyState`** — título, explicação, ação primária e link de ajuda. Torna o estado vazio o padrão, não a exceção.
- **`Skeleton`** — impede o spinner bloqueante (`UX-02`).
- **`DropdownMenu`** — visível em `hover`, `focus-within` **e sempre em viewport de toque** (`A11y-03`).

## 6. Os 5 estados, como regra do componente

| Estado | Regra |
|---|---|
| Padrão | conteúdo com volume realista, não com 3 linhas de exemplo |
| Carregando | `Skeleton` com a forma do conteúdo; nunca spinner de tela cheia |
| Vazio | `EmptyState` com ação primária — nunca só "nenhum item encontrado" |
| Erro | mensagem em português, ação de tentar de novo, **sem perder o que o usuário digitou** |
| Foco/Hover | anel de foco visível com `--ring`; tudo clicável é focável |

## 7. Grid e breakpoints

| Nome | Largura | Uso |
|---|---|---|
| `mobile` | 390px | referência de design; **mínimo suportado real: 360px** |
| `tablet` | 768px | |
| `desktop` | 1440px | referência de design |

Regras: nada de padding assimétrico por breakpoint (`UI-03`) · todo grid tem media query abaixo de 390px (o grid da biblioteca quebrava aí) · tabela larga rola dentro do próprio container, o `body` nunca rola na horizontal.

## 8. Telemetria

Sem eventos próprios. Mas os componentes carregam a instrumentação que as telas usam:
- `Button` emite clique quando recebe `trackAs`.
- `ErrorBoundary` emite `error_shown` automaticamente.
- `FormField` marca campo sensível com `data-private` para o mascaramento do replay (spec 003).

O último importa: se o mascaramento do replay depender de cada tela lembrar, alguma tela vai esquecer. Se depender do `FormField`, é automático.

## 9. Critérios de aceite

- [ ] Tokens semânticos definidos para os dois temas, sem cor literal em componente.
- [ ] Validador de contraste no CI, cobrindo todos os pares nos dois temas.
- [ ] Todos os componentes da §5 entregues com os 5 estados.
- [ ] `FormField` liga label e input automaticamente; usar outro caminho é exceção documentada.
- [ ] `CurrencyInput` formata em tempo real e envia decimal correto — testado com centavos, milhares e colagem de texto.
- [ ] Nenhum `confirm()` nativo possível: `AlertDialog` é o único caminho.
- [ ] Galeria de componentes navegável (rota interna ou Storybook), com os 5 estados de cada um.
- [ ] axe sem violação na galeria.
- [ ] Navegação completa por teclado na galeria.
- [ ] `docs/dev/design-system.md` escrita.

## 10. Riscos

- **Risco:** esperar a identidade visual para começar. → Tokens semânticos com valores provisórios. Trocar depois é um arquivo.
- **Risco:** virar projeto de três semanas. → Timebox de 5 dias. Entregar o que as 7 telas realmente usam; o resto entra sob demanda.
- **Risco:** Storybook ser mais trabalho que valor com um dev. → Uma rota `/dev/componentes` protegida resolve 90% do valor. Só adotar Storybook se a rota se mostrar insuficiente.
