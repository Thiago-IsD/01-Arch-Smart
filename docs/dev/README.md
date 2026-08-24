# Documentação de desenvolvimento

Índice dos documentos voltados a quem desenvolve o Arq Smart. Nenhum destes documentos existe ainda além deste índice — as Tasks 5 a 8 do plano da Seção 2 os criam, na ordem abaixo.

| Documento | Para que serve | Cria |
|---|---|---|
| `ambiente.md` | subir o projeto do zero: dependências, variáveis de ambiente, banco local | Task 5 |
| `convencoes.md` | o que é obrigatório e o que é proibido no código, com o artigo da constitution que sustenta cada regra | Task 6 |
| `arquitetura.md` | como API, web e extensão se encaixam, e por onde os dados fluem | Task 6 |
| `modelo-de-dados.md` | schema do banco comentado, com o porquê de cada relação | Task 7 |
| `deploy.md` | ambientes, esteira de deploy e como reverter | Task 8 |
| `decisoes/` | ADRs — por que o projeto está do jeito que está | ver [decisoes/README.md](decisoes/README.md) |
| `modulos/` | um documento por módulo do produto | ver [modulos/README.md](modulos/README.md) |

## Quando escrever aqui

Ao mudar como algo funciona — não ao mudar o código em si. Uma refatoração que não muda comportamento observável não precisa de atualização; uma mudança de contrato, de fluxo ou de regra de negócio precisa, no mesmo commit que a introduz.
