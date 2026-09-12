# Módulo: `features/telemetry`

O lado do cliente da telemetria de produto: manda evento para a API e emite
`screen_viewed` sozinho, uma vez por navegação, em toda tela autenticada.

O objetivo é responder "quais telas as pessoas abrem, e quanto tempo esperam
até ver dados" sem que nenhuma tela precise saber que telemetria existe. Quem
escreve tela nova não instrumenta nada: monta dentro de `(dashboard)/` e o
evento sai. O que a tela **declara** é outra coisa, e é o assunto da seção
"O protocolo de prontidão": quem usa `QueryBoundary` ganha um `load_ms` que
mede até os dados; quem não usa ganha um `load_ms` rotulado `pintura`.

## O que expõe

| Símbolo | Onde | O que faz |
|---|---|---|
| `useTrack()` | `hooks.ts` | Devolve `track(nome, propriedades?)`, estável entre renders. **Não manda nada: enfileira.** Quem junta o lote e decide o momento de enviar é `fila.ts`. |
| `enfileirar(evento)` / `descarregar(opcoes?)` | `fila.ts` | A fila. Junta a janela de 1 s num lote só, descarrega sozinha ao chegar a **20** eventos, e descarrega com `keepalive` no `pagehide` e na aba escondida. |
| `TAMANHO_MAXIMO` | `fila.ts` | **20** — em quantos eventos a fila descarrega sozinha. Exportada só para que um teste a compare com o teto do servidor; ver "Contrato com a API". |
| `_zerarFila()` | `fila.ts` | Só para teste: zera a fila, cancela o timer e desliga o estado de saída. |
| `<TelemetriaDeTela />` | `TelemetriaDeTela.tsx` | Emite `screen_viewed` uma vez por navegação. Não renderiza nada. |
| `ProntidaoDaTelaProvider` | `contexto.tsx` | O canal por onde as regiões de dados da tela anunciam que existem e reportam que resolveram. |
| `useProntidao()` | `contexto.tsx` | Leitura do canal. **Devolve `null` fora do provider** — a galeria `/dev/componentes` usa o `QueryBoundary` e não fica dentro de `(dashboard)`. |
| `ContextoDeProntidao` | `contexto.tsx` | O contexto cru. Existe **só para teste** injetar um canal espião (contar chamadas, que o provider real não permite). Tela nenhuma usa: telas usam `useProntidao()`. |
| `normalizarTela(caminho)` | `types.ts` | `/projects/<uuid>` → `/projects/[id]`. |
| `decidirMedicao(report, houveAnuncio)` | `types.ts` | O rótulo de `medido_ate` a partir do que a tela reportou. |
| `vazioDoDesfecho(desfecho)` | `types.ts` | `true` / `false` / `null` para `is_empty`. |
| `enviarEventos(eventos, opcoes?)` | `api.ts` (reexporta `lib/api/telemetry.ts`) | Manda o lote. **Nunca rejeita.** |

A interface do canal, em `contexto.tsx`:

```ts
export type Desfecho = "dados" | "vazio" | "erro"
export interface Report { desfecho: Desfecho; principal: boolean }

export interface ProntidaoDaTela {
    anunciar: (origem: object) => void                     // "existe região aqui"
    reportar: (report: Report) => void                     // "minha região resolveu"
    assinar: (ouvinte: (r: Report) => void) => () => void  // a telemetria ouve
    anunciadas: () => number                               // quantas regiões DISTINTAS
    limpar: () => void                                     // a cada navegação
}
```

Três propriedades deste canal não são óbvias pela assinatura, e as três foram
acrescentadas na revisão final da Seção 8 (`telemetry-contexto.test.tsx` cobre
cada uma):

