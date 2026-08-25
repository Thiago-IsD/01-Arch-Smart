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
