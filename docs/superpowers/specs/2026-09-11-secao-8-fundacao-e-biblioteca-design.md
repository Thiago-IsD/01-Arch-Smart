# Seção 8 — Fundação e Biblioteca (desenho)

> Data: 11/09/2026 · Decisões de Thiago tomadas nesta data, no desenho.
>
> Este documento cobre **a fundação da Seção 8 e a primeira tela**. As outras
> oito telas não são desenhadas aqui de propósito: cada uma ganha um plano
> curto que reusa o padrão que este piloto deixar de pé. A spec-mãe já chama a
> Biblioteca de "piloto da Seção 5 — valida a previsão antes de escalar", e
> desenhar a tela 7 antes de existir qualquer aprendizado da tela 1 é decidir
> sem informação.

## Por que este documento existe

A Seção 7 fechou com **quatro pendências sem decisão** e deixou escrito que
quem planejasse a Seção 8 punha cada uma como tarefa ou registrava por escrito
a decisão de não pôr. As quatro foram decididas hoje, e três delas viram
trabalho nesta seção. A quarta — a visibilidade do `429` — ficou deliberadamente
de fora, e está registrada abaixo como tal.

Além das quatro, a Seção 8 herdava seis itens listados no `CLAUDE.md` em "O que
a Seção 8 herda". Três entram aqui (`FormField`, `e2e` sem portão, badge do
inbox sem prefetch), três ficam para a tela que os encontrar (`DataTable`,
`archsmart:budget_updated`, furos que sobrarem).

## O estado medido em 11/09/2026

Tudo abaixo foi medido hoje, com o comando ao lado. Nenhum número foi copiado
de documento anterior — dois deles, inclusive, **divergiram** do que os
documentos diziam.

| O quê | Hoje | Comando |
|---|---|---|
| `cores_literais` | 518 | `python tools/catraca.py` |
| `fetch_fora_de_lib_api` | 75 | idem |
| `tabindex_negativo` | 5 | idem |
| `hover_sem_focus` | 8 | idem |
| `contraste_reprovado` | 4 | idem |
| `arquivos_acima_de_400` | 8 | idem |
| `modulos_sem_doc` | 1 | idem |

Duas divergências com a documentação, registradas porque a regra da casa é que
número afirmado sem medição é número errado:

- A nota da Seção 8 no `PROGRESS.md` diz **521** cores literais (medido em
  09/09/2026). São **518** hoje.
- O `componentes.md` diz **67** ocorrências de `bg-white`/`text-white` invisíveis
  para a régua. São **68**.

### A superfície da Biblioteca, medida

| O que a catraca mede | Na Biblioteca | No front todo |
|---|---|---|
| `fetch` fora de `lib/api` | **0** — a Seção 5 já migrou | 75 |
| `cores_literais` | **5** | 518 |
| `tabindex_negativo` | **2** | 5 |
| `hover_sem_focus` | **1** | 8 |
| `arquivos_acima_de_400` | **3** | 8 |
| `<img>` cru | **3** | 25 |

Os três arquivos grandes são `ProductFormSheet.tsx` (453),
`NormalizationSheet.tsx` (437) e `BatchNormalizeModal.tsx` (434) — os três em
`ArchSmart-web/src/components/library/`. Reproduz com:

```
wc -l ArchSmart-web/src/components/library/*.tsx | sort -n
```

## Decisões de fronteira

### 1. A sessão em desenvolvimento deixa de ser parede

A pendência 1 da Seção 7 não é só dívida visual: a **definição de pronto** da
Seção 8 exige, por tela, "axe sem violação", "navegável só por teclado" e
"testada em 390px e 1440px". Nenhum dos três é verificável sem abrir a tela com
sessão — e `src/proxy.ts:4-8` manda para `/auth/login` toda rota fora de
`ROTAS_PUBLICAS`, inclusive a galeria `/dev/componentes`, inclusive em
desenvolvimento. Sem resolver isso, a Seção 8 começaria incapaz de fechar a
própria definição de pronto.

