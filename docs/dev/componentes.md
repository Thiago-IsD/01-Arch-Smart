# Camada de UI — tokens, componentes e catracas

O que a **Seção 6** entregou, escrito para quem vai **usar** — em especial a
Seção 8, que migra ~30 telas contra esta biblioteca. Até este documento
existir, o contrato só estava no plano de execução (que é artefato de execução,
não referência) e nos testes.

Regra que continua valendo enquanto você lê: **nenhuma cor literal em classe
utilitária** (Art. 7). Tudo aqui referencia token semântico.

---

## 1. Tokens

Todos em `ArchSmart-web/src/app/globals.css`, como triplas HSL sem `hsl()`, e
expostos ao Tailwind por `tailwind.config.ts`. Use sempre a classe utilitária
do token (`bg-success`, `text-muted-foreground`), nunca o valor.

### Cor

| Token | Par de texto | Para quê |
|---|---|---|
| `background` | `foreground` | fundo da página |
| `card` | `card-foreground` | superfície elevada |
| `popover` | `popover-foreground` | flutuante (menu, tooltip) |
| `primary` | `primary-foreground` | ação principal |
| `secondary` | `secondary-foreground` | ação secundária — **ver o aviso abaixo** |
| `muted` | `muted-foreground` | texto de apoio, fundo neutro |
| `accent` | `accent-foreground` | destaque de item (hover de menu) |
| `destructive` | `destructive-foreground` | ação irreversível |
| `success` | `success-foreground` | **novo na Seção 6** |
| `warning` | `warning-foreground` | **novo na Seção 6** |
| `info` | `info-foreground` | **novo na Seção 6** |

Os três de estado nasceram medidos: 5,07:1, 4,91:1 e 6,63:1, os três acima do
piso de 4,5:1 nos dois temas.

> ⚠️ **`secondary` reprova contraste, e isso é conhecido e deliberado.** O par
> `secondary`/`secondary-foreground` dá **3,93:1** nos dois temas — abaixo do
> piso. `secondary` é o coral da marca (`#F88379`), e corrigir é decisão de
> identidade visual, não de camada de UI: ficou **fora** da Seção 6, registrado
> na catraca. Outros dois reprovados herdados: `muted` (4,34:1) e `destructive`
> (3,59:1), os dois só no tema claro.
>
> Consequência prática para a Seção 8: **não escolha `secondary` para texto
> pequeno**. O par passa no visual e falha no leitor com baixa visão.

E uma folga que vale saber antes de mexer em tema: **`primary` no tema claro
está em 4,77:1, a 0,27 do piso.** Qualquer clareamento do teal ou
escurecimento do texto derruba — e a catraca reprova, que é o comportamento
desejado.

### Raio, tipografia e espaçamento

`--radius-sm|md|lg|xl`, `--text-xs` … `--text-3xl`, `--space-1|2|3|4|6|8`.

Estes **descrevem a escala que já era renderizada**; nenhum valor mudou quando
entraram. Existem para que a escala tenha nome, e para que a Seção 8 tenha o
que citar em vez de repetir número.

---

## 2. `QueryBoundary` — os três estados de dado, por tipo

```tsx
<QueryBoundary
    query={useProducts(filtros)}
    skeleton={<GradeSkeleton />}
    empty={<EmptyState titulo="..." descricao="..." />}
    error={(erro, refazer) => <ErroDaTela erro={erro} aoTentarDeNovo={refazer} />}
>
    {(dados) => <Grade produtos={dados.items} />}
</QueryBoundary>
```

`skeleton`, `empty` e `error` **não têm default de propósito**: o caminho feliz
sozinho deixa de compilar. São três dos cinco estados da constituição — "padrão"
é o próprio `children`, e "hover/foco" é estado visual, cobrado pelo lint de
acessibilidade e pela galeria, não por este componente.

### Como escolher o critério de vazio

`isEmpty` é **opcional**. Sem ele vale `vazioPorPadrao`, que reconhece os dois
formatos que a camada de dados devolve hoje:

| O que a query devolve | Vazio por padrão? |
|---|---|
| array puro (`T[]`) | sim, quando `length === 0` |
| página (`{ items, total, page, size, pages }`) | sim, quando `items.length === 0` |
| qualquer outro objeto | **não** — passe `isEmpty` |

O formato de página é o que a Seção 5 padronizou para lista paginada (ver
`src/features/library/types.ts`, `RESPOSTA_VAZIA`). Ele está no critério padrão
porque `isEmpty` ser opcional fazia toda tela paginada que o esquecesse
renderizar `children` com lista vazia em vez do estado vazio — sem erro de
tipo, sem lint, sem teste. Objeto **sem** `items` continua não sendo chutado
como vazio: ali o componente não tem como saber o que "vazio" significa, e quem
decide é a tela.

Passe `isEmpty` explícito quando "vazio" for uma regra sua — por exemplo, uma
página cheia de itens que o filtro atual esconde, ou um total agregado igual a
zero. `isEmpty` explícito sempre ganha do padrão.

---

## 3. Os cinco componentes novos