- **O report fica latchado.** `reportar` guarda o último report numa `ref`, e
  quem **assinar depois** o recebe na hora. Sem isso, um report que chegasse
  antes de a `TelemetriaDeTela` assinar era descartado em silêncio — e o efeito
  era global: **todo evento virava `pintura`**. A spec prometia esse latch desde
  o começo, chamando a alternativa (depender da ordem dos efeitos) de *"acidente
  de posição e não garantia"*; o código não o tinha. `limpar()` zera o latch
  junto, senão a tela seguinte herdaria o `load_ms` da anterior.
- **Duas regiões `principal` emitem `console.warn` em desenvolvimento**, uma vez
  por navegação. Quem ganha continua sendo a primeira a **reportar**, que é a
  ordem da árvore — é justamente por não ser determinístico que precisa de
  aviso. É a única guarda contra o erro de cópia mais provável das oito telas
  seguintes: duas `principal`, ou nenhuma.
- **`anunciadas()` conta regiões distintas, não chamadas.** É por isso que
  `anunciar` recebe uma `origem` (um objeto estável por instância, e `Report`
  carrega a mesma coisa). Antes era um contador, e **não era uma contagem**: sob
  StrictMode o efeito de cada região roda duas vezes sem decremento no cleanup,
  então uma região devolvia `2`. Era inócuo enquanto só `> 0` fosse consumido,
  mas a [pendência 4 da Seção 7](../../../CLAUDE.md) é exatamente onde alguém vai
  querer contar regiões de verdade — e o mesmo conserto é o que impede o aviso
  acima de disparar falso em desenvolvimento, onde o StrictMode está ligado.

## Contrato com a API

`POST /api/telemetry/events`, corpo `{"eventos": [{"name", "properties"}]}`,
resposta **204 sem corpo**. Máximo de **50** eventos por lote
(`max_length` em `ArchSmart-api/app/schemas/telemetry_schema.py`), `name` de
até 100 caracteres.

**Não existe campo de conta nem de usuário no corpo** — a identidade vem do
`RequestContext`, montado no servidor a partir do token (Art. 1). Um
`account_id` mandado daqui seria, na melhor hipótese, ignorado; há teste de
fora provando isso
(`ArchSmart-api/tests/api/test_telemetria.py::test_account_id_forjado_no_corpo_e_ignorado`).

A chamada sai por `api()` de `lib/api/client.ts`, como toda chamada de rede
deste front (Art. 4). O 204 já é tratado lá dentro (`lib/api/core.ts`), então
`api<void>()` não tenta parsear corpo vazio.

**O teto do servidor (50) e o lote do cliente (20) são dois arquivos em dois
repositórios, e a relação entre eles está presa por um teste de cada lado — um
só não basta.** O risco é o mesmo nas duas direções: se o lote cheio não cabe no
teto, o Pydantic recusa o **lote inteiro** com 422, e o cliente engole o erro,
então os eventos somem calados.

| Direção perigosa | Quem reprova |
|---|---|
| baixar o `max_length` do servidor abaixo do lote do cliente | `tests/api/test_telemetria.py::test_aceita_o_lote_cheio_do_cliente` (backend), que posta 20 eventos e exige 204 |
| subir `TAMANHO_MAXIMO` do cliente acima do teto do servidor | `src/__tests__/telemetry-fila.test.ts`, descrição "o teto do servidor" (frontend) |

**Cada teste só reprova a mudança feita no lado dele**, porque cada um carrega o
número do outro como cópia literal — e é por isso que são dois. O teste de
backend sozinho (que era o que existia primeiro) deixava passar exatamente a
metade mais provável: alguém subir a fila do cliente, no arquivo onde a fila
mora. Comentário não reprova; teste reprova — e um teste só reprovava metade.

## Tabelas que toca

Nenhuma diretamente. Do outro lado do endpoint, `product_events` — ver
[`telemetry_service.md`](telemetry_service.md).

## O protocolo de prontidão

Antes da Seção 8 a telemetria **adivinhava**: espiava o `QueryCache` do cliente
inteiro para decidir se a tela tinha buscado algo, e decidia no primeiro frame
depois de montar. Os dois defeitos disso estão medidos na nota da Seção 7 do
`PROGRESS.md`; o pior deles produzia `load_ms: 28` numa tela cujo dado levou
~100 ms, porque o `<Suspense>` ainda tinha o fallback no ar naquele frame.

