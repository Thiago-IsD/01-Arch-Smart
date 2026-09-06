# ADR 0009 — Prefetch da Biblioteca dentro de `<Suspense>`, não bloqueante

**Data:** 2026-09-06 · **Status:** aceita

## Contexto

A spec da Seção 5 (`docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md`)
pede que "o Server Component busque antes de mandar a página" — ou seja, um
prefetch que bloqueia a resposta HTML até o dado estar pronto.

A API roda no free tier do Render, que hiberna por inatividade. Medido em
06/09/2026:

```
curl -w '%{time_total}\n' -o /dev/null -s https://arqsmart-staging.onrender.com/health
```

deu **41,9 s** na primeira chamada (cold start) e **0,46 s** e **0,79 s** nas
duas chamadas seguintes (`/health` → `{"status":"ok"}` nas três). Um prefetch
bloqueante no Server Component seguraria a resposta inteira da página por
até ~42 s sempre que a API estiver hibernada — pior do que o comportamento
de hoje, em que o shell aparece na hora e só a lista de produtos demora.

## Decisão

O prefetch acontece dentro de um `<Suspense>`, não no corpo síncrono do
Server Component da página. `LibraryData` (o componente que faz o prefetch)
é o filho suspenso; `page.tsx` renderiza o cabeçalho e o `<Suspense>` de
imediato, sem esperar por rede. Dentro de `LibraryData`, `tentarPrefetch()`
aplica um teto de `TIMEOUT_DO_PREFETCH_MS = 3_000` (3 s): se a consulta não
responder dentro do teto, o erro é engolido (com um `console.warn`) e a
página segue sem cache hidratado — o cliente busca os dados do jeito que já
busca hoje.

## Alternativas rejeitadas

- **Prefetch bloqueante, como a spec pede ao pé da letra.** Rejeitada: com a
  API fria, entrega uma aba em branco por ~42 s — uma regressão do pior caso,
  não uma melhora. A promessa do prefetch é chegar mais rápido quando a API
  está quente; bloquear troca "às vezes mais lento" por "sempre no mínimo tão
  lento quanto o cold start".
- **Sem teto no `tentarPrefetch`.** Rejeitada: sem teto, o prefetch dentro do
  `<Suspense>` ainda prenderia aquele branch da árvore até a API responder ou
  até o timeout da própria plataforma (Render/Vercel) cortar a conexão — o
  usuário ficaria olhando o skeleton por dezenas de segundos em vez de ver a
  lista chegar pelo caminho de hoje.
- **Aumentar o teto para cobrir o cold start (ex.: 45 s).** Rejeitada: isso
  reintroduz o problema que o teto existe para evitar, só que dentro do
  `<Suspense>` em vez de bloqueando a página inteira — e nenhum usuário
  espera 45 s por uma tela.

## Como saberemos se foi certo

Com a API quente, abrir `/library` e não ver nenhuma requisição a
`/api/products` partindo do browser no primeiro carregamento — o dado já
chegou hidratado no HTML. Com a API fria (ou o prefetch estourando o teto),
a tela funciona exatamente como antes desta tarefa: o skeleton aparece e o
cliente busca. Sinal de refutação: uma chave de cache que não bate entre
`LibraryData` (servidor) e `useProducts` (cliente) — nesse caso a hidratação
não casa e o prefetch vira custo puro sem nenhum erro visível, porque a
função `filtrosDaUrl` (Tarefa 6) é o único ponto que os dois lados
compartilham para montar essa chave.

## Consequências

Com a API quente, a Biblioteca deixa de ser uma casca vazia que só busca
dado depois de aparecer na tela — o HTML já chega com a lista. Com a API
fria, nada piora: o comportamento degrada exatamente para o que existia
antes desta tarefa. O custo é manter dois caminhos que constroem a mesma
consulta (`LibraryData` no servidor, `useProducts` no cliente) e a exigência
de que os dois derivem os filtros da mesma `filtrosDaUrl` — um campo
divergente entre eles faz a hidratação falhar em silêncio.

## Reverter quando

A API sair do free tier do Render (deixar de hibernar). Nesse cenário,
`TIMEOUT_DO_PREFETCH_MS` pode subir, ou o prefetch pode voltar a ser
bloqueante, como a spec original pedia — o cold start medido aqui deixa de
existir e a premissa desta ADR cai junto.
