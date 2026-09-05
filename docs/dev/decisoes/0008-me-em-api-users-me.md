# ADR 0008 — `entitlements` entra em `GET /api/users/me`, sem `/api/v1`

**Data:** 2026-09-05 · **Status:** aceita

## Contexto

A spec da reestruturação (23/08/2026) pede `GET /api/v1/me` com `user`,
`account` e `entitlements`.

Medido em 05/09/2026: **não existe prefixo `/api/v1` na aplicação.** As 62
rotas de aplicação estão em `/api` e 7 em `/public`
(`grep -n "include_router" ArchSmart-api/app/main.py`). O perfil já é
servido por `GET /api/users/me`, chamado pelo front em três lugares:
`src/app/(dashboard)/billing/page.tsx:71`,
`src/app/(dashboard)/profile/page.tsx:75` e
`src/hooks/use-user-profile.ts:43`.

## Decisão

`entitlements` entra no contrato de `GET /api/users/me`. Não se cria
`/api/v1`. `PUT /api/users/profile` devolve o mesmo `UserProfileResponse` e
também carrega `entitlements`.

## Alternativas rejeitadas

- **Criar `GET /api/v1/me` isolado, ao lado das 62 rotas em `/api`.**
  Rejeitada: é versionamento que só uma rota segue — paga o custo de manter
  dois contratos vivos (`/api/users/me` e `/api/v1/me`) sem entregar a
  coerência que justificaria versionar em primeiro lugar.
- **Versionar as 62 rotas de uma vez, para `/api/v1`.** Rejeitada aqui:
  quebraria todo `fetch` do front fora de uma tarefa dedicada a isso, e essa
  tarefa é da Seção 5 ou 8 — não desta caixa, que é sobre `entitlements`, não
  sobre prefixo de rota.
- **Preencher `entitlements` só em `GET /me`.** Rejeitada: `PUT /profile`
  devolve o mesmo `UserProfileResponse`, e o front usa a resposta dele para
  atualizar o estado local (`profile/page.tsx:132`). Preencher só um dos
  dois faz os entitlements sumirem assim que o usuário salva o perfil.

## Como saberemos se foi certo

A Seção 5 consegue consumir `GET /api/users/me` (e o `PUT /profile`
correspondente) sem precisar de um segundo contrato para `entitlements`, e
`tests/api/test_me.py` continua verde contra o schema atual. Sinal de
refutação: a Seção 5 precisar de um campo que só existe em `/api/v1/me`, ou
um front que leia `entitlements` de `GET /me` e não de `PUT /profile`.

## Consequências

A Seção 5 consome `GET /api/users/me`, não `/api/v1/me` — o `lib/api/client.ts`
que ela cria aponta para lá. Se um dia houver necessidade real de versionar,
a decisão a tomar é sobre as 62 rotas, de uma vez, com o front migrando
junto; esta ADR não fecha essa porta, ela recusa abrir a porta para uma rota
só. A spec continua dizendo `/api/v1/me` — ela é o registro do que se pensou
em 23/08; este arquivo é o registro do que foi feito.