**Decidido: a senha do usuário de teste E2E vai para um arquivo fora do
controle de versão** — `ArchSmart-web/.env.e2e.local`, já coberto pelo `.env*`
do `ArchSmart-web/.gitignore` (linha 34) — e é lida por variável de ambiente,
nunca impressa nem colada em transcrição. Isso é deliberadamente diferente do
que aconteceu na Seção 6, em que a credencial circulou em relatório de execução
e transcrição de sessão; o risco daquele episódio foi aceito por escrito em
10/09/2026 e não será rotacionado, mas **não se repete aqui**.

A alternativa que a Seção 7 também havia registrado — isentar
`/dev/componentes` de autenticação em desenvolvimento — **não** entra. Ela
desbloquearia só a galeria, e as cinco telas reais, a Biblioteca e a prova viva
do `screen_viewed` continuariam inalcançáveis. Uma mudança no proxy que resolve
um sexto do problema é pior do que nenhuma: parece resolvido.

### 2. `load_ms` e `is_empty` são o mesmo conserto

As pendências 2 e 4 da Seção 7 têm uma causa só: hoje a telemetria **adivinha**
espiando o `QueryCache`, e quem sabe a resposta é o `QueryBoundary`.

O `TelemetriaDeTela` atual documenta os próprios defeitos
(`ArchSmart-web/src/features/telemetry/TelemetriaDeTela.tsx`, linhas 78-100):
o escopo é o cliente inteiro e não a navegação, então uma query alheia em voo
faz a tela seguinte cronometrar a anterior; e a decisão acontece no primeiro
frame, com o fallback do `<Suspense>` ainda no ar. Na Biblioteca os dois
defeitos se somam ao terceiro: a lista **nunca** dispara requisição do
navegador, porque a Seção 5 a entrega por `prefetchQuery` +
`HydrationBoundary`, então o que sobra para cronometrar é o `useInboxCount` —
a query do badge. Medido por experimento na revisão da Seção 7: `load_ms: 28`
numa tela cujo dado levou ~100 ms.

**Decidido: a tela declara prontidão; a telemetria para de inferir.**

Sai do `TelemetriaDeTela`: `useQueryClient`, `buscandoAlgo()`, `algumaBuscou`,
e os dois `requestAnimationFrame` encadeados.

Entra, no lugar do `VazioDaTelaProvider` (mesmo arquivo
`features/telemetry/contexto.tsx`, mesmo padrão de `ref` e pela mesma razão já
documentada lá — `setState` ali re-renderiza a árvore inteira do dashboard):

```
reportar({ desfecho: "dados" | "vazio" | "erro", principal: boolean })
```

O `QueryBoundary` já calcula esses três desfechos: `query.isPending` → ainda
não reportou; `isError` → `erro`; `vazio` → `vazio`; senão → `dados`. É o
`useEffect` que já existe em `components/ui/query-boundary.tsx:76`, com um campo
a mais.

O que o evento passa a gravar:

```
load_ms     = início da navegação → primeiro desfecho da região principal
medido_ate  = "dados" | "vazio" | "erro" | "pintura"
is_empty    = true (vazio) · false (dados) · null (erro, pintura)
```

`"pintura"` sobra para tela sem `QueryBoundary` nenhum — landing, páginas
legais, e toda tela que a Seção 8 ainda não migrou. Isso é o ponto: **o rótulo
passa a dizer a verdade sobre o que foi medido**, em vez de chamar de `dados`
um número que cronometrou outra coisa.

**Uma região principal por tela.** Duas marcadas emitem aviso de console em
desenvolvimento e a primeira ganha — determinístico, em vez de depender da
ordem da árvore. Isso responde a pendência 4, que perguntava o que "vazio"
significa numa tela com várias regiões: significa o vazio da região principal,
e `null` quando nenhuma foi marcada.

