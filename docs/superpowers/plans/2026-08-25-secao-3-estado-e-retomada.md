# Seção 3 — estado e retomada

Sessão de 24–25/08/2026, interrompida por limite de tempo. Este arquivo diz o que
está pronto, o que não está, e por onde continuar. O plano completo é
[`2026-08-24-secao-3-esteira-e-ambientes.md`](2026-08-24-secao-3-esteira-e-ambientes.md);
o registro tarefa a tarefa, com todas as decisões, está em
`.superpowers/sdd/2026-08-24-secao-3-esteira-e-ambientes/progress.md` (não versionado).

**Branch:** `secao-3-esteira-e-ambientes`, publicada. **PR #3**, em rascunho, contra `develop`.
**Nada foi mergeado.**

---

## O primeiro comando da próxima sessão

Re-revisar o commit `265ab39`, que entrou **sem revisão** porque a sessão acabou no
meio da rodada de correção:

```bash
git log -1 265ab39 --stat
```

Ele corrige um defeito grave, e a correção foi verificada só em parte (ver
"Tarefa 9", abaixo).

---

## Onde cada tarefa parou

| # | Tarefa | Estado |
|---|---|---|
| 1 | Destravar a suíte do frontend | ✅ completa, revisada |
| 2 | Receita de migrações cria o banco do zero | ✅ completa, revisada |
| 2b | Ponto cego de enum no teste da receita | ✅ completa, revisada |
| 3 | `tools/catraca.py` | ✅ completa, revisada |
| 4 | ADR 0006 | ✅ completa, revisada |
| 5 | `.github/workflows/ci.yml` | ✅ completa, revisada, **verde no runner** |
| 6 | Branch `staging` | ✅ criada e publicada |
| 7 | Roteiro dos painéis externos | ✅ completa, revisada |
| 8 | Supabase local em Docker | ⛔ **bloqueada** — CLI ausente |
| 9 | `seed.py` com volume realista | ⚠️ **correção interrompida, sem revisão** |
| 10 | Fechamento (docs, `PROGRESS.md`, merge) | ⬜ **não iniciada** |

---

## Tarefa 9 — o que falta, em detalhe

A revisão do seed encontrou um **Critical** e dois **Important**. Os três foram
endereçados no commit `265ab39`, mas a rodada foi interrompida antes da
re-revisão escopada.

**O Critical, para quem chegar sem contexto.** A guarda de produção lia
`os.environ["DATABASE_URL"]`, enquanto o engine lia `settings.DATABASE_URL` —
que cai no `.env` quando a variável não está exportada. O `.env` da máquina de
desenvolvimento aponta para o pooler do Supabase **de produção**. Ou seja,
`python tools/seed.py` sem env exportada — a forma que o próprio README
documenta — passava pela guarda e escreveria em produção.

**O que eu verifiquei pessoalmente**, sem executar o seed (chamando
`resolver_url_e_origem()` e `recusar_producao()` isoladamente): sem variável
exportada, a guarda enxerga a URL do `.env` e recusa com saída 1, informando a
origem. O Critical está fechado.

**O que ficou sem verificar:**

1. O seed rodando duas vezes contra um banco descartável, com os números iguais
   (300 produtos, 5 projetos, 25 ambientes, 500 itens, 959 opções).
2. O cenário do segundo Important: inserir à mão uma `presentation` apontando
   para um projeto do seed e rodar o seed de novo — antes ele estourava
   `ForeignKeyViolation`, agora deve completar.
3. A re-revisão escopada do diff inteiro.

**Achado novo, meu, não revisado:** a mensagem de recusa da guarda imprime a URL
inteira, **com senha**. Num terminal local é inofensivo (quem roda já tem o
`.env`), mas é um hábito ruim de gravar em log.

---

## Tarefa 8 — por que está bloqueada

A CLI do Supabase não está instalada e o `winget` não distribui o pacote. O
plano manda parar nesse caso, em vez de escrever à mão um `config.toml` que não
corresponde a versão nenhuma da CLI.

Duas formas de destravar:

```bash
# scoop (não instalado nesta máquina; instale o scoop antes)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# ou, sem instalar nada global — o npx já existe aqui
npx supabase --version
```

A segunda funciona para `supabase init` e `supabase start`, mas prende o projeto
ao `npx`. Vale decidir com calma, não no meio da seção.

---

## Tarefa 10 — o que ela precisa fazer

Além do que o plano já descreve, três coisas descobertas durante a execução:

1. **`CLAUDE.md` ainda diz 26 migrações.** São **27** desde a Tarefa 2
   (`ls ArchSmart-api/alembic/versions/*.py | wc -l`).
2. **`CLAUDE.md` e `docs/dev/arquitetura.md` ainda descrevem a confirmação do
   "Confirm email" como pendente.** Ela foi confirmada por Thiago no painel do
   Supabase em 24/08/2026 — a opção está **ligada**. O achado de segurança em
   `app/api/users.py` continua aberto para a Seção 4, mas deixa de ser
   explorável por quem apenas conhece o e-mail da vítima.
   `docs/dev/ambientes-online.md` já registra o fato e explica que os outros dois
   arquivos ainda não foram ajustados.
3. **No `PROGRESS.md`, marque só o que está feito.** As tarefas 2, 3 e 4 da
   Seção 3 dependem de passos de painel que só Thiago executa, e a tarefa da
   stack local está bloqueada. Marcar por causa do roteiro seria a mesma
   falsidade que a auditoria da Seção 2 pegou.

---

## O que ficou pendente de Thiago, nos painéis

Roteiro completo, campo a campo, em
[`../dev/ambientes-online.md`](../dev/ambientes-online.md): serviço de staging no
Render, preview da Vercel, projeto Supabase de staging, banco de produção novo e
branch protection nas três branches.

Para o branch protection, os checks obrigatórios são exatamente estes três nomes:

```
Backend — testes contra Postgres real
Frontend — tipos, testes e catraca
Repositorio — progresso, links e sincronia
```

---

## Achados menores, registrados e não corrigidos

- O script `lint` do `package.json` do frontend é `"eslint"`, sem o `.`, enquanto
  a medição do CI usa `npx eslint .`. Não conflita hoje, mas os dois deviam
  concordar.
- `uuid4()` não é semeado, então os ids do seed mudam entre execuções — o
  conteúdo é determinístico, a identidade não. Script de medição não pode fixar
  id de projeto.
- O preço dos produtos do seed é `uniform(80, 8000)` igual para toda categoria;
  9 dos 25 ambientes repetem nome dentro do mesmo projeto; 298 dos 300 produtos
  não têm `image_url`. A cardinalidade está certa, o realismo tem arestas.
- Os 3 usuários do seed têm `supabase_id` nulo e domínio inexistente: ninguém
  consegue logar nessa conta para medir tela. Pendência para quem montar o staging.
- `actions/checkout@v4` e `actions/setup-python@v5` ainda declaram Node 20 e o
  runner os força para Node 24. Não quebra nada hoje.
- `tools/test_checa_links.py::test_nao_acusa_link_existente` falha quando roda com
  o diretório corrente na raiz do repositório; passa a partir de `tools/`, que é
  como o CI o executa. Pré-existente.

---

## Como confirmar que o estado acima é verdade

```bash
cd ArchSmart-api && docker compose -f docker-compose.test.yml up -d --wait && pytest -q   # 32 passed
cd ArchSmart-web && npm run typecheck && npm test                                          # 4 arquivos, 7 testes
python tools/catraca.py && python tools/progresso.py --check && python tools/checa_links.py
gh pr checks 3
```
