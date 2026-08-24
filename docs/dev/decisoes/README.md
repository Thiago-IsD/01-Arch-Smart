# Decisões de arquitetura (ADRs)

Um ADR (*Architecture Decision Record*) registra uma decisão não-óbvia: aquela em que havia mais de um caminho razoável e alguém escolheu um. Decisão óbvia (a única forma sensata de fazer algo) não precisa de ADR — o custo de escrever um não se paga.

## Quando escrever um

No momento em que a decisão é tomada, não depois. Se você está discutindo entre duas abordagens e escolhendo uma, essa discussão é o material do ADR — capturá-la ali é o que evita que a mesma discussão se repita daqui a seis meses, com ninguém lembrando por que a primeira alternativa foi descartada.

## Numeração

Sequencial, sem reaproveitar números: `0001`, `0002`, `0003`, ... O primeiro ADR desta pasta é `0001`. Um ADR nunca é apagado — se a decisão muda, o antigo é marcado como `substituída por ADR-NNNN` e um novo ADR é criado com a decisão atual.

## Arquivo

Um arquivo por ADR: `NNNN-titulo-curto-em-kebab-case.md`.

## Template

```markdown
# ADR NNNN — <título curto e afirmativo>

**Data:** AAAA-MM-DD · **Status:** aceita | substituída por ADR-NNNN | revogada

## Contexto
O que era verdade quando decidimos. Fatos, não opiniões.

## Decisão
O que foi decidido, em uma frase.

## Alternativas rejeitadas
Cada uma com o motivo. Esta seção é a que mais vale daqui a seis meses.

## Como saberemos se foi certo
O sinal observável que confirma ou refuta a decisão. Sem isso, não dá para aprender com ela.

## Consequências
O que passa a ser mais fácil e o que passa a ser mais difícil.
```

## O que ainda não existe

Esta pasta está vazia além deste índice. O primeiro ADR é escrito pela Task 8 do plano da Seção 2, junto com `docs/dev/deploy.md`.