Hoje **a tela declara, e a telemetria ouve**. São dois sinais, não um:

1. **Anúncio** — `anunciar()`, na montagem de cada `QueryBoundary`. Responde
   "existe região de dados nesta tela", e é isso que distingue *tela sem região*
   de *região ainda carregando*. Sem o anúncio, a telemetria teria de decidir no
   primeiro frame, que era o defeito.
2. **Report** — `reportar({ desfecho, principal })`, quando a região resolve.
   `desfecho` é `dados`, `vazio` ou `erro`; o `QueryBoundary` já calculava os
   três para escolher o que renderizar.

O que a `TelemetriaDeTela` faz com isso, a cada mudança de `pathname`:

- descarrega a navegação **anterior**, se houver uma em aberto de outro caminho
  (não no cleanup do efeito: sob StrictMode isso produziria uma linha espúria
  que, pelo dedupe, mataria a linha real);
- `limpar()` o canal, e começa a contar o tempo. O início é o **clique**, quando
  houve um clique em link interno cujo destino é o caminho que de fato commitou;
  senão é o commit do efeito. `medido_de` diz qual dos dois;
- assina o canal. **Um report `principal` emite na hora.** Um report
  não-principal espera um frame, para que uma principal que chegue no mesmo
  commit ganhe dele — sem essa folga, a ordem da árvore decidiria o número;
- guarda, num `requestAnimationFrame`, o instante do primeiro frame pintado.
  **Capturar e usar são momentos diferentes**, e é isso que permite um `load_ms`
  honesto sem decidir no primeiro frame: o instante da pintura só é usado quando
  a navegação termina sem nenhum anúncio.

## O evento `screen_viewed`

| Propriedade | O que é |
|---|---|
| `screen` | O caminho normalizado (`/projects/[id]`). |
| `load_ms` | Milissegundos do início da navegação até o momento medido. O início é o clique ou o commit (`medido_de`); o fim é o que `medido_ate` diz. |
| `medido_ate` | Um dos **cinco** valores da tabela abaixo. |
| `medido_de` | `"clique"` ou `"commit"`. |
| `is_empty` | `true`, `false` ou **`null`**. |
| `principal_declarada` | `true` quando o report que decidiu o número veio de uma região marcada `principal`. |

### Os cinco valores de `medido_ate`

| Valor | Quando | O que o `load_ms` é |
|---|---|---|
| `dados` | a região reportou `dados` | tempo até os dados aparecerem — a métrica do orçamento de performance |
| `vazio` | a região reportou `vazio` | tempo até a tela decidir que não há nada |
| `erro` | a região reportou `erro` | tempo até a falha aparecer |
| `pintura` | a navegação terminou e **nenhuma** região anunciou | tempo até o primeiro frame pintado |
| `abandonado` | alguma região anunciou e nenhuma reportou antes de a navegação acabar | o tempo que o usuário esperou **sem** receber o dado |

**Os cinco existem porque, sem o rótulo, cinco medidas diferentes moram na mesma
coluna e quem consultar soma laranja com maçã.** `dados` é a única que responde
à pergunta do orçamento. `pintura` sobra para as telas que a Seção 8 ainda não
migrou; `abandonado` é informação de produto, não ruído — é o número de quem
desistiu de esperar.

Duas ressalvas sobre `pintura`, para o número não ser lido como mais do que é, e
as duas estão no docstring de `types.ts`:

- o fim é o primeiro frame pintado **quando esse frame chegou a rodar**. Em aba
  oculta o `requestAnimationFrame` não roda, e se a tela desmontar antes dele o
  fim passa a ser a saída da tela — o número fica **maior** do que a pintura
  levou;
- o início é o clique só quando deu para ancorar nele. Em carga dura (URL
  digitada, recarga) é o commit do efeito, já depois do *time origin* do
  documento, então rede e boot do bundle **não** estão dentro.