**O report vai para uma `ref` e fica latchado.** A telemetria lê o latch ao
montar o efeito, então a ordem de execução dos efeitos entre `TelemetriaDeTela`
e o boundary deixa de importar. Hoje funciona só porque o `TelemetriaDeTela`
aparece antes do `AppShell` na árvore (`app/(dashboard)/layout.tsx:20`), o que é
acidente de posição e não garantia.

**O início da navegação.** O orçamento da spec-mãe diz "clique → dados na tela
< 1,5 s", e o commit da rota já aconteceu depois do clique. Entra um ouvinte de
clique em fase de captura, instalado uma vez, que marca o instante quando o
alvo é link interno; o `load_ms` usa essa marca quando ela existe e o commit
quando não (URL digitada, recarga, `router.push` programático). E entra o campo
`medido_de: "clique" | "commit"`, porque um número que às vezes mede de um
ponto e às vezes de outro **sem dizer de qual** é exatamente o defeito que esta
decisão está consertando.

### 3. O balde do rate limit passa a ser por conta, e o cliente manda lote

A pendência 3: `@limiter.limit("60/minute")` no endpoint de telemetria é um
balde **global da plataforma**. O `app/core/rate_limit.py` já documenta a causa
no docstring de `chave_por_apresentacao`: o uvicorn roda sem
`--forwarded-allow-ips`, então `get_remote_address` resolve para o IP do proxy
em toda requisição.

**Decidido: `chave_por_conta` + lote no cliente.**

No servidor, `chave_por_conta(request)` nasce irmã da `chave_por_apresentacao`,
no mesmo arquivo: lê o `Authorization`, extrai o `sub` do JWT **sem verificar
assinatura**, devolve `conta:<sub>`; sem token, cai no `get_remote_address`.
Duas coisas ficam no docstring, porque são o que alguém reencontra e interpreta
errado:

- **Decodificar sem verificar serve para agrupar, nunca para autorizar.** Quem
  autoriza continua sendo o `get_repo`, que não muda.
- **Isso protege usuário legítimo de usuário legítimo**, que é o defeito real:
  hoje um navegando rápido silencia todos os outros. Não protege de inundação
  anônima com `sub` rotativo — esse caminho leva `401` do resolvedor de
  identidade, e o balde por IP continua atrás como segunda guarda.

No cliente, o `useTrack()` hoje manda **uma requisição por evento**
(`features/telemetry/hooks.ts:16`), apesar de o contrato do servidor já ser
lote. Entra uma fila em módulo: acumula, descarrega depois de ~1 s ou ao juntar
N eventos, e descarrega na saída da página (`pagehide` e
`visibilitychange: hidden`) com `keepalive: true` — senão a última navegação da
sessão se perde, que é justo a que diz onde o usuário parou. Isso exige
acrescentar `keepalive?: boolean` ao tipo `Requisicao` de `lib/api/core.ts` e
repassá-lo ao `fetch`: duas linhas, e mantém toda chamada de rede saindo de
`lib/api/` (Art. 4).

**O que NÃO entra, por decisão:** o `429` continua engolido em silêncio por
`enviarEventos`. Tornar a perda observável era a quarta alternativa avaliada e
não foi a escolhida. Com balde por conta e lote, atingir o teto fica muito mais
difícil — mas "mais difícil" não é "observável", e quem reencontrar isso está
lendo a decisão, não um esquecimento.

### 4. O `FormField` padrão é o do react-hook-form

Existem dois componentes exportando `FormField`. O dado que decide:

```
grep -rln "components/ui/form-field" ArchSmart-web/src --include=*.tsx   # 2: a galeria e o teste dela
grep -rln 'from "@/components/ui/form"' ArchSmart-web/src --include=*.tsx | wc -l   # 11 telas
```

O da Seção 6 é usado por **zero telas reais**. O do react-hook-form é usado por
**11**, e já faz a ligação de rótulo, `aria-invalid` e `aria-describedby` pelo
`useFormField`. A única coisa que o da Seção 6 tem e o outro não é a decisão de
produto `sensivel` → `data-private`.

