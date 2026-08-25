# ADR 0006 — Portões de CI graduais, com catraca de baseline

**Data:** 2026-08-24 · **Status:** aceita

## Contexto

A spec manda o CI barrar 8 verificações em todo PR: lint, tipos, testes
contra Postgres em Docker, teste de isolamento entre contas, varredura de
literais proibidos, validador de contraste, verificação de doc de módulo e
consistência do `PROGRESS.md`
(`docs/superpowers/specs/2026-08-23-reestruturacao-arq-smart-design.md`,
Seção 3, linha 196).

Três dessas verificações nascem vermelhas hoje. Medido em 24/08/2026:

```
$ cd ArchSmart-web && npx eslint . --format json > eslint.json && cd ..
$ python tools/catraca.py --eslint-json ArchSmart-web/eslint.json
[v] cores_literais: 521, igual ao baseline
[v] eslint_erros: 93, igual ao baseline
[v] modulos_sem_doc: 4, igual ao baseline
```

`eslint_erros` é 93 erros de lint em `ArchSmart-web`; `cores_literais` é 521
classes de cor literal (paleta ou arbitrária) sob `ArchSmart-web/src`;
`modulos_sem_doc` é 4 arquivos de `ArchSmart-api/app/services/` sem `.md`
correspondente em `docs/dev/modulos/` (`ai_service`, `auth_service`,
`budget_calculator`, `financial_service`).

Duas outras verificações checam algo que ainda não existe no repositório: o
validador de contraste depende dos tokens `--success`/`--warning` que só a
Seção 6 cria, e o teste de isolamento entre contas depende do
`ScopedRepository`/`RequestContext` que só a Seção 4 cria. Não há como ligar
essas duas verificações hoje — não existe ainda o que elas verificariam.

## Decisão

O CI que a Seção 3 cria (`.github/workflows/ci.yml`) bloqueia desde já as
verificações que já passam: tipos, testes de backend, testes de frontend,
receita de migrações, `progresso.py --check`, `checa_links.py` e a
sincronia `main`↔`develop` (ADR 0005). Lint, cores literais e doc de módulo
entram como **catraca**: um número medido, versionado em `tools/catraca.json`,
que o job de CI só deixa piorar em uma direção — para baixo. `tools/catraca.py`
mede as três coisas e compara com o baseline; se qualquer uma piorou, o job
falha e imprime o que piorou e o critério usado para medir. Contraste e
isolamento entre contas ficam como bloco comentado no `ci.yml`, nomeando a
seção que os liga (6 e 4, respectivamente).

O comando que sobe o baseline (`--atualizar`) não é uma regravação simples:
ele mede de novo, compara com o baseline atual e só grava se nada piorou.
Se alguma medida piorou (número subiu, ou um módulo novo ficou sem doc),
`--atualizar` sozinho **recusa gravar** — imprime o que pioraria e sai com
código 1. Para subir o baseline de propósito (por exemplo, um refactor que
introduz cor literal nova de caminho, aceito conscientemente) é preciso
`--atualizar --aceitar-piora`, que grava mesmo assim, mas com um aviso
destacado listando cada medida que piorou. Essa exigência não estava no
desenho original da Tarefa 3 — foi acrescentada na revisão, porque um
comando de atualização que regravasse em silêncio abriria exatamente a
brecha que esta decisão existe para fechar: alguém rodaria `--atualizar`
depois de um PR que piorou o lint, o baseline subiria sem nenhum sinal na
saída do comando, e a regressão viraria o novo normal sem que ninguém a
tivesse aprovado. Um portão com essa saída de emergência silenciosa não é
diferente de não ter portão.

## Alternativas rejeitadas

- **Ligar os 8 portões de uma vez.** Obrigaria a Seção 3 a eliminar as 521
  classes de cor literal antes de os tokens `--success`/`--warning`
  existirem — viola a ordem "completar antes de proibir" que o resto da
  reestruturação segue (tokens primeiro, lint depois, ver spec).
- **Verificar só os arquivos que o PR alterou**, em vez de medir o
  repositório inteiro. Mais simples de implementar, mas esconde o total: um
  PR que só toca dois arquivos nunca saberia que o projeto tem 521 classes
  de cor literal, e um arquivo movido (sem mudança de conteúdo) reapareceria
  como "novo" para o diff e travaria o PR sem que nada tivesse piorado de
  fato.
- **`--atualizar` como regravação simples, sem comparar com o baseline
  antes de gravar.** Era o desenho original da Tarefa 3. Rejeitada na
  revisão pelo motivo descrito na seção Decisão: grava regressão em
  silêncio, o mesmo problema que a catraca existe para impedir.

## Como saberemos se foi certo

`eslint_erros`, `cores_literais` e `modulos_sem_doc` devem estar mais baixos
no fim da Seção 6 do que hoje (93, 521 e 4), e o `ci.yml` não pode ganhar
nenhum `continue-on-error` nem um `--aceitar-piora` não justificado em PR.
Se alguém precisar desligar um portão para conseguir mergear, a decisão
falhou. E se algum dia `tools/catraca.py --atualizar` gravar um número mais
alto sem que a saída do comando tenha mostrado um aviso — ou sem que um PR
tenha justificado por que aceitou a piora — a proteção que este ADR descreve
também falhou, mesmo que o CI continue verde.

## Consequências

Fica mais fácil: a Seção 3 liga um portão real sem primeiro resolver dois
problemas que pertencem a seções futuras — o CI nasce verde em vez de nascer
desligado ou nascer vermelho e ser silenciado na primeira semana. Fica mais
difícil: por algum tempo o repositório convive com três números vermelhos
visíveis a cada PR, e quem quiser subir o baseline de propósito precisa de
um passo a mais (`--aceitar-piora`) e de justificar a piora no PR, em vez de
regravar o arquivo direto.