### `medido_de`, e por que a âncora de clique tem destino

O orçamento da spec é "clique → dados na tela", e o commit da rota acontece
depois do clique. Quando dá para ancorar no clique, ancora.

A marca de clique é consumida **sempre** e honrada só se o clique apontava para
o caminho que de fato commitou. Sem a conferência de destino, um clique que não
navega este documento ficava de pé indefinidamente e ancorava a navegação
seguinte num instante velho. Caso real do repositório:
`(dashboard)/settings/page.tsx` abre Termos e Privacidade com `target="_blank"`;
o usuário lia noutra aba, voltava, clicava na Biblioteca, e o evento saía
`medido_de: "clique"` cronometrando a distração dele. O ouvinte também descarta
clique modificado (`ctrl`/`meta`/`shift`/`alt`), botão que não é o principal,
`target` para fora da aba, e `href` que não é interno — `//host/x` é **externo**
apesar de começar com barra.

Na dúvida vale `commit`: mede menos, mas não mente.

### `is_empty` e `principal_declarada`

**`is_empty` é `null` quando não se sabe**, nunca `false`. "Não sei" e "não está
vazia" são coisas diferentes, e gravar `false` inventaria uma medição. Sai
`null` em `erro`, em `pintura` e em `abandonado`.

**`principal_declarada` é a etiqueta de confiança da linha.** Uma tela marca
`principal` na região que define "dados na tela" — na Biblioteca é a lista, não
o badge do inbox (`LibraryContent.tsx`). Tela com várias regiões e nenhuma
marcada usa a primeira que reportar, e o evento grava
`principal_declarada: false`: o número existe, e a coluna diz que ele é o que
sobrou, não o que a tela escolheu. Isso é o que impede a pendência 4 da Seção 7
de voltar calada — lá, `is_empty` ia gravar "o último boundary que rodou", que é
detalhe de ordem da árvore e não informação.

### ⚠️ Abas misturam `pintura` e `dados` dentro da MESMA `screen`

Correto por construção, e ainda assim uma armadilha para quem for tirar média —
e **abas são a norma nas oito telas seguintes**, então isto vale mais para elas
do que para a Biblioteca.

`normalizarTela` só troca UUID por `[id]`; ele recebe o `pathname`, que **nunca
carrega a query string** (`usePathname()` não a devolve). Então `/library`,
`/library?tab=inbox` e `/library?tab=clipper` gravam todas
`screen: "/library"` — e não são a mesma coisa:

| Aba | Renderiza `QueryBoundary`? | `medido_ate` |
|---|---|---|
| `library` / `inbox` | sim (`needsList`) | `dados` / `vazio` / `erro` |
| `clipper` | **não** — é `<ClipperOnboarding />`, estático | **`pintura`** |

Quem tirar `AVG(load_ms) GROUP BY screen` soma laranja com maçã: linhas de
`pintura` (primeiro frame de uma tela estática) com linhas de `dados` (a lista
carregada). **Agrupe também por `medido_ate`** — que é exatamente para isso que
a coluna existe. Separar as abas em `screen` distintas é possível, mas é decisão
de esquema (muda a cardinalidade da coluna e os eventos já gravados), e não foi
tomada.

## O preço assumido: tela sem região emite no fim da navegação

O protocolo tem um custo, e ele foi escolhido por escrito.

Uma tela **sem** `QueryBoundary` nunca reporta nada. A telemetria não pode
decidir por ela no primeiro frame — fazer isso era o defeito —, então o evento
dessa tela só sai quando a navegação **termina**: na navegação seguinte, no
`pagehide`, ou no desmonte de verdade do layout. O `load_ms` continua honesto,
porque o fim gravado é o instante da pintura capturado no primeiro frame; o que
atrasa é a **emissão**, não a medição.

Consequências práticas, todas vivas hoje:

- as 14 telas de `(dashboard)` que a Seção 8 ainda não migrou (são **15** no
  total, e só a Biblioteca migrou) emitem `pintura`, e emitem **tarde**;
