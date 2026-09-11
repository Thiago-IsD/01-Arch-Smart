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
| `useTrack()` | `hooks.ts` | Devolve `track(nome, propriedades?)`, estável entre renders. Manda um evento por vez; o contrato do servidor já é lote, então o buffer entra aqui se um dia fizer falta, sem mexer no servidor. |
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
| `load_ms` | Milissegundos do início da navegação até o momento medido. |
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

## Decisões não-óbvias

**Só as 15 telas autenticadas de `app/(dashboard)/`.** As outras 19 são
anônimas: sem sessão não há `account_id`, e o Art. 1 não admite um inventado.

**O canal do `is_empty` é uma `ref`, não `state`.** Um `setState` ali
re-renderizaria a árvore inteira do dashboard a cada boundary que decide, e o
valor só é lido uma vez, na hora de emitir.

**O gatilho é escopado à navegação, não ao cache global.** Esta é a parte
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
