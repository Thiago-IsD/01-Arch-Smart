# Documentação de módulos

Um módulo é uma área funcional do produto (por exemplo: projetos, ambientes, biblioteca de produtos, orçamento). Cada módulo tem um documento próprio nesta pasta, escrito ou reescrito no mesmo momento em que o módulo é criado ou reescrito — não depois, como tarefa separada. Módulo novo sem o doc correspondente não está pronto (Art. 13 da constitution).

## O que o documento de um módulo precisa responder

- **O que a tela faz e para quem.** Em termos do que o arquiteto está tentando fazer, não em termos de componentes.
- **Endpoints e contratos.** O que o módulo expõe e o formato de request/response.
- **Tabelas que toca.** Quais tabelas do banco o módulo lê e escreve.
- **Decisões não-óbvias.** Uma escolha que não era a única razoável entra aqui com um link para o ADR correspondente, se houver um; não duplique o raciocínio do ADR.
- **O que quebra se você mexer aqui.** Os efeitos colaterais que não são óbvios olhando só para o código do módulo.

## O que ainda não existe

Esta pasta está vazia além deste índice. Cada tela reescrita ao longo da Seção 8 desta reestruturação entrega o documento do seu módulo junto com o código — nenhum módulo é considerado concluído sem ele.

## A verificação mecânica do CI

O CI que a Seção 3 cria não sabe o que é um módulo no sentido de área
funcional de produto — ele verifica uma coisa mais simples e mecânica:
**todo arquivo em `ArchSmart-api/app/services/` e todo diretório em
`ArchSmart-web/src/features/` precisa de um `.md` de mesmo nome nesta
pasta.** É uma aproximação por nome de arquivo, não o mesmo conceito que o
resto deste documento descreve — um módulo de produto (projetos, orçamento)
pode não corresponder 1:1 a um único arquivo de service ou diretório de
feature, e a verificação do CI não tenta saber disso. Ela só garante que
nenhum arquivo novo em `services/` nem diretório novo em `features/` fica
sem documentação correspondente, mesmo que essa documentação ainda não
descreva o módulo de produto inteiro no sentido da seção acima.

Essa verificação roda como **catraca** (`tools/catraca.py`, ver
[ADR 0006](../decisoes/0006-portoes-de-ci-com-catraca.md)): os 4 services de
hoje sem doc — `ai_service`, `auth_service`, `budget_calculator`,
`financial_service` — estão no baseline versionado em `tools/catraca.json`,
porque documentá-los pertence à Seção 8, não à Seção 3. `ArchSmart-web/src/features/`
ainda não existe — nasce na Seção 5. Um módulo **novo** sem doc, a partir de
agora, reprova o PR: a catraca só deixa esse número baixar.