- quem fecha o navegador por um caminho que não dispara `pagehide` nem desmonte
  (kill do processo, crash) perde a última linha. Não há como evitar isso sem
  voltar a decidir no primeiro frame;
- o desmonte é distinguido do remonte do StrictMode **depois**, por um
  `setTimeout(…, 0)` que compara a **identidade** do objeto de pendência — não o
  `pathname`. Por `pathname` o remonte do StrictMode passaria.

## A fila

`useTrack()` não manda nada: enfileira. Quem manda é `fila.ts`, e o contrato do
servidor sempre foi um lote.

- **janela de 1 s**, ou **20 eventos**, o que vier primeiro;
- a referência da fila é trocada **antes** do envio, então evento enfileirado
  durante o envio entra na fila nova, não no lote que já saiu;
- **`pagehide` → `keepalive`, e depois dele cada evento sai na hora.** A ordem
  dos ouvintes é a razão: a fila registra o dela no carregamento do módulo,
  antes de qualquer efeito de React, então ela descarrega (vazia) **antes** de a
  `TelemetriaDeTela` enfileirar a linha da saída — a última navegação da sessão,
  a que diz onde o usuário parou. A bandeira `saindo` resolve isso; um
  `pageshow` (volta do cache de navegação) devolve o comportamento de lote;
- **`visibilitychange` é ouvido em `document`**, onde é disparado, e não no
  `window`, onde só chega por borbulhamento. Aba escondida descarrega com
  `keepalive` mas **não** liga `saindo`: a aba costuma voltar.

**jsdom não destrói documento**, então `dispatchEvent(new Event("pagehide"))`
não aborta `fetch` nenhum e nenhum teste de comportamento consegue ver a falha
que o `keepalive` evita. O que `src/__tests__/telemetry-fila-keepalive.test.ts`
prova é que a opção percorre a cadeia inteira — fila → `enviarEventos` → `api` →
`core` — e aparece no objeto de init que o `fetch` recebeu.

> ⚠️ **O `keepalive` NÃO garante a entrega da última navegação, e é importante
> não ler esta seção como se garantisse.** Ele protege uma requisição **já
> iniciada**. A cadeia real na saída da página é:
>
> ```
> descarregar({keepalive:true}) → enviarEventos → api()
>   → await opts.resolverToken()      ← lib/api/core.ts:67
>   → getAccessToken() → supabase.auth.getSession()
>   → só ENTÃO fetch(..., {keepalive:true})
> ```
>
> Entre o `pagehide` e o `fetch` existe um **`await` que espera o Supabase
> resolver a sessão**. Se a página morrer nessa janela, não há requisição
> iniciada para o `keepalive` proteger, e o evento se perde — em silêncio, como
> toda perda desta fila. **E o teste não vê isso porque mocka o resolvedor de
> token**, que é exatamente a peça que insere o `await`: o teste prova que a
> opção chega ao `fetch`, não que o `fetch` chega a existir.
>
> **Isto está parqueado como decisão, não como conserto pendente de execução**
> (pendência 9 do `CLAUDE.md`). As duas saídas — cache síncrono do token, ou
> `sendBeacon` dentro de `lib/api/` — mexem em `lib/api/`, que toda tela usa, e
> por isso a consequência é maior que esta seção. Enquanto não for decidido: a
> última navegação da sessão é **melhor esforço**, não entrega garantida.

**O lote é a unidade de perda.** `enviarEventos` engole qualquer erro de
propósito (telemetria que derruba a tela do usuário é pior que telemetria
nenhuma), e desde que os eventos saem em lote, um erro engolido leva **até 20
eventos de uma vez** — não é caminho novo de perda, é o mesmo `catch` com raio
maior. Quem for investigar "faltam eventos" começa por `lib/api/telemetry.ts`,
não por um bug de emissão.

## O rate limit do endpoint, e a correção de 12/09/2026

