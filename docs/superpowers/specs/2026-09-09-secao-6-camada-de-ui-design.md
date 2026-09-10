# Seção 6 — Camada de UI (desenho)

**Data:** 09/09/2026
**Estado:** aprovado por Thiago em 09/09/2026, antes de existir plano de execução.
**Relação com a spec das nove seções:** este documento **corrige e detalha** a
[Seção 6 da spec de 23/08/2026](2026-08-23-reestruturacao-arq-smart-design.md).
Onde os dois discordarem, vale este — e a spec foi corrigida no mesmo commit
para não deixar duas versões de pé.

---

## Por que este documento existe

A Seção 6 da spec foi escrita em 23/08/2026, antes das Seções 4 e 5 mexerem no
frontend. Vários números dela envelheceram, e duas decisões de fronteira que ela
não tomou decidem o tamanho da seção. Medir primeiro, decidir depois, é a regra
da casa — o que segue é o resultado de medir.

### O que a spec afirmava, e o que a medição de 09/09/2026 diz

| A spec (23/08) | Medido em 09/09/2026 | Comando |
|---|---|---|
| `<img>`: 14 | **25** | `grep -rn "<img" src --include=*.tsx \| wc -l` |
| `opacity-0 group-hover` sem `focus-within`: 9 | **9** (10 ocorrências, 1 já tem) | `grep -rn "opacity-0" src --include=*.tsx \| grep group-hover` |
| `tabIndex={-1}`: 5 | **5** | `grep -rn "tabIndex={-1}" src --include=*.tsx \| wc -l` |
| `next/dynamic`: 0 | **0** | `grep -rn "next/dynamic" src --include=*.tsx --include=*.ts \| wc -l` |
| `MainBudgetArea` 642 | **634** | `wc -l` |
| `AppShell` 574 | **569** | `wc -l` |
| `dashboard/page` 557 | **593** (cresceu) | `wc -l` |
| `ProjectWizard` 553 | **551** | `wc -l` |
| 4 deps instaladas e nunca importadas | **4**, todas ainda com 0 import | `grep -rn <dep> src \| wc -l` |
| `@types/react-big-calendar` em `dependencies` | confirmado (linha 47, dentro do bloco 14–73) | `grep -n '"dependencies"\|"devDependencies"' package.json` |
| "os 30 shadcn existentes permanecem" | **30** | `ls src/components/ui/ \| wc -l` |

Todos os comandos acima rodam de `ArchSmart-web/`.

### Duas coisas que a spec descreve errado, e que mudam o trabalho

1. **`AlertDialog`, `DropdownMenu` e `Skeleton` já existem** em
   `src/components/ui/`. A spec os lista junto dos componentes a construir. A
   tarefa real é **endurecer** o que está lá (foco preso, alvo de toque, estados),
   não criar do zero. Não existem hoje: `QueryBoundary`, `EmptyState`,
   `CurrencyInput`, `ErrorBoundary`, `DataTable`, `FormField` próprio.

