# [Nome do módulo]

> Copie este arquivo para `docs/dev/modulos/<modulo>.md` ao reescrever uma tela.
> Escreva para quem chega ao projeto em 2027 **sem ninguém para perguntar**.

**Última revisão:** AAAA-MM-DD · **Spec:** `spec-kit/specs/NNN-…`

---

## 1. O que este módulo faz

Duas ou três frases, do ponto de vista do usuário. Não do código.

## 2. Onde ele vive

| Camada | Caminho |
|---|---|
| Telas | `app/(dashboard)/…` |
| Componentes | `components/…` |
| Endpoints | `app/api/v1/endpoints/….py` |
| Serviços | `app/services/….py` |
| Models | `app/models/….py` |

## 3. Modelo de dados

Quais tabelas, quais relações e **por que estão assim**. O DDL está no banco; aqui vai o raciocínio.

## 4. Contratos de API

| Método | Rota | Entrada | Saída | Observação |
|---|---|---|---|---|

## 5. Regras de negócio não-óbvias

A seção mais importante. Tudo que alguém quebraria por não saber:

- Ex.: "a quantidade é sempre arredondada **para cima** — caixa de porcelanato não se compra pela metade, e faltar material na obra é pior que sobrar."
- Ex.: "o DNA é copiado, não referenciado — editar o modelo não pode alterar projeto já entregue ao cliente."

## 6. Decisões tomadas

Links para as ADRs relevantes em `docs/dev/decisoes/`. Se a decisão não tem ADR e é importante, escreva uma.

## 7. Telemetria

Quais eventos este módulo emite e o que cada um responde.

## 8. Restrições de compliance

Se aplicável: o que o parecer jurídico ou a LGPD obriga aqui, e onde está implementado. Ex.: `source_url` obrigatório na exibição; nome de cliente final mascarado no replay.

## 9. Performance

Orçamento desta tela, quantas queries o caminho principal faz, e onde estão os índices que sustentam isso.

## 10. O que quebra se você mexer aqui

Quais outros módulos dependem deste. Quais testes cobrem. O que verificar antes de mergear.

## 11. Dívidas conhecidas

O que ficou para depois, e por quê. Ser honesto aqui vale mais do que parecer organizado.