`POST /api/telemetry/events` tem `@limiter.limit("60/minute")` com
`key_func=chave_por_conta` (`ArchSmart-api/app/core/rate_limit.py`). O balde era
por **IP do proxy** até a Seção 8 — e portanto um balde único da plataforma
inteira, porque o uvicorn roda sem `--forwarded-allow-ips` e
`get_remote_address` resolve para o proxy em toda requisição. Com `screen_viewed`
saindo a cada navegação, um punhado de usuários simultâneos encostava no teto, e
a perda pelo `429` é silenciosa — indistinguível de "ninguém navegou".

A Seção 8 fechou isso nas duas pontas: a chave virou o `sub` do portador do
token (agrupamento, **nunca** autorização — o `sub` sai de um base64 sem
verificação de assinatura), e a fila do cliente gastou uma requisição onde antes
gastava três.

> **Correção de uma afirmação que circulou como se fosse garantia.** Estava
> escrito que o balde por IP seguia como "segunda guarda" para um chamador
> anônimo que forjasse um `sub` novo a cada tentativa. **Não é.** O
> `@limiter.limit` decora `receber_eventos`, e o FastAPI resolve
> `Depends(get_repo)` **antes** de chamar a função decorada — a checagem do
> slowapi roda dentro dela (`sync_wrapper`, `slowapi/extension.py`). Token
> inválido leva 401 de `get_repo` antes de a função de chave ser chamada.
> Medido na Tarefa 4 da Seção 8, com TestClient e lendo o slowapi. O balde por
> IP não é guarda nesse cenário: o cenário **não chega lá**. Isso é detalhe de
> implementação do FastAPI/slowapi, não contrato — por isso `chave_por_conta`
> continua endurecida contra JWT ilegível mesmo sem ninguém conseguir provar
> esse caminho de fora hoje.

## O que quebra se você mexer aqui

**A ordem dos providers em `app/(dashboard)/layout.tsx` importa duas vezes.**
`TelemetriaDeTela` tem que ficar dentro do `QueryProvider` **e** dentro do
`ProntidaoDaTelaProvider` (senão `useProntidao()` volta `null` e nenhuma região
consegue reportar). E o `ProntidaoDaTelaProvider` precisa embrulhar o `AppShell`
também — os `QueryBoundary` das telas ficam dentro dele.

**`useProntidao()` precisa continuar devolvendo `null` fora do provider.** O
`QueryBoundary` é compartilhado, e a galeria `/dev/componentes` o usa de fora de
`(dashboard)`. Trocar o `null` por um `throw` derruba a galeria.

**O canal é `ref`, não `state`.** Um `setState` ali re-renderizaria a árvore
inteira do dashboard a cada região que resolve.

**A guarda de dedupe mora dentro do `emitir`.** Sob StrictMode — o default do
Next 16, e portanto o modo do `npm run dev` — o efeito monta, limpa e monta de
novo. Com a guarda só na entrada do efeito, o run 1 gravava a ref e assinava, o
cleanup cancelava, e o run 2 voltava sem assinar nada: resultado **zero**
evento, não dois. Há teste montando em `StrictMode` e exigindo exatamente uma
linha, que falha nas duas direções. O atalho no `aoReportar` é redundante por si
só (medido por mutação em 11/09/2026); tirar **os dois** faz a tela contar
dobrado com cache quente, que é a configuração da Biblioteca.

**Emitir de forma síncrona no cleanup produz linha espúria.** O primeiro
desmonte do StrictMode viraria um `abandonado` que, pelo dedupe, mata a linha
real. O `setTimeout(…, 0)` existe por isso, e a comparação é por identidade.

## O que ainda não foi medido

Honestidade primeiro: o protocolo está coberto por vitest em sete arquivos
(`telemetry.test.tsx`, `telemetry-ancora-de-clique.test.tsx`,
`telemetry-fim-de-navegacao.test.tsx`, `telemetry-fila.test.ts`,
`telemetry-fila-keepalive.test.ts`, `telemetry-types.test.ts` e
`telemetry-contexto.test.tsx`), mais `query-boundary.test.tsx` do lado de quem
reporta. Os testes provam **qual** rótulo sai e **quantas** linhas por
navegação.