**Decidido: padrão é o conjunto de `@/components/ui/form.tsx`.** O `sensivel`
migra para o `FormItem`, com o comentário que explica por que essa decisão não
mora na tela. `form-field.tsx` é apagado, sai da galeria, e os **5** testes que
hoje cobrem o comportamento dele em `__tests__/componentes-ui.test.tsx`
(incluindo o do `data-private`, linha 127) são reescritos contra o conjunto do
rhf — nenhuma garantia morre no caminho. As 11 telas não são tocadas; a
Biblioteca, que é duas delas, ganha o `sensivel` disponível quando precisar.

### 5. A régua é consertada antes de medir as telas

O `componentes.md` já registra que "catraca em zero não quer dizer defeito em
zero". Os furos, medidos em 11/09/2026:

| Furo | Ocorrências |
|---|---|
| `bg-white`/`text-white`/`-black` — a paleta do `RE_PALETA` não inclui `white`/`black` | **68** |
| hex fora de `bg\|text\|border` (ex. `shadow-[#...]`) | **2** |
| `invisible`/`hidden` + `group-hover` — o mesmo defeito que `opacity-0` | **1** |
| `ring-offset-<paleta>-<n>` | **0** (o furo existe; não há ocorrência) |

**Decidido: consertar agora, na fundação.** Os quatro furos são tapados em
`tools/catraca.py` **com o teste de cada um no mesmo commit** — a regra que a
Seção 6 estabeleceu depois de achar três cegueiras em `comparar()` — e o
baseline é regravado com `--atualizar --aceitar-piora`:

```
cores_literais    518 → 588
hover_sem_focus     8 → 9
```

O número sobe sem nenhum defeito novo ter entrado: é a régua passando a ver o
que sempre existiu. O flag `--aceitar-piora` é exigido porque a ferramenta trata
piora como piora, e o aviso que ela imprime é o registro. A justificativa vai no
PR, como nas Seções 5, 6 e 7.

A razão de ser agora e não no fim: as outras oito telas migram medidas por esta
régua. Com os furos abertos, uma tela "zerada" pode ter `bg-white` sobrando, e a
queda medida de cada uma seria parcialmente fictícia — o que é pior do que não
medir, porque tem aparência de prova.

## As dez tarefas

| # | Tarefa | Prova que a fecha |
|---|---|---|
| 1 | Sessão em dev e verificação visual da Seção 6 | Capturas das 5 telas e da galeria; `docs/dev/medicoes/2026-09-10-verificacao-visual-secao-6.md` atualizado item a item |
| 2 | Furos da catraca | 4 testes novos, um por furo; baseline em 588 e 9, com o aviso da ferramenta no PR |
| 3 | Canal de prontidão (decisão 2) | Testes em `__tests__/telemetry.test.tsx`, incluindo o caso prefetch+hydration que hoje sai errado |
| 4 | `chave_por_conta` no rate limit | Teste: dois `sub` enchem baldes separados; sem token cai no IP |
| 5 | Fila no cliente e `keepalive` | Teste: N eventos viram 1 requisição; `pagehide` descarrega |
| 6 | `FormField` unificado | Os 5 testes reescritos contra o rhf, `data-private` incluído; `form-field.tsx` apagado |
| 7 | Biblioteca: `QueryBoundary`, região principal, badge no prefetch | O `isLoading ? spinner :` e o vazio inline de `LibraryContent.tsx` saem; `useInboxCount` entra no `LibraryData.tsx` |
| 8 | Biblioteca: os três arquivos acima de 400 linhas | `arquivos_acima_de_400` 8 → **5** |
| 9 | Biblioteca: acessibilidade, tokens, responsivo | 5 cores → 0; 2 `tabIndex={-1}` → 0; 1 hover sem focus → 0; 3 `<img>` → `next/image`; axe sem violação; 390px e 1440px; só teclado |
| 10 | Job de Playwright no CI e medição final | 4º job no `ci.yml` contra staging com a credencial em Secrets; `medicao-biblioteca` comparada com os 1454 ms de 10/09; `hidratacao-biblioteca` verde; a prova viva do `screen_viewed`; `docs/dev/modulos/library.md` com o número; `PROGRESS.md` em 50/64 |

