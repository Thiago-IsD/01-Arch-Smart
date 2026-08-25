# Documentação

## Como está organizada

| Pasta | Para quem | Quando escrever |
|---|---|---|
| `dev/` | quem desenvolve | ao mudar como algo funciona |
| `dev/decisoes/` | quem vai questionar uma escolha | ao decidir algo não-óbvio |
| `dev/modulos/` | quem vai mexer num módulo | ao criar ou reescrever um módulo |
| `user/` | o arquiteto que usa o produto | ao entregar algo que ele faz sozinho |
| `superpowers/` | quem executa a reestruturação | specs e planos de implementação |

## As três regras

1. **Documento afirma só o que é verdade hoje.** Se algo é alvo e não realidade, diga qual seção o entrega. Um agente de IA lê isso como instrução e improvisa quando não encontra o que foi descrito.
2. **ADR para toda decisão não-óbvia.** Registre o que se decidiu, o que se rejeitou e **como saberemos se foi certo**. É o que impede a mesma discussão daqui a seis meses.
3. **Doc de módulo é entrega, não sobra.** Módulo novo sem doc correspondente não está pronto (Art. 13).

## `tools/` da raiz

Scripts que checam o próprio repositório, não o banco da aplicação — o outro
`tools/` (`ArchSmart-api/tools/`) é diferente e tem seu próprio README.

| Script | Para quê |
|---|---|
| `progresso.py` | calcula o contador de cada seção do `PROGRESS.md` a partir das caixas marcadas (`--check` falha se o número escrito estiver desatualizado) |
| `checa_links.py` | verifica se os links relativos entre arquivos Markdown do repositório resolvem para um arquivo existente |

## O que ainda não existe

`dev/modulos/` está vazia: cada tela reescrita na Seção 8 entrega a sua. `user/` tem só o índice — os artigos vêm quando houver funcionalidade estável para descrever, e passam pela Giovanna antes de publicar.