Todos em `ArchSmart-web/src/components/ui/`. A assinatura completa está no
arquivo; aqui vai o que ela **decide**.

### `EmptyState`

```tsx
EmptyState({ titulo: string, descricao: string, icone?: ReactNode,
             acao?: { rotulo: string; aoClicar: () => void } })
```

**Decisão de produto:** `titulo` e `descricao` são obrigatórios. Vazio mudo é o
defeito que este componente existe para impedir — toda tela vazia diz o que
aconteceu. `acao` é opcional porque nem todo vazio tem saída (um filtro sem
resultado não tem botão que resolva).

### `CurrencyInput`

```tsx
CurrencyInput({ value: number /* CENTAVOS */, onChange: (centavos: number) => void, ...props })
```

**Decisão de produto:** `value` e `onChange` falam **centavos inteiros**, nunca
reais em ponto flutuante — 0,1 + 0,2 não dá 0,3, e orçamento é a Ação de Valor
do produto. A tela nunca precisa saber formatar moeda: a formatação mora aqui.
Ver a armadilha do espaço não-quebrável na seção 6.

### `FormField`

```tsx
FormField({ id: string, rotulo: string, erro?: string, sensivel?: boolean,
            children: ReactElement })
```

**Decisão de produto:** liga rótulo e campo por `htmlFor` **injetando o `id` no
filho** — o chamador não repete o id, e não existe rótulo órfão por descuido. Um
`id` que o filho já traga ganha (ele pode estar ligado a outra coisa), e aí a
divergência com o `htmlFor` fica visível em vez de ser consertada por baixo.
`erro` vira `aria-invalid` + `aria-describedby`, anunciado por leitor de tela e
não só pintado de vermelho. `sensivel` marca `data-private`, para telemetria e
session replay nunca capturarem o valor — e mora **aqui**, não na tela, porque
"este campo é sensível" é decisão de produto: deixá-la na tela é como ela some.

### `ErrorBoundary`

```tsx
ErrorBoundary({ fallback: (erro: Error, tentarDeNovo: () => void) => ReactNode, children })
registrarReportadorDeErro(fn: (erro: Error, info: React.ErrorInfo) => void)
```

**Decisão de produto:** o plugue de telemetria nasce **vazio de propósito** —
telemetria é a Seção 7. Quando ela chegar, chama `registrarReportadorDeErro`
uma vez no shell e todo `ErrorBoundary` da aplicação passa a reportar, sem
tocar em nenhuma tela. A Seção 6 não antecipa a 7.

### `DataTable`

```tsx
DataTable({ colunas: ReadonlyArray<{ chave: keyof T & string; rotulo: string }>,
            linhas: ReadonlyArray<T>, chaveDaLinha: (linha: T) => string,
            porPagina?: number /* 20 */ })
```

**Decisão de produto:** nenhuma tela reimplementa "clicar no cabeçalho ordena"
de um jeito diferente, e a ordenação é **anunciada por `aria-sort`**, não só
por uma seta que leitor de tela não lê. A paginação volta para a primeira
página quando a lista ou a ordem mudam — filtrar para uma lista menor deixava o
usuário em "Página 3 de 1", tabela vazia. A troca de lista é detectada pelo
**conteúdo** (as chaves das linhas), não pela identidade do array: a tela quase
sempre passa `linhas` de um `.filter()` inline, que é array novo a cada render.

---

## 4. Os três endurecidos

Já existiam (shadcn); a Seção 6 mudou o que estava errado, e só isso.

| Componente | O que mudou | Por quê |
|---|---|---|
| `DropdownMenuItem` | `min-h-11` | alvo de toque de 44px; abaixo disso o dedo erra |
| `Skeleton` | `aria-hidden="true"` | placeholder não é conteúdo — leitor de tela não anuncia |
| `AlertDialog` | **nada** | ver a armadilha na seção 6: o defeito estava no teste |

---

## 5. A galeria `/dev/componentes`

`ArchSmart-web/src/app/dev/componentes/` — cada componente com **os estados
dele**, não só o caminho feliz.

Serve para três coisas: ver um estado sem ter que produzi-lo na aplicação
(o vazio, o erro, o carregando do `QueryBoundary` estão os quatro na tela ao
mesmo tempo); revisar mudança de token nos dois temas de uma vez; e **é onde o
axe roda** — `src/__tests__/galeria.test.tsx` executa `axe-core` sobre ela e
exige **zero violação**. Nasceu em zero e é portão fechado, não catraca: código
novo não tem dívida para herdar. A única regra desligada é `region`, porque a
galeria é fragmento, não documento.

A rota responde `notFound()` quando `NODE_ENV === "production"`, e o
`metadata.robots` é `index: false`. Ela não existe em produção: uma rota
pública listando a interface inteira é superfície que não precisamos oferecer.

> ⚠️ **Risco conhecido no `fake()` da galeria.** O objeto de query falsa usa
> `as unknown as UseQueryResult<T>`: ele não satisfaz o shape real, e hoje
> funciona porque `QueryBoundary` lê só cinco campos. Se `QueryBoundary` passar
> a ler outro campo, a galeria continua compilando e passa a mostrar o estado
> **errado**, sem erro de tipo. Quem mexer em `QueryBoundary` confere o `fake`.