A Tarefa 1 é primeira porque desbloqueia as Tarefas 9 e 10 e porque a dívida
visual da Seção 6 só fica mais cara quando a Seção 8 escrever por cima das
mesmas telas. A Tarefa 2 é segunda porque tudo depois dela é medido pela régua
consertada.

### O portão de e2e

O `e2e/` não roda em portão nenhum hoje: o `vitest.config.ts` exclui `e2e/**` e
não há job de Playwright no `ci.yml`. O `hidratacao-biblioteca.spec.ts` — a
única prova viva de que o prefetch da Seção 5 funciona — é instrumento de
medição, não guarda, e a Tarefa 7 edita exatamente a tela que ele cobre.

**Decidido: quarto job no CI, rodando os specs de `e2e/` contra staging**, com a
credencial do usuário E2E em GitHub Secrets. A prova da hidratação e a medição
de cada tela passam a ser guarda permanente. Duas consequências assumidas: o job
depende de ambiente externo, e o CLAUDE.md proíbe "é esperado que falhe" — então
um flake ali é defeito a consertar, não ruído a tolerar.

### O orçamento de API, e a décima primeira tarefa

O orçamento da spec-mãe pede **API P95 < 400 ms**; o baseline da Biblioteca é
**1.220 ms**. Os outros itens a Biblioteca já cumpre ou dão para medir (clique →
dados: 1454 ms, medido em 10/09/2026, contra alvo de 1,5 s).

**Decidido: a Tarefa 10 mede o P95 real de `/api/products` contra staging com o
seed de volume e registra o número. Se passar de 400 ms, abre-se uma Tarefa 11
explícita de backend** — não se enxerta otimização de query "de passagem" dentro
de uma tarefa de tela. O CLAUDE.md proíbe migrar área de passagem justamente
porque mistura mudanças e torna impossível saber o que causou uma regressão.

## O que esta seção não faz

- **As outras oito telas.** Cada uma ganha seu plano curto depois, reusando o
  padrão que este piloto deixar de pé.
- **`DataTable`.** A Biblioteca é grade de cards, não tabela. O problema
  registrado (sem renderizador de célula, ordena e pagina no cliente enquanto as
  listagens reais são paginadas no servidor) fica para a tela que precisar dele —
  provavelmente Projetos ou Financeiro.
- **`archsmart:budget_updated`.** É do Orçamento, e renomear é mudança de
  contrato entre emissor e ouvinte: mexer só nos emissores quebra o rodapé de
  totais em silêncio. Quem migrar o Orçamento renomeia, medindo antes com
  `grep -rn "archsmart:" ArchSmart-web/src`.
- **Visibilidade do `429`.** Decisão registrada na decisão 3.
- **`contraste_reprovado`.** Os 4 de hoje incluem o `secondary`, que é o coral da
  marca; mexer nisso é decisão de marca, não de migração de tela.

## Riscos

- **O job de e2e no CI depende de staging.** Cold start do Render já foi medido
  em 41,9 s ([ADR 0009](../../dev/decisoes/0009-prefetch-dentro-de-suspense.md)) e em
  41,4 s em 08/09/2026,
  e isso precisa estar no timeout do job, senão o primeiro PR da manhã reprova
  por um motivo que não é defeito de código.
- **O ouvinte de clique para o `medido_de: "clique"`** é código novo no caminho
  de toda navegação. Se der errado, o modo de falha é silencioso — por isso o
  fallback para o commit existe, e por isso o campo diz de onde mediu.
- **A Tarefa 2 sobe o baseline em ~70**, e isso vai parecer regressão para quem
  olhar o `tools/catraca.json` sem ler o PR. O aviso que a ferramenta imprime e
  a justificativa no PR são o que impede essa leitura errada.
- **O P95 de API pode abrir uma tarefa de backend** dentro de uma seção de
  telas. Está previsto acima, mas o tamanho dela é desconhecido até a medição.
