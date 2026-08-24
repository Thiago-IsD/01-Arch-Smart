# ADR 0005 — Três branches: `develop`, `staging`, `main`

**Data:** 2026-08-24 · **Status:** aceita

## Contexto

Hoje não existe branch de staging: todo push/merge para `main` é o caminho
direto para produção (ver [`deploy.md`](../deploy.md)). O time é de duas
pessoas, e a Seção 3 traz beta-testers acessando um ambiente de staging
online pela primeira vez. A mesma seção provisiona esse ambiente (API
separada no Render, projeto Supabase separado, preview automático da Vercel)
e um CI que passa a barrar merge (lint, tipos, testes, isolamento entre
contas, literais proibidos, contraste, doc de módulo, consistência do
`PROGRESS.md`).

Sem um lugar onde o trabalho das duas pessoas se encontra antes de ir para
staging, todo merge de feature vai direto ao ambiente que os beta-testers
usam — testando em frente de quem está avaliando o beta, não antes.

## Decisão

Três branches protegidas, em fluxo de sentido único:

```
feature/xyz ──PR──► develop ──► staging (ambiente online) ──► main (produção)
```

PR e CI verde obrigatórios nas três. Nunca mergear para trás, exceto hotfix
direto em `main`, que volta para `develop` no mesmo dia — o CI acusa se
`main` tiver commit ausente em `develop`.

## Alternativas rejeitadas

- **Duas branches (`develop`/`main`), sem `staging` separado.** Rejeitada:
  com beta-testers avaliando o produto, é preciso um ambiente estável entre
  "código que as duas pessoas acabaram de integrar" e "produção" — sem ele,
  todo merge de feature vira teste ao vivo para quem está avaliando o beta,
  sem nenhum portão no meio.
- **`main` direto para produção, sem `develop`** (fluxo
  `feature/xyz → PR → staging → main`). Rejeitada: com duas pessoas
  trabalhando ao mesmo tempo, `develop` é onde o trabalho de ambas se
  encontra e se integra sem publicar nada — sem ele, cada feature só
  descobre conflito com a outra já dentro do ambiente de staging que os
  beta-testers usam, tarde demais para ser um problema de baixo custo.

## Como saberemos se foi certo

Nenhum commit chega a `staging` sem já ter passado por `develop`, e nenhum
commit chega a `main` sem já ter passado por `staging` — verificável a
qualquer momento com `git log staging..main` e `git log develop..staging`
vazios, fora de hotfix. Se um hotfix em `main` demorar mais de um dia para
voltar para `develop`, ou se o CI que deveria acusar essa ausência não
pegar o caso, o fluxo desenhado não está sendo seguido na prática — sinal
para revisar o processo, não só o código.

## Consequências

Fica mais fácil: beta-tester nunca vê código que as duas pessoas ainda estão
integrando entre si; um hotfix de produção tem caminho definido de volta para
o desenvolvimento contínuo, em vez de divergir dele. Fica mais difícil: toda
mudança leva um PR a mais para chegar a produção (`develop → staging → main`,
em vez de direto), e o time passa a manter três ambientes sincronizados em
schema — mitigado pelas [ADR 0003](0003-descartar-banco-atual-criar-novo.md)
e [ADR 0004](0004-alembic-fonte-unica-do-schema.md): os três ambientes nascem
exatamente do mesmo jeito, banco vazio mais `alembic upgrade head`.
