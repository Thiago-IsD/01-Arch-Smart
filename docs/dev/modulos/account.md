# Módulo: `features/account`

A camada de dados do domínio Conta — perfil do usuário e `entitlements` (os
limites e permissões do plano). Fecha a violação do Art. 3 que estava aberta
em `dashboard/page.tsx` e `projects/page.tsx`: `data?.plan_limit ?? 2`, um
limite de plano decidido no front.

## O que expõe

| Símbolo | Onde | O que faz |
|---|---|---|
| `useMe()` | `hooks.ts` | `GET /api/users/me` via TanStack Query. Perfil, conta e `entitlements`. |
| `useEntitlements()` | `hooks.ts` | `{ entitlements, isLoading }` — a fonte única de limite de plano no front. |
| `obterMe(signal?)` | `api.ts` | A chamada crua, para quem já está fora de um componente React (ex.: Server Component, via `apiServer`). |

## Do que depende

`lib/api/client.ts` (header, erro, cancelamento) e `lib/query/keys.ts`
(`queryKeys.account.me()`, `cachePolicy.conta`). Não fala com Supabase e não
monta URL — Art. 4.

## `Entitlements` é dicionário aberto, de propósito

```ts
export interface Entitlements {
    project_limit?: number
    can_use_ai?: boolean
    can_use_portal?: boolean
    [outro: string]: unknown
}
```

O backend pode acrescentar um entitlement novo sem que o front precise de
deploy casado — por isso o tipo declara só as chaves que o front usa hoje e
aceita o resto (`[outro: string]: unknown`). Não existe lista fechada para
tipar contra.

## `undefined` é "ainda não sei", não "zero"

`useEntitlements()` devolve `entitlements: undefined` enquanto a chamada está
em voo **e** quando ela falha. Quem consome trata os dois casos do mesmo
jeito: renderiza o skeleton que a tela já tem (ou nada), nunca um número
inventado.

O padrão que isto substitui era `data?.plan_limit ?? 2`: uma conta com limite
real 10 mostrava "2" por um instante a cada carregamento, e uma falha de rede
deixava o "2" fixo na tela para sempre — o front decidindo, mesmo que por um
instante, uma regra de negócio que só o servidor conhece (Art. 3).

## Cuidado com o nome de fio

`/api/projects` devolve o campo como `plan_limit`; `/api/users/me` devolve
como `entitlements.project_limit`. São o mesmo conceito com dois nomes no
contrato de hoje. `features/account` só expõe o segundo — é o que
`dashboard/page.tsx` e `projects/page.tsx` passaram a ler. Unificar o nome no
backend não é escopo deste módulo.

## Servidor vs. cliente

`projects/page.tsx` é Server Component: chama `apiServer<Me>("/api/users/me")`
diretamente (não pode usar hook), em paralelo com a busca de projetos via
`Promise.all` — a API hiberna no free tier do Render (medido: 41,9 s num cold
start), e um segundo `await` sequencial dobraria essa exposição no pior caso.
Se a chamada a `/me` falhar, o limite fica `undefined` e a tela não renderiza
o contador, em vez de assumir um valor.

`dashboard/page.tsx` é Client Component e usa `useEntitlements()` normalmente.
