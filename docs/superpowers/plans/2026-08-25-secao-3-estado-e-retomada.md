# Seção 3 — estado e pendências

Escrito em 25/08/2026, ao fim da seção. Este arquivo é o **registro versionado
das pendências da Seção 3**: o que ficou aberto, o que foi deliberadamente
adiado, e o que a Seção 4 herda. O plano completo é
[`2026-08-24-secao-3-esteira-e-ambientes.md`](2026-08-24-secao-3-esteira-e-ambientes.md).

> **Versão anterior deste arquivo:** ele nasceu como um instantâneo de sessão
> interrompida ("Tarefa 8 bloqueada, Tarefa 9 sem revisão, Tarefa 10 não
> iniciada, 32 testes"). Nada disso vale mais, e três auditorias independentes
> apontaram o mesmo: era o único lugar versionado onde as pendências moravam, e
> estava congelado. Reescrito por isso.

---

## Onde cada tarefa parou

| # | Tarefa | Estado |
|---|---|---|
| 1 | Destravar a suíte do frontend | ✅ completa (`5fde04e`) |
| 2 | Receita de migrações cria o banco do zero | ✅ completa (`9058bce`, `5b0e611`) |
| 2b | Ponto cego de enum no teste da receita | ✅ completa (`2c5b2a4`) |
| 3 | `tools/catraca.py` | ✅ completa (`7256bfe`, `e00ab24`) |
| 4 | ADR 0006 | ✅ completa (`412b5ff`) |
| 5 | `.github/workflows/ci.yml` | ✅ completa, **verde no runner** |
| 6 | Branch `staging` | ✅ criada e publicada |
| 7 | Roteiro dos painéis externos | ✅ completa (`a9e84e7`, `4b93ecf`) |
| 8 | Supabase local em Docker | ✅ completa (`f4941ac`) — a CLI foi instalada via scoop |
| 9 | `seed.py` com volume realista | ✅ completa, após **três** rodadas de correção |
| 10 | Fechamento | ✅ completa (`925bc09`) |

---

## O que a Seção 3 **não** entregou

Cada item aqui é uma pendência real, não uma tarefa esquecida.

### 1. O portão não bloqueia — e não é falta de executar

Branch protection **não está disponível**: o repositório é privado num plano
Free. Medido em 25/08/2026:

```
gh api repos/:owner/:repo/branches/{main,develop,staging}/protection → 404 nas três
gh api repos/:owner/:repo/rulesets
  → 403 "Upgrade to GitHub Pro or make this repository public to enable this feature."
gh pr view 3 --json mergeable,mergeStateStatus → MERGEABLE / UNSTABLE
```

`UNSTABLE` significa: há check não-verde **e o merge continua permitido**. Os
três jobs rodam e reprovam corretamente; ninguém é barrado por isso.

**Decisão de Thiago, 26/08/2026: fica assim** — sem GitHub Pro e sem tornar o
repositório público. A esteira é um conselheiro, e quem mergeia é o portão. Isto
deixou de ser pendência e virou uma característica conhecida do projeto; o
roteiro para ligar o bloqueio, se o plano mudar, está em
[`../../dev/ambientes-online.md`](../../dev/ambientes-online.md), seção 5.

### 2. Ninguém consegue logar na conta semeada

Os 3 usuários que o `seed.py` cria têm `supabase_id` nulo — medido:
`select count(*) filter (where supabase_id is null) from users` → `3 de 3`.

Isso é o último elo do propósito declarado da seção. O volume existe e está
certo (300 produtos, 5 projetos, 25 ambientes, 500 itens, 959 opções), o banco
sobe do zero pela receita, mas **uma tela não renderiza sem sessão**: medir
`/api/products` com 300 produtos exige um JWT que resolva para aquela
`account_id`, e nada nesta branch produz um. Sem isso, a seção montou o palco,
não o cenário de medição.

Quem for montar o staging precisa resolver isto junto.

### 3. Os passos de painel

Serviço de staging no Render, preview da Vercel, projeto Supabase de staging,
banco de produção novo. Roteiro campo a campo em
[`../../dev/ambientes-online.md`](../../dev/ambientes-online.md). As caixas
correspondentes no `PROGRESS.md` estão **desmarcadas**, de propósito.

---

## Achados registrados e não corrigidos

Nenhum destes é bloqueio de merge. Todos foram medidos.

### No portão

- **O contador de cores não vê formas que já estão no código.** `RE_PALETA`
  cobre 18 prefixos e `RE_ARBITRARIA` só 3 (`bg|text|border`). Passam sem ser
  contadas: `bg-white`/`text-black`/`border-white` e afins (**70 ocorrências
  vivas** em `src`), hex arbitrário fora de `bg|text|border`
  (`shadow-[#F88379]`, `from-[#F88379]` — 3 ocorrências), e cor literal em
  `.css` sob `src` (o contador só varre `.ts`/`.tsx`). O baseline de 521 está
  certo para o critério que a ferramenta imprime; é o critério que é mais
  estreito do que "cor literal".
- **A medida de lint é zerável pela config do eslint.** Um `globalIgnores`
  em `eslint.config.mjs` derruba `eslint_erros` de 93 para 8, e a catraca
  convida a gravar o 8. Ela mede a saída do eslint, não a cobertura dele.
- **"Varredura de literais proibidos" encolheu para "cor literal".** Os outros
  literais que o `CLAUDE.md` proíbe — `account_id` literal (Art. 1), URL/chave
  /host fixo (Art. 4), grafia `ArchSmart`/`Ecowe` (Art. 8) — continuam em
  revisão manual. Nada mudou nisso na Seção 3, e nada registrava que não mudou.
- **`checa_links.py` não valida âncoras.** `alvo.split("#")[0]` descarta o
  fragmento. Hoje há 4 links inter-arquivo com âncora e **zero** quebrados —
  o furo é real, não está sendo explorado. Renomear um título em `deploy.md`
  quebra os links em silêncio.
- **`checa_links.py`: três falsos positivos** (link dentro de bloco indentado
  por 4 espaços, destino entre `<>`, percent-encoding) e formas não vistas
  (link estilo referência, autolink, `<a href>`). Nenhuma ocorre hoje.
- **Nada testa `downgrade`.** As 27 migrações têm `downgrade()` não vazio hoje,
  mas isso é estado, não portão.
- **O CI não roda `next build` nem os testes E2E**, não lint/tipa o backend
  (não há ruff/mypy instalado), e não toca em `extension/`.
- **`actions/checkout@v4` e `actions/setup-python@v5` não estão fixadas por
  SHA**, e `on: pull_request` só dispara para `develop`/`staging`/`main`.

### No seed e na receita

- **`uuid4()` não é semeado**: o conteúdo do seed é determinístico, a
  identidade não. Script de medição não pode fixar id de projeto.
- **O realismo tem arestas**: preço `uniform(80, 8000)` igual para toda
  categoria; 9 dos 25 ambientes repetem nome dentro do mesmo projeto; 298 dos
  300 produtos não têm `image_url`.
- **A fixture `banco_da_receita` não derruba o banco no teardown** — há
  `DROP DATABASE IF EXISTS` na entrada, nenhum na saída. Deixa banco residente
  e roda as 27 migrações 3× por suíte.
- **`test_receita_migracoes.py` reimplementa parsing de URL**
  (`os.environ["DATABASE_URL"].rsplit("/", 1)[0]`) para conectar em
  `{base}/postgres` e rodar `DROP DATABASE` — o padrão que `guarda_banco.py`
  existe para proibir. Contido hoje porque o `conftest.py` já validou a URL.

### Menores

- `"lint": "eslint"` sem o `.` no `package.json` do frontend, enquanto o CI mede
  com `npx eslint .`.
- `tools/test_checa_links.py::test_nao_acusa_link_existente` falha quando o cwd
  é a raiz; passa de dentro de `tools/`, que é como o CI o executa.
- `ArchSmart-api/tools/` virou pacote Python chamado `tools`, e a raiz também
  tem um `tools/`. O `__init__.py` documenta a colisão; o pacote regular vence.
- O Postgres de teste tem **duas** definições (`docker-compose.test.yml` e o
  bloco `services:` do `ci.yml`), sincronizadas à mão.
- O check da Vercel reprova em todo PR (`Deployment was blocked`) — não é um
  dos três checks do roteiro, mas é um X vermelho permanente.

---

## O que a Seção 4 herda

**A favor:**

- `test_receita_reproduz_os_models` transforma "mudei o model e esqueci a
  migração" em CI vermelho — e a Seção 4 acrescenta `account_id`/`created_by`
  em 10 tabelas.
- `test_enums_do_banco_batem_com_os_models` e a comparação de `server_default`
  fecham dois pontos cegos do `compare_metadata`.
- `test_schema_nao_depende_de_recurso_exclusivo_do_supabase` impede que alguém
  "resolva" isolamento com RLS em vez do `ScopedRepository`.
- 500 itens de orçamento e 959 opções em 25 ambientes dão material real para
  medir o N+1 do `calculate_quantity`.

**Contra — e isto precisa ser lido antes de começar:**

1. **O seed quebra quando `account_id` virar obrigatório.** `seed.py` instancia
   `Environment`, `Budget`, `BudgetItem` e `ItemOption`, quatro das dez tabelas
   que ganham a coluna. Se ela nascer `NOT NULL`, o seed quebra no mesmo PR — e
   com ele o único volume realista que existe. **Trate o seed na mesma tarefa
   que trata a coluna.**
2. **A suíte ficou presa a host local.** `conftest.py` usa
   `exigir_host_local=True`; rodar contra um Postgres remoto passa a exigir
   mudar a guarda, não uma variável de ambiente.
3. **A catraca `modulos_sem_doc` mede `app/services/*.py`.** Service novo exige
   `.md` em `docs/dev/modulos/` no mesmo PR. `app/db/repository.py` e
   `app/core/security.py` não caem na regra — o `ScopedRepository`, peça central
   da seção, escapa da exigência que a peça periférica tem.
4. **O achado do auto-link por e-mail agora tem caixa** na Seção 4 do
   `PROGRESS.md`. A urgência foi medida (a opção *Confirm email* está ligada,
   confirmada no painel em 24/08/2026), mas essa proteção mora num painel
   externo, fora do controle de versão, e nada no repositório detecta se alguém
   desligá-la.

---

## Como confirmar que o estado acima é verdade

```bash
cd ArchSmart-api && docker compose -f docker-compose.test.yml up -d --wait && ./venv/Scripts/python.exe -m pytest -q   # 78 passed
cd ArchSmart-web && npm run typecheck && npm test                                          # 4 arquivos, 7 testes
python tools/catraca.py && python tools/progresso.py --check && python tools/checa_links.py   # da RAIZ
cd tools && python -m unittest discover -p "test_*.py"                                     # 44 testes
gh pr checks 3
```