---

## 6. Duas armadilhas que esta seção descobriu

Estavam só em comentário de teste. Ficam aqui porque as duas custam uma hora de
depuração para quem as encontra de novo — e as duas reproduzem em navegador de
verdade, não são artefato de jsdom.

### `Intl` formata moeda com espaço **não-quebrável**

`Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` separa
`R$` do número com **U+00A0**, não com espaço comum. `"R$ 123,45"` escrito com
espaço comum **nunca** bate com o formatado, apesar de os dois serem idênticos
na tela.

Isso é o formato tipograficamente correto — evita que símbolo e valor quebrem
em linhas diferentes —, e `dashboard/page.tsx` já exibe o mesmo caractere via
`toLocaleString`. **`CurrencyInput` não normaliza**: o `Intl` é a fonte de
verdade. Quem comparar a string exibida (teste, ou outro código) escreve o
separador como escape explícito (` `), nunca como espaço comum:
`` `R$${ESPACO}123,45` `` no teste, com `const ESPACO = " "`.

### `AlertDialogContent` sem `AlertDialogCancel` não foca nada

O `onOpenAutoFocus` padrão do Radix
(`@radix-ui/react-alert-dialog@1.1.15`) sempre chama `preventDefault()` e então
tenta focar a ref interna do `Cancel`. Sem um `AlertDialogCancel` na árvore
essa ref é `null`, o `preventDefault()` já rodou, e o fallback do próprio
`FocusScope` (focar o primeiro elemento focável) nunca dispara: **ninguém
recebe foco**.

Todo uso real no produto tem `Cancel` (conferido nos 10 usos em `src/`), então
o caminho não ocorre em produção e `alert-dialog.tsx` ficou como o Radix
entrega. Se você escrever um `AlertDialogContent` sem `Cancel`, o foco é seu
problema — e o sintoma é silencioso.

---

## 7. As catracas de UI, e o que cada uma **não** enxerga

Baseline em `tools/catraca.json`; medida por `python tools/catraca.py`. Cada
número só pode descer. Ver o [ADR 0006](decisoes/0006-portoes-de-ci-com-catraca.md).

| Medida | Hoje | Quem zera |
|---|---|---|
| `cores_literais` | 518 | Seção 8, tela a tela |
| `contraste_reprovado` | 4 pares | decisão de identidade visual (fora de escopo) |
| `tabindex_negativo` | 5 | Seção 8 |
| `hover_sem_focus` | 8 | Seção 8 |
| `arquivos_acima_de_400` | 8 arquivos | Seção 8 (e dois estão fora de escopo) |

**O ponto cego importa mais que o número.** Uma catraca mede o que a régua
dela vê, e a régua é um regex:

- **`cores_literais` chegando a zero NÃO significa zero cor literal.** A régua
  casa `(bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder)-<paleta>-<número>`
  e `(bg|text|border)-[#hex]`. Ficam de fora:
  - **`bg-white`, `text-white`, `bg-black`** e afins — não têm número, e
    `white`/`black` não estão na lista de paletas. Medido em 10/09/2026:
    **67 ocorrências** (`grep -rnoE "\b(bg|text|border|ring|ring-offset)-(white|black)\b" src --include=*.tsx --include=*.ts | wc -l`).
  - **hex arbitrário fora de `bg`/`text`/`border`** — `ring-[#...]`,
    `shadow-[#...]`, `from-[#...]`. Medido: **2**
    (`grep -rnoE "\b[a-z-]+-\[#[0-9a-fA-F]{3,8}\]" src --include=*.tsx --include=*.ts | grep -vE "\b(bg|text|border)-\[#" | wc -l`).
  - **hex em `style` inline** (`style={{ color: "#F88379" }}`) — a régua só olha
    classe utilitária. Medido: **0** hoje, o que quer dizer "não existe", não
    "não pode existir".
  - **`ring-offset-*`** e qualquer utilitário de cor que a lista de prefixos não
    nomeie.
- **`hover_sem_focus`** conta **linhas**, e só pega `opacity-0` + `group-hover:`
  na mesma `className`. Um `opacity-0` revelado por hover escrito em duas linhas
  escapa, e outras formas de esconder (`invisible`, `hidden`, `sr-only` mal
  usado) não são medidas.
- **`tabindex_negativo`** casa `tabIndex={-1}` literal. `tabIndex={x}` com `x`
  calculado escapa.
- **`contraste_reprovado`** lê os pares `X`/`X-foreground` de `globals.css`.
  Texto sobre imagem, sobre gradiente, ou um par que a tela componha à mão
  (`text-muted-foreground` sobre `bg-card`) não é medido por ninguém.
- **`arquivos_acima_de_400`** é lista de caminhos, não contagem, justamente para
  dizer **qual** arquivo cresceu — e para os que estão fora de escopo ficarem
  registrados por nome em vez de virarem enumeração em prosa, que envelhece.

Se você zerar uma medida, não escreva que o problema acabou. Escreva que a
régua parou de encontrar.