2. **`QueryBoundary` não consegue obrigar os 5 estados.** Os 5 estados da
   constituição (`spec-kit-2/memory/constitution.md`, linha 146) são *Padrão,
   Hover/Foco, Carregando, Erro e Vazio*. Um componente de fronteira de query
   obriga **três** — carregando, erro e vazio. "Padrão" é o caminho feliz, que
   é o próprio `children`; "Hover/Foco" é estado visual, cobrado pelo lint de
   acessibilidade e pela galeria. A própria spec já dizia três ("recebe skeleton,
   empty e error como parâmetros obrigatórios") enquanto o título dizia cinco. A
   caixa do `PROGRESS.md` foi renomeada para o que a ferramenta de fato garante.

---

## Decisões de fronteira

### 1. As 521 cores literais **não** são zeradas nesta seção

**Medição.** 521 ocorrências em 39 arquivos, distribuídas assim:

| Onde | Ocorrências |
|---|---|
| telas do app (`(dashboard)/`) | 199 |
| portal do cliente | 156 |
| landing / marketing | 75 |
| outros componentes | 65 |
| auth | 23 |
| `components/ui/` (shadcn) | **3** |

O arquivo campeão é `src/app/portal/[uuid]/components/PortalBudget.tsx`, com 92.

**Decisão.** A Seção 6 acrescenta os tokens e converte apenas o que ela mesma
toca — os 3 de `components/ui/` e os componentes que ela cria. As 39 telas são
convertidas na **Seção 8**, dentro da migração de cada tela: uma passada por
tela, não duas.

**Por quê.** 73% das ocorrências estão em telas que a Seção 8 reescreve de todo
jeito. Convertê-las agora é escrever o mesmo arquivo duas vezes e misturar o
diff de UI com o de dados — o "migrar de passagem" que o `CLAUDE.md` da raiz
proíbe.

**Consequência documental.** O comentário em `tools/catraca.py` dizia
*"cores_literais: 521 hoje; a Secao 6 zera, quando os tokens existirem"*. Passa
a dizer que quem zera é a Seção 8. A catraca continua medindo, e continua só
podendo descer.

### 2. As 25 imagens também vão para a Seção 8

Trocar `<img>` por `next/image` com `sizes` é mudança linha a linha dentro da
tela — mesma natureza das cores, mesma passada. Deixa de ser caixa própria da
Seção 6 e passa a fazer parte da migração de cada tela na Seção 8. O total de
63 tarefas do `PROGRESS.md` não muda: a caixa liberada na Seção 6 é ocupada
pela tarefa do usuário de teste.

### 3. Quebra de arquivo e code splitting **ficam** na Seção 6

Ao contrário das cores e das imagens, estas duas são **estruturais**: não mudam
comportamento, cabem em commit próprio e são melhor lidas fora de um diff de
migração. E há um ganho direto para a Seção 8 — ela passa a editar arquivos de
~250 linhas em vez de 634, que é o motivo declarado da tarefa ("edição por IA é
confiável no que cabe em contexto").

### 4. O portão de validação da Seção 5 fecha **dentro** desta seção

Decidido por Thiago em 09/09/2026: não se mede com credencial de usuário real
emprestada. A Seção 6 cria um usuário de teste dedicado e fecha o portão inteiro
— número de tempo **e** verificação viva da hidratação. Até isso existir, a
Seção 8 não pode se apoiar na Seção 5.

**O que já existe e não precisa ser construído:** `ArchSmart-api/tools/seed.py`
foi escrito exatamente para isto. O cabeçalho dele diz que "é contra o volume
gerado aqui que o orçamento de performance de cada tela é medido nas Seções 6 e
8". Ele é determinístico (`random.seed(42)`, data de referência fixa),
idempotente, e cria a conta `"Seed — volume realista"`. Falta só um usuário de
auth vinculado a ela.

**Topologia medida em 09/09/2026**, que decide onde o usuário precisa existir:
`ArchSmart-web/.env.local` aponta `NEXT_PUBLIC_API_URL` para
`http://localhost:8000` (API local) mas `NEXT_PUBLIC_SUPABASE_URL` para o
Supabase de **staging** (`ipbhtqzybgdltewwnvnl`). O bloco ativo de
`ArchSmart-api/.env` aponta para o banco de **staging** (mesmo ref). Ou seja: o
Playwright roda contra `localhost:3000` (`playwright.config.ts`), que fala com a
API local, que fala com o banco de staging, e autentica no Supabase de staging.
O usuário de teste precisa existir no Supabase de staging **e** estar vinculado
a uma conta com volume no banco de staging.

### 5. Nenhuma cor de marca é decidida aqui

O par `secondary`/`secondary-foreground` reprova o critério de contraste nos
dois temas (3,93:1). `secondary` é o coral da marca (`#F88379`). Corrigir é
decisão de identidade visual, não de camada de UI — fica registrado na catraca
e sai desta seção.

---

## A mecânica dos portões

O ADR 0006 diz que portão que nasce vermelho é desligado na primeira semana.
Duas das ferramentas desta seção nasceriam vermelhas. A medição:

### Contraste dos tokens de hoje, nos dois temas

| Par | Claro | Escuro |
|---|---|---|
| `background` / `foreground` | 9,76:1 ✓ | 19,09:1 ✓ |
| `card` / `card-foreground` | 9,76:1 ✓ | 19,09:1 ✓ |
| `popover` / `popover-foreground` | 9,76:1 ✓ | 19,09:1 ✓ |
| `primary` / `primary-foreground` | 4,77:1 ✓ | 9,20:1 ✓ |
| `secondary` / `secondary-foreground` | **3,93:1 ✗** | **3,93:1 ✗** |
| `muted` / `muted-foreground` | **4,34:1 ✗** | 5,70:1 ✓ |
| `accent` / `accent-foreground` | 16,30:1 ✓ | 13,95:1 ✓ |
| `destructive` / `destructive-foreground` | **3,59:1 ✗** | 9,56:1 ✓ |

**Quatro pares reprovados.** Note a folga de `primary` no tema claro: 4,77:1,
a 0,27 do piso — qualquer escurecimento do texto ou clareamento do teal derruba.

### A decisão: uma medida de catraca já é as duas coisas

Thiago pediu catraca para os 4 herdados e portão fechado para os tokens novos.
Isso **não precisa** de duas ferramentas nem de uma lista de exceções:

> Uma medida `contraste_reprovado` com baseline **4** é, ao mesmo tempo, catraca
> e portão. Os 4 herdados só podem descer. Um token novo nascendo reprovado leva
> a medida para 5 — e a catraca reprova. "Portão fechado para o que a Seção 6
> cria" sai de graça, sem lista para envelhecer.

Isto é deliberado: enumeração fechada envelhece mal neste repositório, e já
produziu dois erros registrados no `CLAUDE.md`. Uma medida que conta substitui
uma lista que precisa ser mantida.

**Mesmo tratamento para acessibilidade:** `tabindex_negativo` entra em **5** e
`hover_sem_focus` em **9**.

**O axe na galeria nasce portão fechado**, com zero violação. A galeria é código
novo — não tem dívida para herdar, então não há nada para nascer vermelho.

---

## As nove tarefas

| # | Tarefa | Prova de que terminou |
|---|---|---|
| 1 | Usuário de teste E2E e fechamento do portão da Seção 5 | número de tempo gravado nos dois arquivos de medição; `/library` com API quente não emite requisição a `/api/products` no primeiro carregamento |
| 2 | Tokens completos: `--success`/`--warning`/`--info` (+ `-foreground`), escala tipográfica, espaçamento, raio | tokens novos ≥ 4,5:1 nos dois temas; `contraste_reprovado` continua 4 |
| 3 | Validador de contraste | percorre todos os pares nos dois temas; medida entra na catraca em 4 |
| 4 | `QueryBoundary` com skeleton, empty e error obrigatórios | caminho feliz sozinho não compila (erro de tipo, com teste que o prova) |
| 5 | Componentes que carregam decisão de produto | novos: `EmptyState`, `CurrencyInput`, `ErrorBoundary`, `DataTable`, `FormField`. Endurecidos: `AlertDialog` (foco preso), `DropdownMenu` (toque), `Skeleton` |
| 6 | Acessibilidade por ferramenta | lint de `tabIndex={-1}` e de `opacity-0 group-hover` sem `focus-within`, com as medidas em 5 e 9; axe zero na galeria |
| 7 | Galeria `/dev/componentes`, protegida e não indexável | os estados de cada componente visíveis; é onde o axe roda |
| 8 | Code splitting | `next/dynamic` > 0 em Agenda, builder de apresentação, impressão e modais pesados; as 4 deps mortas removidas; `@types/react-big-calendar` em `devDependencies` |
| 9 | Quebra dos arquivos grandes | 634 / 593 / 569 / 551 → **alvo ~250 linhas**, critério verificável: nenhum dos quatro acima de **400**. Os dois números são diferentes de propósito: 250 é para onde se mira, 400 é o que reprova — mirar no limite produz arquivo de 399 linhas |

### Dependência invertida na Tarefa 5

A spec pede um `ErrorBoundary` "que emite telemetria". **Telemetria é a Seção
7.** O `ErrorBoundary` desta seção nasce com um ponto de extensão e o plugue
vazio; quem liga é a Seção 7. A Seção 6 não antecipa a 7.

### A enumeração dos "4 arquivos grandes" já envelheceu

`BuilderClient` (529 linhas) e `PortalBudget` (517) estão logo atrás dos quatro
citados, e `PortalBudget` é também o campeão de cores literais (92). **O escopo
não é expandido para eles** — mas ficam registrados aqui para que a lista não
volte a ser lida como "são apenas estes", que é o erro que o `CLAUDE.md`
descreve na seção "Como trabalhar aqui".

---

## O que esta seção não faz

- Não converte as 521 cores literais (Seção 8).
- Não converte as 25 imagens para `next/image` (Seção 8).
- Não decide cor de marca.
- Não emite telemetria (Seção 7).
- Não quebra `BuilderClient` nem `PortalBudget`.
- Não liga branch protection (decisão em aberto, anterior à Seção 4).

## Riscos

1. **A Tarefa 1 age contra ambiente real** — cria usuário no Supabase de staging
   e roda `seed.py` contra o banco de staging. É a única tarefa da seção que sai
   do repositório. Exige OK explícito antes de rodar, não no meio da execução.
2. **`seed.py` apaga e recria os dados de volume da conta de seed.** É o
   comportamento documentado dele (reescrita, não detecção), mas significa que
   rodá-lo contra staging destrói o que estiver na conta `"Seed — volume
   realista"`. Nenhuma outra conta é tocada.
3. **A folga de `primary` no tema claro é de 0,27.** Qualquer ajuste de tema na
   Tarefa 2 pode derrubá-lo, o que faria `contraste_reprovado` subir de 4 para 5
   e reprovar a catraca. É o comportamento desejado — mas é bom saber antes.
4. **A Tarefa 9 é a de maior risco de regressão silenciosa**: quebrar quatro
   arquivos grandes sem mudar comportamento, em telas sem cobertura de teste.
   O plano precisa dizer como isso é verificado.
