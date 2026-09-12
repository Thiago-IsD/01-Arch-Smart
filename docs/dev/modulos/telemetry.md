# Módulo: `features/telemetry`

O lado do cliente da telemetria de produto: manda evento para a API e emite
`screen_viewed` sozinho, uma vez por navegação, em toda tela autenticada.

O objetivo é responder "quais telas as pessoas abrem, e quanto tempo esperam
até ver dados" sem que nenhuma tela precise saber que telemetria existe. Quem
escreve tela nova não instrumenta nada: monta dentro de `(dashboard)/` e o
evento sai.

## O que expõe

| Símbolo | Onde | O que faz |
|---|---|---|
| `useTrack()` | `hooks.ts` | Devolve `track(nome, propriedades?)`, estável entre renders. **Não manda nada: enfileira.** Quem junta o lote e decide o momento de enviar é `fila.ts`. |
| `enfileirar(evento)` / `descarregar(opcoes?)` | `fila.ts` | A fila. Junta a janela de 1 s num lote só, descarrega sozinha ao chegar a 20 eventos (o servidor aceita 50), e descarrega com `keepalive` no `pagehide` e na aba escondida. |
| `<TelemetriaDeTela />` | `TelemetriaDeTela.tsx` | Emite `screen_viewed` uma vez por navegação. Não renderiza nada. |
| `VazioDaTelaProvider` | `contexto.tsx` | O canal por onde o `QueryBoundary` conta que a tela está vazia. |
| `useReportarVazio()` | `contexto.tsx` | O `QueryBoundary` chama. **No-op fora do provider** — a galeria `/dev/componentes` usa o boundary e não fica dentro de `(dashboard)`. |
| `useVazioDaTela()` | `contexto.tsx` | Leitura do canal, usada só pela `TelemetriaDeTela`. |
| `normalizarTela(caminho)` | `types.ts` | `/projects/<uuid>` → `/projects/[id]`. |
| `decidirMedicao({ queriesAssentaram })` | `types.ts` | `"dados"` ou `"pintura"`. |
| `enviarEventos(eventos)` | `api.ts` (reexporta `lib/api/telemetry.ts`) | Manda o lote. **Nunca rejeita.** |

## Contrato com a API

`POST /api/telemetry/events`, corpo `{"eventos": [{"name", "properties"}]}`,
resposta **204 sem corpo**. Máximo de 50 eventos por lote, `name` de até 100
caracteres.

**Não existe campo de conta nem de usuário no corpo** — a identidade vem do
`RequestContext`, montado no servidor a partir do token (Art. 1). Um
`account_id` mandado daqui seria, na melhor hipótese, ignorado.

A chamada sai por `api()` de `lib/api/client.ts`, como toda chamada de rede
deste front (Art. 4). O 204 já é tratado lá dentro (`lib/api/core.ts`), então
`api<void>()` não tenta parsear corpo vazio.

## Tabelas que toca

Nenhuma diretamente. Do outro lado do endpoint, `product_events` — ver
[`telemetry_service.md`](telemetry_service.md).

## O evento `screen_viewed`

| Propriedade | O que é |
|---|---|
| `screen` | O caminho normalizado (`/projects/[id]`). |
| `load_ms` | Milissegundos desde que o efeito de `TelemetriaDeTela` monta — depois do commit da rota, incluindo o fallback de um `<Suspense>` — até o momento medido. **Não** é desde o clique nem desde que os dados chegam; ver o aviso abaixo da tabela. |
| `medido_ate` | `"dados"` ou `"pintura"` — qual dos dois o `load_ms` é. |
| `is_empty` | `true`, `false` ou **`null`**. |

**`medido_ate` existe porque as duas medidas moram na mesma coluna.** `dados` é
o tempo até os dados aparecerem, que é a métrica do orçamento de performance;
`pintura` é o tempo até a tela pintar, que é outra coisa. Sem este campo, quem
consultar depois soma laranja com maçã.

**`is_empty` é `null` quando não se sabe**, nunca `false`. "Não sei" e "não está
vazia" são coisas diferentes, e gravar `false` inventaria uma medição. Fica
`null` quando nenhum `QueryBoundary` da tela chegou a decidir — tela sem
boundary, ou boundary que ainda estava em `skeleton`/`error`.

