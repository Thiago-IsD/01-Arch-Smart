# Estrutura de documentação — como usar

A spec 004 cria duas árvores de documentação **dentro do repositório do produto** (não aqui no spec-kit). Este arquivo explica o desenho; os templates ao lado são o que se copia.

---

## Por que dentro do repositório

Documentação que mora longe do código envelhece. Documentação que mora ao lado dele entra no mesmo PR da mudança — e a regra do Art. 13 ("PR sem doc não é *done*") só funciona se as duas coisas estiverem no mesmo lugar.

## As duas árvores

```
/docs
├── dev/          ← para quem mantém o código
│   ├── README.md            por onde começar
│   ├── ambiente.md          subir o projeto do zero em <30 min
│   ├── arquitetura.md       camadas, identidade, escopo por conta
│   ├── convencoes.md        padrões e o que é proibido, com o artigo que proíbe
│   ├── modelo-de-dados.md   schema comentado, com o porquê
│   ├── design-system.md     tokens e componentes
│   ├── dados-coletados.md   eventos e replay (insumo da política de privacidade)
│   ├── deploy.md            ambientes, esteira e como reverter
│   ├── decisoes/            ADRs — uma decisão por arquivo
│   └── modulos/             uma página por tela reescrita
│
└── user/         ← para o arquiteto
    ├── README.md
    ├── primeiros-passos/
    ├── biblioteca/
    ├── projetos/
    ├── orcamento/
    ├── financeiro/
    └── conta/
```

`/docs/user/` é renderizada em `/ajuda` dentro do produto (spec 013).

## Templates

| Arquivo | Quando usar |
|---|---|
| `template-doc-modulo.md` | ao reescrever ou criar um módulo → `docs/dev/modulos/<modulo>.md` |
| `template-artigo-ajuda.md` | ao entregar uma tarefa que o usuário faz → `docs/user/<área>/<slug>.md` |

## ADRs — registros de decisão

Formato curto, uma decisão por arquivo, numerado:

```
docs/dev/decisoes/0001-manter-vercel-render-supabase.md

# ADR 0001 — Manter Vercel + Render + Supabase no beta
Data: 2026-08-18 · Status: aceita

## Contexto
[o que estava em jogo]

## Opções
[o que foi considerado]

## Decisão
[o que foi escolhido, e o motivo em uma frase]

## Consequências
[o que isso torna fácil, o que torna difícil, quando revisitar]
```

ADRs existem para responder a pergunta que mais custa tempo num projeto herdado: **"por que diabos isso foi feito assim?"** Sem ADR, a resposta é sempre "sei lá, refaz" — e refazer uma decisão que já tinha bom motivo é a forma mais cara de perder tempo.

Três ADRs já têm decisão tomada e devem ser escritas na spec 004: manter a infra atual no beta · reescrever em vez de refatorar · Asaas como gateway.

## Como isso se mantém vivo

1. **PR sem doc não mergeia** (Art. 13, Anexo B) — a única regra que funciona de fato.
2. `Última revisão: AAAA-MM-DD` no topo de cada página de módulo.
3. Um minuto na weekly de segunda: "alguma doc ficou desatualizada esta semana?".

Documentar em mutirão trimestral nunca acontece. Documentar junto com o código custa 15 minutos por PR.

## Teste de qualidade

**Doc de dev:** o Brenno sobe o projeto do zero seguindo só o `ambiente.md`, sem perguntar nada. Se ele travar, a doc está errada — não ele.

**Doc de usuário:** a Giovanna leria o artigo para uma colega arquiteta sem se envergonhar.
