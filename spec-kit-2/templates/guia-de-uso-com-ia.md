# Guia de uso com IA (Antigravity / Claude Code / Cursor)

O `roadmap.html` antigo tinha "prompts prontos" por item. O problema daquele formato é que cada prompt nascia sem contexto: a IA não sabia as convenções, não sabia que existia vazamento de multi-tenancy, não sabia que limite de plano não pode ir no front. Resultado: código que funciona na demo e viola a arquitetura.

Este kit resolve isso pondo o contexto em arquivos versionados. O prompt fica curto porque o contexto está no repositório.

---

## Passo 1 — Carregar o contexto

No início de qualquer sessão:

```
Leia, nesta ordem:
1. spec-kit/memory/constitution.md
2. spec-kit/memory/playbook-reescrita.md      (se for tela da Onda 2)
3. spec-kit/product/01-visao-de-produto.md
4. spec-kit/specs/<pasta>/spec.md
5. spec-kit/specs/<pasta>/tasks.md

Confirme em até 10 linhas o que entendeu do escopo e liste o que está
marcado como [DECISÃO PENDENTE]. Não escreva código ainda.
```

Fazer a IA repetir o escopo antes de codar pega a maior parte dos mal-entendidos por um custo baixíssimo.

## Passo 2 — Uma tarefa por vez

```
Execute a tarefa T-NNN.x de spec-kit/specs/<pasta>/tasks.md.

Regras:
- Convenções do Art. 5. Toda query via ScopedRepository (Art. 1).
- Nenhuma cor, URL, ID de conta ou limite de plano literal (Art. 3, 4, 7).
- Componentes do design system; FormField para todo campo.
- Os 5 estados, não só o caminho feliz.
- Eventos de telemetria conforme a seção 8 da spec.
- Se precisar de decisão que não está na spec, pare e pergunte.

Ao final, mostre o diff e diga qual critério de aceite foi atendido.
```

**Uma tarefa por vez.** Pedir "faça a spec 008 inteira" produz um PR de 40 arquivos que ninguém revisa de verdade — e revisão superficial é como o `accountId` fixo entrou no código antigo.

## Passo 3 — Revisar de forma adversarial

```
Revise o diff acima contra spec-kit/memory/constitution.md, artigo por artigo.
Para cada violação, aponte arquivo, linha e correção.
Seja adversarial: assuma que existe pelo menos uma violação.
```

## Passo 4 — Fechar o loop

```
Atualize spec-kit/specs/<pasta>/tasks.md marcando [x] no que foi concluído.
Se descobriu trabalho novo, adicione como tarefa ao final — não altere as existentes.
Atualize docs/dev/modulos/<modulo>.md com o que mudou.
```

---

## Prompt para criar uma spec nova

```
Crie spec-kit/specs/0NN-<slug>/spec.md a partir de
spec-kit/templates/spec-template.md para: <problema>.

Contexto obrigatório: constitution.md e 01-visao-de-produto.md.
Preencha todas as seções. Onde faltar informação de negócio, escreva
[DECISÃO PENDENTE] com a pergunta exata e quem deveria responder —
não invente resposta.
```

A última frase é a que mais importa. Spec com premissa inventada é pior que spec incompleta, porque a premissa some dentro do texto e vira código.

---

## Anti-padrões observados neste projeto

| Anti-padrão | Consequência real | Regra |
|---|---|---|
| Pedir a feature sem passar o schema | tabela fora do padrão `snake_case` plural | citar a seção 5 da spec |
| Aceitar cor literal "só pra testar" | 3 arquivos com `#008080` fixo, rebranding travado | Art. 7 + varredura no CI |
| IA "resolvendo" o `account_id` com um valor de exemplo | foi exatamente assim que nasceu o `UX-07` | Art. 1 no prompt, sempre |
| Prompt gigante com 5 tarefas | PR irrevisável, bug entra junto | uma tarefa por vez |
| Aceitar tela sem estado vazio e sem erro | 60% do trabalho de acabamento fica para depois — e nunca acontece | Anexo A da constitution |
| Adicionar funcionalidade nova durante a reescrita | a reescrita não termina | regra 3 do roadmap |