> **Hoje `is_empty` sai `null` em 100% dos eventos reais, e isso é ordem das
> seções, não defeito.** Nenhuma tela de `(dashboard)` usa `QueryBoundary`
> ainda — quem liga é a Seção 8, migrando as telas. O canal está montado e
> testado, mas nenhuma tela real o alimenta. Quem abrir `product_events` antes
> disso vai ver só `null` na coluna; não é o canal quebrado.

> **Hoje `load_ms` não é dado utilizável, e o motivo é estrutural, não um
> bug pequeno.** O relógio decide no primeiro `requestAnimationFrame` depois
> de o efeito montar: se nada está em voo naquele frame, emite
> `medido_ate: "pintura"` e encerra. Isso roda **antes** de existir dado
> algum em qualquer tela servida por streaming — `app/(dashboard)/library/page.tsx`
> põe `<LibraryData>` dentro de `<Suspense>`, e a query da tela só monta
> quando o stream chega, depois desse primeiro frame. Medido por
> experimento numa tela cujo dado levou ~100 ms:
> `{"screen":"/library","load_ms":28,"medido_ate":"pintura","is_empty":null}`.
>
> Há uma segunda camada, específica da Biblioteca: a lista **nunca** dispara
> requisição do navegador — `LibraryData` faz `prefetchQuery` no servidor e
> entrega por `HydrationBoundary` (Seção 5). Então mesmo quando o caminho
> chega a emitir `medido_ate: "dados"`, o que está sendo cronometrado é o
> `useInboxCount` — a query do badge, que a Seção 5 deixou fora do prefetch
> —, **não a lista**. Quem abrir `product_events` para tirar média de
> `load_ms` antes de a Seção 8 mudar este gatilho vai somar zeros de
> `"pintura"` prematura e tempos de badge como se fossem tempo de tela.

## Decisões não-óbvias

**Só as 15 telas autenticadas de `app/(dashboard)/`.** As outras 19 são
anônimas: sem sessão não há `account_id`, e o Art. 1 não admite um inventado.

**O canal do `is_empty` é uma `ref`, não `state`.** Um `setState` ali
re-renderizaria a árvore inteira do dashboard a cada boundary que decide, e o
valor só é lido uma vez, na hora de emitir.

**O gatilho ainda pergunta ao cache global, não à navegação.** Esta é a parte
delicada do módulo, e vale explicar o que ela evita. A pergunta certa é "esta
tela chegou a buscar alguma coisa?"; perguntar ao cache se ele tem alguma
entrada (`getQueryCache().getAll().length > 0`) responde outra, porque da
segunda navegação em diante o cache **nunca** está vazio — as queries da tela
anterior ficam lá até o `gcTime`. Com a pergunta errada, uma tela sem query
nenhuma nunca pegava o caminho da pintura: ficava esperando um evento de cache
que só chega na coleta de lixo, e o resultado era nenhum evento, ou um
`load_ms` de minutos rotulado `dados`. Revisitar tela com cache quente, que não
dispara busca alguma, também não emitia nada. O componente guarda então uma
bandeira própria da navegação, ligada quando alguma query está em voo.

**Um frame de folga antes de ler `is_empty`.** O cache assenta **antes** de o
React re-renderizar, e o `QueryBoundary` só decide "vazio" no render. Sem o
`requestAnimationFrame`, `ler()` voltaria `null` em toda tela.

**A guarda de dedupe mora dentro do `emitir`, não na entrada do efeito.** Sob
StrictMode — que é o default do Next 16 e portanto o modo do `npm run dev` —
o efeito monta, limpa e monta de novo. Com a guarda na entrada, o run 1
gravava a ref, assinava o cache e agendava o frame; o cleanup cancelava os
dois; o run 2 batia na ref e voltava sem assinar nada. Resultado: **zero
evento**, não dois. `telemetry.test.tsx` tem teste montando em `StrictMode` e
exigindo exatamente uma linha, que falha nas duas direções.

**`enviarEventos` engole qualquer erro, de propósito.** Telemetria que derruba
a tela do usuário é pior que telemetria nenhuma, e o modo de falha de uma
promise rejeitada aqui é um *unhandled rejection* que ninguém vê até virar erro
no console de um cliente.

