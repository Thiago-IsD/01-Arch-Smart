# Documentação de desenvolvimento

Índice dos documentos voltados a quem desenvolve o Arq Smart.

| Documento | Para que serve |
|---|---|
| [`ambiente.md`](ambiente.md) | subir o projeto do zero: dependências, variáveis de ambiente, banco local |
| [`convencoes.md`](convencoes.md) | o que é obrigatório e o que é proibido no código, com o artigo da constitution que sustenta cada regra |
| [`arquitetura.md`](arquitetura.md) | como API, web e extensão se encaixam, e por onde os dados fluem |
| [`modelo-de-dados.md`](modelo-de-dados.md) | schema do banco comentado, com o porquê de cada relação |
| [`deploy.md`](deploy.md) | ambientes, esteira de deploy e como reverter |
| [`decisoes/`](decisoes/README.md) | ADRs — por que o projeto está do jeito que está |
| [`modulos/`](modulos/README.md) | um documento por módulo do produto (ainda vazia — ver o índice) |

## Quando escrever aqui

Ao mudar como algo funciona — não ao mudar o código em si. Uma refatoração que não muda comportamento observável não precisa de atualização; uma mudança de contrato, de fluxo ou de regra de negócio precisa, no mesmo commit que a introduz.
