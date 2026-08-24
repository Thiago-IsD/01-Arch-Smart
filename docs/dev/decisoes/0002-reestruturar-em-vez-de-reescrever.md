# ADR 0002 — Reestruturar em vez de reescrever

**Data:** 2026-08-24 · **Status:** aceita

## Contexto

A plataforma está lenta e cada iteração a deixa mais lenta. A suspeita
inicial era de que seria preciso reescrevê-la inteira. Uma auditoria de
código (`spec-kit-2/auditoria-codigo-2026-08-23.md`) e um spike de medição em
navegador mostraram que reescrever não resolveria as causas: elas são de
arquitetura (sem cliente HTTP único, sem índice em `account_id`, sem cache
padronizado) e de processo (sem `CLAUDE.md`, sem CI, sem convenção
documentada), não de código legado irrecuperável. **57 dos 70 endpoints da
API estão corretos hoje** — a Seção 1 já corrigiu os 13 com falha de
autorização; a maior parte do código funciona como deveria.

Tempo medido, do clique até os dados na tela, com sessão real: Projetos
3,0 s · Biblioteca 3,6 s · Financeiro 4,3 s. Cada tela nova custa mais que a
anterior porque copia o boilerplate de chamada à API da anterior (62
`createClient()`, 56 `getSession()`, 70 headers montados à mão, 37 arquivos
repetindo o mesmo padrão) — o custo de criar uma tela cresce com o tempo, não
é constante.

Haverá uma segunda pessoa desenvolvendo depois desta reestruturação, e toda a
implementação usa assistência de IA: um padrão ruim que sobrevive no código
vira exemplo, e exemplo vira o próximo arquivo copiado.

## Decisão

Reestruturar a plataforma dentro do repositório atual — construir a camada de
dados e de UI que falta, e migrar as telas para cima dela uma de cada vez
(padrão *strangler*) — em vez de reescrevê-la do zero.

## Alternativas rejeitadas

- **Aplicação nova em paralelo, com corte no fim.** Rejeitada: o corte é
  big-bang — tudo migra de uma vez, no fim, sem meio-termo para validar antes
  — e 57 dos 70 endpoints já estão corretos e seriam descartados sem motivo.
  Principalmente: um projeto novo sem a camada de base que falta (cliente
  HTTP único, filtro por conta automático, tokens de cor) reproduziria
  exatamente os defeitos de processo que trouxeram a plataforma a este
  estado — a causa raiz não é o código existente, é a ausência dessas
  camadas, e reescrever do zero não as cria sozinho.
- **Otimização cirúrgica, sem construir a camada base.** Rejeitada como
  destino final — ela é aceita como o primeiro pedaço do caminho escolhido,
  não como alternativa a ele. Resolve a lentidão medida hoje, mas não toca no
  motor do peso: em 10 telas novas, o resultado é o mesmo lugar de hoje, só
  que com 47 arquivos de boilerplate em vez de 37.

## Como saberemos se foi certo

Dois sinais observáveis, ambos já medidos na linha de base e re-medidos após
cada tela migrada (Seção 8):

- **Tempo de clique a dados na tela** — hoje Projetos 3,0 s · Biblioteca
  3,6 s · Financeiro 4,3 s. Cada tela migrada precisa medir uma melhora, não
  só "parecer mais rápida"; a Seção 5 valida isso numa única tela (Biblioteca)
  antes de escalar para as demais 32.
- **Custo de criar uma tela nova** — hoje toda tela nova copia o padrão
  manual de chamada à API do arquivo vizinho. Depois da Seção 5, uma tela
  nova usa `lib/api/client.ts` e um hook de `features/<domínio>/hooks.ts`
  sem repetir esse padrão. Se, depois da reestruturação, uma tela nova ainda
  precisar copiar o boilerplate manual de `createClient()`/`getSession()`/
  header montado à mão, a decisão não deu o retorno esperado.

Se, depois de duas ou três telas migradas, nem o tempo medido nem o custo de
criar tela nova melhorarem, isso é sinal de que a camada construída não está
atacando a causa raiz — e vale revisitar antes de migrar as telas restantes,
em vez de seguir em frente assumindo que vai melhorar mais adiante.

## Consequências

Fica mais fácil: aproveitar os 57 endpoints corretos e o modelo de dados já
validado; medir o ganho de cada mudança isoladamente, porque uma tela migra
de cada vez, nunca em lote; reverter uma tela problemática sem afetar as
demais. Fica mais difícil: o trabalho leva mais tempo de calendário que um
corte único, porque a aplicação antiga e a nova convivem durante as nove
seções — enquanto isso, código em área ainda não migrada segue o padrão
antigo (nunca migrar uma área "de passagem", regra registrada em
[`../../../CLAUDE.md`](../../../CLAUDE.md)), e uma tela migrada pela metade
não conta como pronta.