> **Essa frase afirmava mais do que existia, até 12/09/2026.** Ela citava
> `query-boundary.test.tsx` como cobertura do lado de quem reporta, e aquele
> arquivo **não tinha sido tocado pela Seção 8**: não continha `anunciar`,
> `reportar`, `principal` nem `ProntidaoDaTela` — o contrato novo do componente
> que **oito telas vão copiar** era exercitado só indiretamente, pelos testes da
> `TelemetriaDeTela`. Conferível com
> `git log develop..HEAD -- ArchSmart-web/src/__tests__/query-boundary.test.tsx`,
> que saía vazio. A revisão final acrescentou o teste direto (o anúncio sai uma
> vez por montagem e **não** a cada mudança de desfecho; `principal` chega ao
> report; e os dois lados da query desabilitada) e o
> `telemetry-contexto.test.tsx`, que cobre o latch e o aviso de duas regiões
> `principal`.

**Eles não provam a grandeza do número — e em 12/09/2026 ela passou a estar
provada por outro caminho.** O que faltava era navegação real com sessão
gravando linha em `product_events`; a credencial do usuário de teste, rejeitada
pelo Supabase de staging em 11/09/2026, foi corrigida, e
`ArchSmart-web/e2e/telemetria-biblioteca.spec.ts` **rodou pela primeira vez e
passou** (três execuções consecutivas).

**O `load_ms` de `medido_ate: "dados"` é dado utilizável.** Medido na Biblioteca:
mediana de **1068 ms** (n=21, mín 871, máx 3607) contra a mediana de **1415 ms**
do E2E da mesma tela — mesma ordem de grandeza, e o `load_ms` um pouco menor
porque o E2E inclui o despacho do clique e a sondagem do seletor pelo
Playwright, enquanto o `load_ms` conta dentro da página. As 24 linhas de
`/library` saíram com `is_empty: false` e `principal_declarada: true`. Números,
comandos e a decomposição em
[`../medicoes/2026-09-06-biblioteca-depois.md`](../medicoes/2026-09-06-biblioteca-depois.md).

**A ressalva de agregação não caiu — ela ficou mais concreta:** na mesma
medição, `/dashboard` gravou `load_ms` de mediana **18 ms** com
`medido_ate: "pintura"` e `principal_declarada: false`, porque a Seção 8 migrou
só a Biblioteca. É a forma do antigo `load_ms: 28`, agora **corretamente
rotulada** em vez de se passar por tempo até o dado. Então continua valendo, e
com exemplo medido: **não tire média desta coluna sem filtrar `medido_ate` e
olhar `principal_declarada`.**

> ⚠️ **O corte entre o gatilho antigo e este é um EVENTO, não uma data: é o
> deploy.** Enquanto a Seção 8 não chegar a staging, **nenhuma** linha de
> `product_events` escrita pelo *deployment* de staging é do protocolo novo —
> inclusive as datadas depois de o protocolo novo existir no repositório,
> porque código em branch não grava nada. Quem for consultar essa coluna
> confere primeiro **de onde a linha veio**; uma data de corte convidaria a
> confiar em linha velha por ela ser recente.
>
> **E existe agora um terceiro caso, que é justamente o mais fácil de ler
> errado.** Em 12/09/2026 o banco de staging recebeu as **primeiras** linhas do
> protocolo novo — `product_events` estava com **0 linhas** antes disso —, mas
> elas **não vieram do deployment de staging**: vieram de front e API rodando
> na máquina de desenvolvimento, com o código da Seção 8, apontados para o
> **banco** de staging. Na prática: a tabela tem dado do protocolo novo
> enquanto o ambiente de staging ainda serve a Seção 7. Quem cruzar "linha
> recente" com "deploy de staging" conclui errado nas duas direções.