> **Um dos erros que isso engole é `429`, e o balde é da plataforma inteira,
> não por usuário.** `POST /api/telemetry/events` tem
> `@limiter.limit("60/minute")`, mas o uvicorn roda sem
> `--forwarded-allow-ips` (`ArchSmart-api/Dockerfile`), e
> `app/core/rate_limit.py` documenta que por isso `get_remote_address`
> resolve para o IP do proxy em toda requisição — as 60 requisições por
> minuto somam **todos os usuários da plataforma**, não 60 por pessoa. Como
> `screen_viewed` sai a cada navegação, um punhado de usuários navegando ao
> mesmo tempo já encostava no teto, e a perda pelo `429` é silenciosa —
> indistinguível de "ninguém navegou".
>
> **A Seção 8 fechou o lado do cliente disso:** `fila.ts` junta a janela de
> 1 s num lote só, então uma navegação que emitia três eventos gasta uma
> requisição, não três. O balde continua sendo da plataforma enquanto o
> uvicorn rodar sem `--forwarded-allow-ips`, e o `429` continua silencioso.

**O lote que sai na saída da página vai com `keepalive`.** Um `fetch` comum
disparado dentro de `pagehide` é tipicamente abortado no unload do documento, e
é exatamente ali que sai a última navegação da sessão — a que diz onde o
usuário parou. Duas armadilhas que isso tem, e que estão cobertas por teste:

- **Ordem de ouvinte.** A fila registra o ouvinte de `pagehide` no carregamento
  do módulo; a `TelemetriaDeTela` registra o dela num efeito de React, depois.
  Logo a fila descarrega **antes** de a telemetria enfileirar a linha da saída.
  Por isso existe a guarda de `saindo` em `enfileirar`: depois do `pagehide`
  cada evento sai na hora, com `keepalive`, e um `pageshow` (volta do cache de
  navegação) devolve o comportamento de lote.
- **jsdom não destrói documento.** `dispatchEvent(new Event("pagehide"))` não
  aborta `fetch` nenhum, então nenhum teste de comportamento consegue ver a
  falha que o `keepalive` evita. O que `src/__tests__/telemetry-fila-keepalive.test.ts`
  prova é que a opção percorre a cadeia inteira — fila → `enviarEventos` →
  `api` → `core` — e aparece no objeto de init que o `fetch` recebeu.

## O que quebra se você mexer aqui

**A ordem dos providers em `app/(dashboard)/layout.tsx` importa duas vezes.**
`TelemetriaDeTela` tem que ficar dentro do `QueryProvider` (senão
`useQueryClient` estoura) **e** dentro do `VazioDaTelaProvider` (senão
`useVazioDaTela` volta `null` e o `is_empty` é sempre nulo). E o
`VazioDaTelaProvider` precisa embrulhar o `AppShell` também — os
`QueryBoundary` das telas ficam dentro dele, e fora do provider ninguém reporta
nada.

**`useReportarVazio` precisa continuar sendo no-op fora do provider.** O
`QueryBoundary` é compartilhado, e a galeria `/dev/componentes` o usa de fora
de `(dashboard)`. Trocar o no-op por um `throw` derruba a galeria.

**O no-op é uma referência de módulo, não um `() => {}` no `return`.** Uma
função nova a cada render faria o efeito do `QueryBoundary` que depende dela
rodar a cada render.

**O canal do `is_empty` guarda UM valor, e todo boundary escreve nele.** A ref
é um `boolean | null` só. Tela com mais de um `QueryBoundary` — uma lista e um
painel lateral, por exemplo — grava "o último efeito que rodou", que é detalhe
de ordem da árvore, não informação sobre a tela. Não acontece hoje (nenhuma
tela real usa o boundary), mas **vai** acontecer na Seção 8, e a saída não é
óbvia: `is_empty` de uma tela com duas listas precisa primeiro de uma
definição de produto ("vazia" é nenhuma das duas ter dado? a principal?).

**A bandeira do gatilho é do cliente inteiro, não desta navegação.**
`buscandoAlgo()` varre o cache todo, então uma query **alheia** ainda em voo no
momento da navegação faz uma tela sem query nenhuma emitir `medido_ate:
"dados"` cronometrando a query da outra tela — medido: ~430 ms para uma query
alheia de 400 ms. O React Query não cancela fetch no unmount, então sair de uma
tela lenta antes de ela terminar produz isso na seguinte. Escopar por
observadores montados na navegação é mudança de desenho, adiada para a Seção 8.

**Mexer no gatilho sem medir vale pouco.** O que diz se o `load_ms` corresponde
ao que o usuário esperou é uma navegação real gravando uma linha — os testes
prendem o comportamento do gatilho, não a grandeza do número.
