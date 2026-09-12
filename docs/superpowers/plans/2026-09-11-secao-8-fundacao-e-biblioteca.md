# Seção 8 — Fundação e Biblioteca: plano de execução

> **Para quem executa com agente:** SUB-SKILL OBRIGATÓRIA — use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixas (`- [ ]`) para acompanhamento.

**Objetivo:** deixar de pé a fundação que as nove telas vão usar — sessão em
desenvolvimento, régua honesta, telemetria que mede o que diz medir, rate limit
por conta, um `FormField` só e portão de e2e — e migrar a **Biblioteca** como
piloto, fechando os nove itens da definição de pronto numa tela real.

**Arquitetura:** a telemetria deixa de inferir e passa a ouvir. O
`QueryBoundary` anuncia que existe uma região de dados na tela e depois reporta
o desfecho dela (`dados`/`vazio`/`erro`); o `TelemetriaDeTela` só cronometra e
emite. No cliente, os eventos passam a sair em lote; no servidor, o balde do
rate limit passa a ser por conta. A Biblioteca consome isso: `QueryBoundary` nos
cinco estados, região principal declarada, badge do inbox no prefetch.

**Stack:** Next.js App Router 16 + TanStack Query v5 + vitest/jsdom + Playwright;
FastAPI + slowapi + Postgres 17; `tools/catraca.py` (só biblioteca padrão).

**Spec:** [`docs/superpowers/specs/2026-09-11-secao-8-fundacao-e-biblioteca-design.md`](../specs/2026-09-11-secao-8-fundacao-e-biblioteca-design.md)

---

## Restrições globais

Valem para **todas** as tarefas. Copiadas da spec e do `CLAUDE.md`:

- **Branch:** `secao-8-fundacao-e-biblioteca`, criada de `develop`. Merge em
  `develop` no fim da seção, e PR `develop` → `staging` depois.
- **Art. 1 — nenhum `account_id` literal.** Toda leitura e escrita passa por
  `ScopedRepository`; a identidade vem do `RequestContext`, montado no servidor.
- **Art. 3 — nenhuma regra de negócio ou limite de plano decidido no front.**
- **Art. 4 — nenhuma URL, chave ou host fixo.** Front usa
  `process.env.NEXT_PUBLIC_API_URL` (já embrulhado por `lib/api/core.ts`);
  backend usa `app/core/config.py`. Toda chamada de rede sai de `src/lib/api/`.
- **Art. 7 — nenhuma cor literal em classe utilitária.**
- **Art. 8 — a marca é "Arq Smart"**, duas palavras, com Q. Zero ocorrência de
  `ArchSmart`, `Ark Smart` ou `Ecowe` em código, copy ou comentário.
  `ArchSmart-api`/`ArchSmart-web` são nome de diretório, não grafia da marca.
- **A senha do usuário E2E nunca aparece em saída, log, commit ou transcrição.**
  Ela vive em `ArchSmart-web/.env.e2e.local`, ignorado pelo
  `ArchSmart-web/.gitignore` (linha 34, `.env*`). Carregue-a por variável de
  ambiente; nunca `cat` o arquivo, nunca a cole numa mensagem.
- **Número afirmado sem medição é número errado.** Ao afirmar um número, cole o
  comando que o produziu.
- **Nada de "é esperado que falhe".** Se um comando reportar falha, é falha.
- **Nunca rode `alembic upgrade head` à mão** contra staging ou produção.
- **Não migre área de passagem.** Se uma tarefa encostar em tela que não é a
  Biblioteca, pare e registre; não migre "já que estou aqui".
- Comentários e docstrings **em português**; siga a convenção de acento do
  arquivo que você está editando (os arquivos Python existentes não acentuam).

**Como rodar os testes** (os mesmos comandos do CI):

```bash
# Frontend
cd ArchSmart-web
npm run typecheck
npm test

# Backend
cd ArchSmart-api
.\venv\Scripts\Activate.ps1
docker compose -f docker-compose.test.yml up -d --wait
pytest

# Repositório (sem venv)
python tools/catraca.py
python tools/progresso.py --check
python tools/checa_links.py
cd tools; python -m unittest discover -p "test_*.py"
```

> `checa_links.py` roda **da raiz**. Os testes de `tools/` rodam **de dentro de
> `tools/`** — de fora, `test_checa_links.py::test_nao_acusa_link_existente`
> reprova, e isso é conhecido e documentado no `CLAUDE.md`.

---

## Estrutura de arquivos

**Fundação — criados:**

| Arquivo | Responsabilidade |
|---|---|
| `ArchSmart-web/src/features/telemetry/fila.ts` | A fila de eventos: acumula, descarrega por tempo/tamanho, descarrega na saída da página. Não sabe o que é um evento de tela. |
| `ArchSmart-api/tests/api/test_rate_limit.py` | Testes da `chave_por_conta`. |

**Fundação — modificados:**

| Arquivo | O que muda |
|---|---|
| `ArchSmart-web/src/features/telemetry/contexto.tsx` | `VazioDaTelaProvider` → `ProntidaoDaTelaProvider`; o canal passa a carregar anúncio e desfecho, não só "vazio". |
| `ArchSmart-web/src/features/telemetry/types.ts` | `MedidoAte` ganha `erro` e `abandonado`; `decidirMedicao` troca de assinatura. |
| `ArchSmart-web/src/features/telemetry/TelemetriaDeTela.tsx` | Para de espiar o `QueryCache`; passa a ouvir o canal e a cronometrar. |
| `ArchSmart-web/src/features/telemetry/hooks.ts` | `useTrack` passa a enfileirar. |
| `ArchSmart-web/src/components/ui/query-boundary.tsx` | Anuncia na montagem, reporta o desfecho, aceita `principal`. |
| `ArchSmart-web/src/components/ui/form.tsx` | `FormItem` aceita `sensivel` → `data-private`. |
| `ArchSmart-web/src/lib/api/core.ts` | `Requisicao` ganha `keepalive?: boolean`. |
| `ArchSmart-api/app/core/rate_limit.py` | Ganha `chave_por_conta`. |
| `ArchSmart-api/app/api/endpoints/telemetry.py` | O `@limiter.limit` passa a usar `chave_por_conta`. |
| `tools/catraca.py` | Quatro furos de régua tapados. |
| `.github/workflows/ci.yml` | Quarto job: Playwright contra staging. |

**Fundação — apagados:** `ArchSmart-web/src/components/ui/form-field.tsx`.

**Biblioteca — modificados:** `app/(dashboard)/library/components/LibraryData.tsx`
e `LibraryContent.tsx`, `components/library/ProductCard.tsx`,
`LibraryToolbar.tsx`, `ClipperOnboarding.tsx`, e os três arquivos grandes, que a
Tarefa 8 divide.

---

### Interfaces da fundação, num lugar só

Quem executa uma tarefa isolada precisa destes nomes sem ler as outras:

```ts
// features/telemetry/contexto.tsx
export type Desfecho = "dados" | "vazio" | "erro"
export interface Report { desfecho: Desfecho; principal: boolean }

export interface ProntidaoDaTela {
    /** O QueryBoundary chama na montagem: "existe região de dados nesta tela". */
    anunciar: () => void
    /** O QueryBoundary chama quando resolve. */
    reportar: (report: Report) => void
    /** A telemetria chama para ser avisada; devolve o cancelamento. */
    assinar: (ouvinte: (report: Report) => void) => () => void
    /** Quantas regiões anunciaram nesta navegação. */
    anunciadas: () => number
    /** Zera tudo — chamado pela telemetria a cada navegação. */
    limpar: () => void
}

export function ProntidaoDaTelaProvider(props: { children: ReactNode }): ReactElement
export function useProntidao(): ProntidaoDaTela | null   // null fora do provider
```

```ts
// features/telemetry/types.ts
export type MedidoAte = "dados" | "vazio" | "erro" | "pintura" | "abandonado"
export type MedidoDe = "clique" | "commit"
export function decidirMedicao(report: Report | null, houveAnuncio: boolean): MedidoAte
export function vazioDoDesfecho(desfecho: Desfecho | null): boolean | null
```

```ts
// features/telemetry/fila.ts
export function enfileirar(evento: EventoDeProduto): void
export function descarregar(opcoes?: { keepalive?: boolean }): void
/** Só para teste: zera a fila e cancela o timer pendente. */
export function _zerarFila(): void
```

```python
# app/core/rate_limit.py
def chave_por_conta(request: Request) -> str
```

---

## Tarefa 1 — Sessão em desenvolvimento e a verificação visual da Seção 6

Esta tarefa não tem teste automatizado: o que ela produz é **observação humana**,
que é exatamente o que nenhum portão deste repositório consegue fazer. Ela vem
primeiro porque desbloqueia as Tarefas 9 e 10, e porque a dívida visual da
Seção 6 fica mais cara a cada camada que entra por cima.

**Arquivos:**
- Modificar: `docs/dev/medicoes/2026-09-10-verificacao-visual-secao-6.md`
- Nunca versionar: `ArchSmart-web/.env.e2e.local` (já existe, já ignorado)

**Interfaces:**
- Consome: nada.
- Produz: o doc de medição preenchido, que a Tarefa 10 cita.

- [ ] **Passo 1: confirmar que a credencial está carregável, sem imprimi-la**

```bash
cd ArchSmart-web
python -c "from pathlib import Path; d=dict(l.split('=',1) for l in Path('.env.e2e.local').read_text(encoding='utf-8').splitlines() if l.strip() and not l.startswith('#') and '=' in l); print('email:', d['E2E_EMAIL'].strip()); print('senha:', 'presente' if d['E2E_PASSWORD'].strip() else 'VAZIA')"
```

Esperado: `email: ana.arquiteta@seed.arqsmart.local` e `senha: presente`. Se
sair `VAZIA`, **pare** e peça a Thiago — não invente credencial, não use
nenhuma outra conta (a Seção 7 encontrou uma credencial alheia salva no autofill
do Chrome desta máquina; conta de identidade desconhecida não se usa para entrar
em ambiente nenhum).

> ⚠️ **Rota corrigida em 11/09/2026, depois de a primeira tentativa voltar
> bloqueada.** A tentativa original era dirigir o Chrome por automação e digitar
> a credencial no formulário. Isso **não é possível**: um agente não digita
> senha em campo de formulário, e as duas alternativas indiretas tentadas foram
> recusadas pelo próprio ambiente. Registrado no commit `95b3003`.
>
> A rota que funciona já existe neste repositório e já rodou em 10/09/2026: o
> **Playwright** faz o login lendo `E2E_EMAIL`/`E2E_PASSWORD` de `process.env`
> e preenchendo com `fill()` — a senha vai do ambiente para a página sem passar
> por nada que o agente escreva. É o que `e2e/medicao-biblioteca.spec.ts:31-36`
> já faz.
>
> Então esta tarefa captura por Playwright, inspeciona as capturas, e entrega as
> capturas a Thiago. **E diz, item a item, quem olhou o quê:** estilo computado
> é máquina; captura inspecionada é modelo; olho humano é Thiago. São três
> evidências diferentes, e o doc não pode embaralhá-las — foi exatamente esse
> embaralhamento que deixou a Seção 6 parecer verificada.

- [ ] **Passo 2: escrever o instrumento de captura**

Crie `ArchSmart-web/e2e/captura-visual-secao-6.spec.ts`. É **instrumento**, não
guarda permanente — como o `medicao-biblioteca.spec.ts`. Ele:

1. exige `CAPTURAS_DIR` no ambiente e **falha com mensagem clara** se faltar
   (nunca pule silenciosamente: o `CLAUDE.md` proíbe);
2. faz login pelo mesmo caminho do `medicao-biblioteca.spec.ts`;
3. para cada alvo e em **duas larguras** (390×844 e 1440×900), navega, abre o
   menu quando o alvo é um menu, e salva a captura em `CAPTURAS_DIR`;
4. lê o **estilo computado** do que dá para medir por máquina, e imprime.

Os alvos, e o que medir em cada um:

| Alvo | Rota | Captura | Estilo computado a imprimir |
|---|---|---|---|
| galeria de componentes | `/dev/componentes` | página inteira | — |
| menu do cabeçalho | `/dashboard` | menu aberto | `min-height` de cada `[role="menuitem"]` |
| card de produto | `/library` | menu do card aberto | `min-height` dos itens |
| tabela financeira | `/finance` | menu de linha aberto | `min-height` dos itens |
| card de ambiente | `/projects/<id>` | menu aberto | `min-height` dos itens |
| alternador de tema | `/dashboard` | menu aberto | `min-height` dos itens |
| toast destrutivo | galeria | toast visível | `color` do botão de fechar e `background-color` do toast |
| `Skeleton` | galeria | estado de carregamento | `aria-hidden` de cada skeleton |

O `min-height` esperado é **44px** (`min-h-11`). Imprima o valor medido, não um
"ok": o número é a evidência.

Para achar os seletores, leia os seis arquivos que têm item de menu — e **meça a
lista, não confie nela**:

```bash
grep -rc  "<DropdownMenu\(Checkbox\|Radio\)\?Item" ArchSmart-web/src --include=*.tsx | grep -v ":0" | grep -v __tests__
```

Se um alvo não for alcançável (rota que exige dado que a conta de seed não tem,
por exemplo), **não invente**: registre o alvo como não alcançado e o motivo.

- [ ] **Passo 3: rodar a captura**

```bash
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
CAPTURAS_DIR="<diretório de scratch da sessão>" npx playwright test e2e/captura-visual-secao-6.spec.ts --reporter=line
```

O `playwright.config.ts` já sobe o dev server (`webServer: npm run dev`, com
`reuseExistingServer`), então não é preciso subi-lo à mão.

Guarde a saída dos estilos computados: ela vai no doc de medição.

- [ ] **Passo 4: inspecionar as capturas**

Abra cada PNG e olhe. O que procurar, por alvo:

- **`min-h-11`:** o alvo de toque ficou com ~44px e o menu **não** estourou o
  viewport nem cortou item — em 390px especialmente, que é onde um menu
  comprido quebra. Essa é a maior das três mudanças: 44px é bem mais que os
  ~30px de antes.
- **toast destrutivo:** o ícone de fechar é visível contra o fundo destrutivo. A
  troca de `text-red-*` por token pode ter deixado o ícone quase invisível, e
  isso o CSS compilado não diz.
- **`Skeleton`:** visualmente nada mudou — o `aria-hidden` é para leitor de tela.

- [ ] **Passo 5: entregar as capturas a Thiago**

Mande os PNGs com `SendUserFile`, para que o olho humano aconteça de verdade.
Priorize as duas larguras do menu mais comprido e o toast destrutivo.

- [ ] **Passo 6: preencher o doc de medição**

Em `docs/dev/medicoes/2026-09-10-verificacao-visual-secao-6.md`, uma seção
datada de 11/09/2026 com **três evidências por item**: estilo computado
(máquina), captura inspecionada (modelo), olho humano (Thiago — pendente até ele
responder). Onde algo estiver errado, registre como achado e **não conserte
aqui**: esta tarefa é olhar, não mexer, e misturar as duas arruína a medição de
qual mudança causou o quê.

- [ ] **Passo 7: commit**

```bash
git add ArchSmart-web/e2e/captura-visual-secao-6.spec.ts docs/dev/medicoes/2026-09-10-verificacao-visual-secao-6.md
git commit -m "test(secao-8): captura visual da Secao 6 por Playwright"
```


## Tarefa 2 — Tapar os quatro furos da catraca

**Arquivos:**
- Modificar: `tools/catraca.py`
- Modificar: `tools/test_catraca.py`
- Modificar: `tools/catraca.json` (pela ferramenta, nunca à mão)

**Interfaces:**
- Consome: nada.
- Produz: `contar_cores()` e `contar_hover_sem_focus_no_texto()` com cobertura
  ampliada; baseline em `cores_literais: 588` e `hover_sem_focus: 9`.

- [ ] **Passo 1: escrever os quatro testes que falham**

Em `tools/test_catraca.py`, dentro de `TestContagemDeCores`:

```python
    def test_conta_branco_e_preto(self):
        # `white`/`black` nao tem sufixo numerico, entao RE_PALETA nao os pega.
        # Sao 68 ocorrencias reais no front medidas em 11/09/2026, e a regua
        # dizia zero.
        raiz = self._escrever('<div className="bg-white text-black border-white" />')
        self.assertEqual(contar_cores(raiz), 3)

    def test_conta_hex_fora_de_bg_text_border(self):
        raiz = self._escrever('<div className="shadow-[#F88379] ring-[#fff]" />')
        self.assertEqual(contar_cores(raiz), 2)

    def test_conta_ring_offset_de_paleta(self):
        raiz = self._escrever('<div className="ring-offset-slate-900" />')
        self.assertEqual(contar_cores(raiz), 1)
```

E em `TestMedidasDeAcessibilidade`:

```python
    def test_invisible_com_group_hover_sem_foco_conta(self):
        # `invisible group-hover:visible` e `hidden group-hover:block` sao o
        # MESMO defeito que `opacity-0 group-hover:opacity-100`: o elemento so
        # existe para quem tem mouse. A regua via um e nao via os outros dois.
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="invisible group-hover:visible"'
            ),
            1,
        )

    def test_hidden_com_group_hover_sem_foco_conta(self):
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="hidden group-hover:block"'
            ),
            1,
        )

    def test_invisible_com_focus_within_nao_conta(self):
        self.assertEqual(
            catraca.contar_hover_sem_focus_no_texto(
                'className="invisible group-hover:visible focus-within:visible"'
            ),
            0,
        )
```

- [ ] **Passo 2: rodar e ver os seis falharem**

```bash
cd tools
python -m unittest test_catraca -v
```

Esperado: FAIL nos seis testes novos — `contar_cores` devolve 0 onde o teste
espera 3, 2 e 1; `contar_hover_sem_focus_no_texto` devolve 0 onde espera 1.

- [ ] **Passo 3: ampliar as regras em `tools/catraca.py`**

```python
RE_PALETA = re.compile(rf"\b({_PREFIXOS})-({_PALETAS})-[0-9]{{2,3}}\b")
# `white` e `black` nao tem sufixo numerico e por isso nunca casaram com
# RE_PALETA. Sao cor literal igual: `bg-white` no lugar de `bg-background` e a
# forma mais comum de violar o Art. 7 sem a regua notar.
RE_BRANCO_PRETO = re.compile(rf"\b({_PREFIXOS})-(white|black)\b")
# Qualquer prefixo, nao so bg|text|border: `shadow-[#F88379]` e cor literal.
RE_ARBITRARIA = re.compile(r"\b[a-z]+(-[a-z]+)*-\[#[0-9a-fA-F]{3,8}\]")
```

E em `_PREFIXOS`, acrescentar `ring-offset` **antes** de `ring`:

```python
_PREFIXOS = (
    "ring-offset|ring|bg|text|border|from|to|via|fill|stroke|outline|"
    "decoration|shadow|accent|caret|divide|placeholder"
)
```

> A ordem importa: com `ring` antes, a alternância casa `ring` em
> `ring-offset-slate-900`, exige `-<paleta>` logo depois, encontra `-offset` e
> desiste — e o furo continua aberto com a regra "corrigida". Escreva o teste
> `test_conta_ring_offset_de_paleta` antes de mexer nisto, para ver a diferença.

Em `contar_cores`, somar a terceira regra:

```python
        total += (
            len(RE_PALETA.findall(texto))
            + len(RE_BRANCO_PRETO.findall(texto))
            + len(RE_ARBITRARIA.findall(texto))
        )
```

E em `contar_hover_sem_focus_no_texto`, acrescentar os dois gatilhos ao lado de
`opacity-0`:

```python
RE_OPACITY_ZERO = re.compile(r"\bopacity-0\b")
RE_INVISIVEL = re.compile(r"\b(invisible|hidden)\b")
```

usando `RE_OPACITY_ZERO.search(linha) or RE_INVISIVEL.search(linha)` onde hoje
há só o primeiro. A condição de `focus`/`focus-within` que isenta a linha **não
muda** — ela é a parte certa da régua.

- [ ] **Passo 4: rodar os testes de novo**

```bash
cd tools
python -m unittest discover -p "test_*.py"
```

Esperado: os seis novos passam. **Dois antigos falham**, e isso é correto:
`test_conta_hover_sem_focus` afirma 8 contra o repositório real, e agora são 9.
Atualize-o para 9, com um comentário dizendo que o número subiu porque a régua
passou a ver `invisible`/`hidden`, não porque entrou defeito novo. Se
`test_conta_tabindex_negativo` também falhar, **pare e investigue** — nada nesta
tarefa deveria mexer nele.

- [ ] **Passo 5: medir o novo número antes de gravar**

```bash
python tools/catraca.py
```

Esperado: `cores_literais` **588** e `hover_sem_focus` **9**, as duas reprovando
contra o baseline. Se der outro número, **não ajuste o teste para casar** — meça
de onde vem a diferença. Os componentes:

```bash
grep -rEo "\b(bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder)-(white|black)\b" ArchSmart-web/src --include=*.tsx --include=*.ts | wc -l   # 68
```

- [ ] **Passo 6: gravar o baseline pela ferramenta**

```bash
python tools/catraca.py --atualizar --aceitar-piora
```

Guarde a saída: o aviso destacado que ela imprime, com cada medida que piorou, é
o registro que vai no corpo do PR. Editar `tools/catraca.json` à mão reprova no
job `Repositorio`.

- [ ] **Passo 7: commit**

```bash
git add tools/catraca.py tools/test_catraca.py tools/catraca.json
git commit -m "test(catraca): tapa quatro furos da regua antes de medir as telas

- bg-white/text-white/-black: 68 ocorrencias reais que RE_PALETA nunca viu,
  porque nao tem sufixo numerico;
- hex fora de bg|text|border (shadow-[#...]): 2;
- ring-offset-<paleta>-<n>: 0 hoje, furo fechado antes de aparecer;
- invisible/hidden + group-hover: 1, o mesmo defeito que opacity-0.

Cada furo tem teste no mesmo commit, como a Secao 6 estabeleceu. Baseline:
cores_literais 518 -> 588, hover_sem_focus 8 -> 9. Nenhum defeito novo
entrou: e a regua passando a ver o que sempre existiu."
```

---

## Tarefa 3 — O canal de prontidão

A tarefa com mais chance de errar da seção. Ela troca o gatilho do
`screen_viewed` inteiro.

**Arquivos:**
- Modificar: `ArchSmart-web/src/features/telemetry/contexto.tsx`
- Modificar: `ArchSmart-web/src/features/telemetry/types.ts`
- Modificar: `ArchSmart-web/src/features/telemetry/TelemetriaDeTela.tsx`
- Modificar: `ArchSmart-web/src/components/ui/query-boundary.tsx`
- Modificar: `ArchSmart-web/src/app/(dashboard)/layout.tsx`
- Test: `ArchSmart-web/src/__tests__/telemetry.test.tsx`,
  `ArchSmart-web/src/__tests__/query-boundary.test.tsx`

**Interfaces:**
- Consome: nada.
- Produz: `ProntidaoDaTelaProvider`, `useProntidao`, `Report`, `Desfecho`,
  `MedidoAte`, `MedidoDe`, `decidirMedicao`, `vazioDoDesfecho`, e o prop
  `principal?: boolean` no `QueryBoundary`. A Tarefa 7 consome o prop.

### O protocolo, por escrito

Três coisas acontecem por navegação:

1. **Anúncio.** Todo `QueryBoundary` chama `anunciar()` ao montar. Isso é o que
   distingue "tela sem região de dados" de "região ainda carregando" — e o que
   o desenho anterior não tinha, motivo de ele decidir no primeiro frame.
2. **Report.** Quando resolve, o boundary chama
   `reportar({ desfecho, principal })`.
3. **Emissão.** Um report `principal: true` emite na hora. Um report
   `principal: false` agenda a emissão para o frame seguinte, para que um
   `principal` que chegue no mesmo commit ganhe dele. O primeiro a emitir vence;
   os demais reports da navegação são ignorados.

E o caso sem report nenhum: **decide quando a navegação termina**, não por prazo.

```
nenhum anúncio     → medido_ate: "pintura",    load_ms = navegação → primeira pintura
anúncio sem report → medido_ate: "abandonado", load_ms = navegação → fim da navegação
```

**"Fim da navegação" são dois momentos concretos, e nenhum deles é o cleanup do
efeito.** A pendência daquela navegação fica numa `ref`, e é descarregada:

1. **no início do efeito da navegação seguinte**, quando o `pathname` é
   diferente do que está na pendência; e
2. **no `pagehide`**, que é o caso de a sessão terminar naquela tela.

> ⚠️ **Não emita no cleanup do efeito.** O StrictMode do `npm run dev` monta,
> desmonta e monta de novo com o **mesmo** `pathname`: emitir no cleanup
> produziria uma linha espúria de `pintura`/`abandonado` no primeiro desmonte, e
> — porque o dedupe por `pathname` já teria gravado — a linha real nunca sairia.
> Descarregar por "o `pathname` da pendência é diferente do atual" é imune a
> isso: no remonte do StrictMode os dois são iguais, então nada é emitido. O
> teste "sob StrictMode emite exatamente uma linha" é o que prende isso, e ele
> falha dos dois lados: zero e dois reprovam igual.
>
> O preço, em desenvolvimento só: o remonte do StrictMode substitui a pendência,
> então o cronômetro reinicia. Em produção o StrictMode não duplica efeito.

> **Por que não existe prazo.** A Biblioteca é servida por `<Suspense>` com
> `await` no servidor (`LibraryData.tsx`): o `QueryBoundary` dela só monta
> **depois** de a API responder, e o P95 dessa API é 1.220 ms hoje. Qualquer
> prazo que cubra isso atrasa toda tela sem região; qualquer prazo mais curto
> rotula a Biblioteca de `pintura`, que é o defeito que esta tarefa conserta.
> Fim de navegação é o único limite que não precisa de número chutado.

O preço, assumido e documentado: a tela sem `QueryBoundary` emite o evento
**quando o usuário sai dela**. O `load_ms` continua sendo o tempo até a pintura,
porque o instante é capturado no primeiro frame e só usado depois. Se a aba
fechar sem `pagehide`, essa visita é perdida.

- [ ] **Passo 1: escrever os testes do canal (falham)**

Em `ArchSmart-web/src/__tests__/telemetry.test.tsx`. Troque os imports de
`VazioDaTelaProvider` por `ProntidaoDaTelaProvider` e acrescente:

```tsx
function TelaComLista({ itens, principal = false }: { itens: string[]; principal?: boolean }) {
    const query = useQuery({
        queryKey: ["tela-de-teste", itens.length],
        queryFn: async () => itens,
    })
    return (
        <QueryBoundary
            query={query}
            principal={principal}
            skeleton={<p>carregando</p>}
            empty={<p>vazio</p>}
            error={() => <p>erro</p>}
        >
            {(dados) => <p>{dados.length} itens</p>}
        </QueryBoundary>
    )
}

it("tela sem regiao nenhuma emite 'pintura' quando a sessao termina nela", async () => {
    render(<Envolvido />)
    // Nada foi emitido ainda: sem anuncio, a decisao espera o fim da navegacao.
    await new Promise((r) => setTimeout(r, 50))
    expect(eventos).toHaveLength(0)

    window.dispatchEvent(new Event("pagehide"))
    await waitFor(() => expect(eventos).toHaveLength(1))
    expect(eventos[0].properties.medido_ate).toBe("pintura")
    expect(eventos[0].properties.is_empty).toBeNull()
})

it("tela sem regiao nenhuma emite 'pintura' quando a navegacao seguinte comeca", async () => {
    const { rerender } = render(<Envolvido />)
    await new Promise((r) => setTimeout(r, 50))
    expect(eventos).toHaveLength(0)

    caminhoAtual = "/dashboard"
    rerender(<Envolvido />)
    await waitFor(() => expect(eventos).toHaveLength(1))
    expect(eventos[0].properties.screen).toBe("/library")
    expect(eventos[0].properties.medido_ate).toBe("pintura")
})

it("regiao que resolve com dados emite 'dados' e is_empty false", async () => {
    render(
        <Envolvido>
            <TelaComLista itens={["a", "b"]} principal />
        </Envolvido>
    )
    await screen.findByText("2 itens")
    await waitFor(() => expect(eventos).toHaveLength(1))
    expect(eventos[0].properties.medido_ate).toBe("dados")
    expect(eventos[0].properties.is_empty).toBe(false)
    expect(eventos[0].properties.principal_declarada).toBe(true)
})

it("lista vazia emite 'vazio' e is_empty true", async () => {
    render(
        <Envolvido>
            <TelaComLista itens={[]} principal />
        </Envolvido>
    )
    await screen.findByText("vazio")
    await waitFor(() => expect(eventos).toHaveLength(1))
    expect(eventos[0].properties.medido_ate).toBe("vazio")
    expect(eventos[0].properties.is_empty).toBe(true)
})

// Este e o caso que o gatilho antigo errava: a regiao existe mas o dado veio
// de hidratacao, sem requisicao do navegador. O antigo caia em "pintura" no
// primeiro frame; este exige "dados".
it("regiao servida por cache quente (sem requisicao) emite 'dados'", async () => {
    cliente.setQueryData(["tela-de-teste", 2], ["a", "b"])
    render(
        <Envolvido>
            <TelaComLista itens={["a", "b"]} principal />
        </Envolvido>
    )
    await screen.findByText("2 itens")
    await waitFor(() => expect(eventos).toHaveLength(1))
    expect(eventos[0].properties.medido_ate).toBe("dados")
})

it("regiao em erro emite 'erro' e is_empty null", async () => {
    function TelaQueFalha() {
        const query = useQuery({
            queryKey: ["falha"],
            queryFn: async () => {
                throw new Error("estourou")
            },
            retry: false,
        })
        return (
            <QueryBoundary
                query={query}
                principal
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {() => <p>nunca</p>}
            </QueryBoundary>
        )
    }
    render(
        <Envolvido>
            <TelaQueFalha />
        </Envolvido>
    )
    await screen.findByText("erro")
    await waitFor(() => expect(eventos).toHaveLength(1))
    expect(eventos[0].properties.medido_ate).toBe("erro")
    expect(eventos[0].properties.is_empty).toBeNull()
})

it("com duas regioes, quem decide e a principal, e sai uma linha so", async () => {
    render(
        <Envolvido>
            <TelaComLista itens={[]} />
            <TelaComLista itens={["a", "b", "c"]} principal />
        </Envolvido>
    )
    await screen.findByText("3 itens")
    await waitFor(() => expect(eventos).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(eventos).toHaveLength(1)
    // A lista vazia tambem reportou; quem manda no is_empty e a principal.
    expect(eventos[0].properties.is_empty).toBe(false)
    expect(eventos[0].properties.principal_declarada).toBe(true)
})

it("sem nenhuma principal declarada, vale o primeiro report, e o evento diz isso", async () => {
    render(
        <Envolvido>
            <TelaComLista itens={["a"]} />
        </Envolvido>
    )
    await screen.findByText("1 itens")
    await waitFor(() => expect(eventos).toHaveLength(1))
    expect(eventos[0].properties.medido_ate).toBe("dados")
    expect(eventos[0].properties.principal_declarada).toBe(false)
})

it("regiao que anuncia e nunca resolve emite 'abandonado' ao sair", async () => {
    function TelaPendente() {
        const query = useQuery({
            queryKey: ["nunca-resolve"],
            queryFn: () => new Promise<string[]>(() => {}),
        })
        return (
            <QueryBoundary
                query={query}
                principal
                skeleton={<p>carregando</p>}
                empty={<p>vazio</p>}
                error={() => <p>erro</p>}
            >
                {() => <p>nunca</p>}
            </QueryBoundary>
        )
    }
    render(
        <Envolvido>
            <TelaPendente />
        </Envolvido>
    )
    await screen.findByText("carregando")
    expect(eventos).toHaveLength(0)

    window.dispatchEvent(new Event("pagehide"))
    await waitFor(() => expect(eventos).toHaveLength(1))
    expect(eventos[0].properties.medido_ate).toBe("abandonado")
    expect(eventos[0].properties.is_empty).toBeNull()
})
```

Mantenha os dois testes que já existem e continuam valendo: "sob StrictMode
emite exatamente uma linha" e "uma navegação emite uma linha, não duas" —
acrescentando `principal` ao `TelaComLista` deles. O primeiro é o que prende o
perigo do StrictMode descrito acima; não o enfraqueça.

**E troque o `describe("decidirMedicao")`**, porque a assinatura mudou. Os dois
testes antigos (`{ queriesAssentaram: true }` / `false`) não compilam mais:

```ts
describe("decidirMedicao", () => {
    it("repassa o desfecho da regiao que reportou", () => {
        expect(decidirMedicao({ desfecho: "dados", principal: true }, true)).toBe("dados")
        expect(decidirMedicao({ desfecho: "vazio", principal: true }, true)).toBe("vazio")
        expect(decidirMedicao({ desfecho: "erro", principal: true }, true)).toBe("erro")
    })

    it("diz 'abandonado' quando houve anuncio e ninguem reportou", () => {
        expect(decidirMedicao(null, true)).toBe("abandonado")
    })

    it("diz 'pintura' quando a tela nao tem regiao nenhuma", () => {
        expect(decidirMedicao(null, false)).toBe("pintura")
    })
})

describe("vazioDoDesfecho", () => {
    it("traduz os tres desfechos e o nulo", () => {
        expect(vazioDoDesfecho("vazio")).toBe(true)
        expect(vazioDoDesfecho("dados")).toBe(false)
        // `null` e "nao sei", que e diferente de "nao esta vazia".
        expect(vazioDoDesfecho("erro")).toBeNull()
        expect(vazioDoDesfecho(null)).toBeNull()
    })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
cd ArchSmart-web
npm test -- src/__tests__/telemetry.test.tsx
```

Esperado: erro de compilação antes de qualquer asserção — `ProntidaoDaTelaProvider`
não existe e `QueryBoundary` não aceita `principal`. Isso conta como falha: o
teste está pedindo a interface que a tarefa vai criar.

- [ ] **Passo 3: reescrever o canal em `contexto.tsx`**

```tsx
"use client"

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react"

export type Desfecho = "dados" | "vazio" | "erro"
export interface Report {
    desfecho: Desfecho
    principal: boolean
}

/**
 * O canal entre as regioes de dados da tela e a telemetria.
 *
 * Quem sabe que os dados estao na tela e o QueryBoundary, nao o shell — e e a
 * mesma coisa que sabe se a tela esta vazia. Antes desta secao a telemetria
 * inferia as duas espiando o QueryCache do cliente inteiro, e cronometrava a
 * query da tela anterior.
 *
 * Guardado em ref, e nao em state, DE PROPOSITO: um setState aqui re-renderiza
 * a arvore inteira do dashboard a cada regiao que resolve.
 */
export interface ProntidaoDaTela {
    anunciar: () => void
    reportar: (report: Report) => void
    assinar: (ouvinte: (report: Report) => void) => () => void
    anunciadas: () => number
    limpar: () => void
}

const Contexto = createContext<ProntidaoDaTela | null>(null)

export function ProntidaoDaTelaProvider({ children }: { children: ReactNode }) {
    const anuncios = useRef(0)
    const ouvintes = useRef(new Set<(report: Report) => void>())

    const canal = useMemo<ProntidaoDaTela>(
        () => ({
            anunciar: () => {
                anuncios.current += 1
            },
            reportar: (report) => {
                ouvintes.current.forEach((ouvinte) => ouvinte(report))
            },
            assinar: (ouvinte) => {
                ouvintes.current.add(ouvinte)
                return () => ouvintes.current.delete(ouvinte)
            },
            anunciadas: () => anuncios.current,
            limpar: () => {
                anuncios.current = 0
            },
        }),
        []
    )

    return <Contexto.Provider value={canal}>{children}</Contexto.Provider>
}

/**
 * Fora do provider devolve null, e quem chama trata.
 *
 * A galeria `/dev/componentes` usa o QueryBoundary e NAO fica dentro de
 * `(dashboard)`; sem o null, abrir a galeria estouraria.
 */
export function useProntidao(): ProntidaoDaTela | null {
    return useContext(Contexto)
}
```

- [ ] **Passo 4: ajustar `types.ts`**

```ts
import type { Desfecho, Report } from "./contexto"

/**
 * O que `load_ms` esta medindo naquela linha.
 *
 * `dados`/`vazio`/`erro`: uma regiao de dados resolveu, e o numero e o tempo
 * ate ela. `pintura`: a tela nao tem regiao nenhuma (landing, paginas legais, e
 * toda tela que a Secao 8 ainda nao migrou), e o numero e o tempo ate pintar.
 * `abandonado`: havia regiao, e o usuario saiu antes de ela resolver — o numero
 * e o tempo que ele esperou sem receber o dado.
 *
 * Sem este campo, as cinco situacoes moram na mesma coluna e quem consultar
 * soma laranja com maca.
 */
export type MedidoAte = "dados" | "vazio" | "erro" | "pintura" | "abandonado"

/**
 * De onde o cronometro partiu.
 *
 * O orcamento da spec e "clique -> dados na tela", e o commit da rota acontece
 * depois do clique. Quando da para ancorar no clique, ancora; quando nao da
 * (URL digitada, recarga, router.push), mede do commit — e o campo diz qual dos
 * dois, porque um numero que as vezes mede de um ponto e as vezes de outro sem
 * dizer de qual e exatamente o defeito que esta secao conserta.
 */
export type MedidoDe = "clique" | "commit"

export function decidirMedicao(report: Report | null, houveAnuncio: boolean): MedidoAte {
    if (report) return report.desfecho
    return houveAnuncio ? "abandonado" : "pintura"
}

/** `null` e "nao sei", que e diferente de "nao esta vazia". */
export function vazioDoDesfecho(desfecho: Desfecho | null): boolean | null {
    if (desfecho === "vazio") return true
    if (desfecho === "dados") return false
    return null
}
```

`normalizarTela` **não muda**. Os três testes dela continuam como estão.

- [ ] **Passo 5: reescrever o `TelemetriaDeTela`**

```tsx
"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useProntidao } from "./contexto"
import type { Report } from "./contexto"
import { useTrack } from "./hooks"
import { decidirMedicao, normalizarTela, vazioDoDesfecho, type MedidoDe } from "./types"

declare global {
    interface Window {
        __arqsmartOuvinteDeClique?: boolean
    }
}

/** Instante do ultimo clique em link interno, para ancorar o cronometro. */
let marcaDeClique: number | null = null

function instalarOuvinteDeClique() {
    if (typeof window === "undefined" || window.__arqsmartOuvinteDeClique) return
    window.__arqsmartOuvinteDeClique = true
    // Fase de CAPTURA: o handler do React pode chamar preventDefault, e a marca
    // precisa existir de qualquer forma.
    document.addEventListener(
        "click",
        (evento) => {
            const alvo = (evento.target as HTMLElement | null)?.closest("a[href]")
            if (!alvo) return
            const href = alvo.getAttribute("href") ?? ""
            // Link interno so: "/library", nao "https://..." nem "#ancora".
            if (!href.startsWith("/")) return
            marcaDeClique = performance.now()
        },
        true
    )
}

/** O que uma navegacao ainda deve ao banco. */
interface Pendencia {
    pathname: string
    inicio: number
    medidoDe: MedidoDe
    instanteDaPintura: number | null
    anunciadas: () => number
}

/**
 * Emite `screen_viewed` uma vez por navegacao.
 *
 * Nao infere nada: ouve o canal de prontidao. Quem sabe que os dados estao na
 * tela e o QueryBoundary, e e a mesma coisa que sabe se a tela esta vazia. Ver
 * o protocolo em docs/dev/modulos/telemetry.md e a decisao 2 da spec da
 * Secao 8.
 *
 * Monta DENTRO do ProntidaoDaTelaProvider.
 */
export function TelemetriaDeTela() {
    const pathname = usePathname()
    const prontidao = useProntidao()
    const track = useTrack()

    const pendencia = useRef<Pendencia | null>(null)
    const jaEmitido = useRef<string | null>(null)

    useEffect(() => {
        instalarOuvinteDeClique()

        const emitir = (p: Pendencia, report: Report | null) => {
            if (jaEmitido.current === p.pathname) return
            jaEmitido.current = p.pathname
            if (pendencia.current === p) pendencia.current = null

            const houveAnuncio = p.anunciadas() > 0
            // O instante da pintura e usado SO quando a tela nao tinha regiao
            // nenhuma. Capturar e usar sao momentos diferentes: e isso que
            // permite um load_ms honesto sem decidir no primeiro frame.
            const fim =
                report === null && !houveAnuncio && p.instanteDaPintura !== null
                    ? p.instanteDaPintura
                    : performance.now()

            track("screen_viewed", {
                screen: normalizarTela(p.pathname),
                load_ms: Math.round(fim - p.inicio),
                medido_ate: decidirMedicao(report, houveAnuncio),
                medido_de: p.medidoDe,
                is_empty: vazioDoDesfecho(report?.desfecho ?? null),
                principal_declarada: report?.principal ?? false,
            })
        }

        // 1. Descarrega a navegacao ANTERIOR, se houver uma em aberto e ela for
        //    de outro caminho. Isto roda antes do `limpar()`, porque o canal
        //    ainda guarda os anuncios daquela navegacao.
        //
        //    NAO faca isso no cleanup do efeito: o StrictMode monta, desmonta e
        //    monta de novo com o MESMO pathname, e emitir no cleanup produziria
        //    uma linha espuria — e, pelo dedupe, mataria a linha real.
        const anterior = pendencia.current
        if (anterior && anterior.pathname !== pathname) emitir(anterior, null)

        prontidao?.limpar()

        const medidoDe: MedidoDe = marcaDeClique !== null ? "clique" : "commit"
        const atual: Pendencia = {
            pathname,
            inicio: marcaDeClique ?? performance.now(),
            medidoDe,
            instanteDaPintura: null,
            anunciadas: () => prontidao?.anunciadas() ?? 0,
        }
        marcaDeClique = null
        pendencia.current = atual

        let aguardandoFolga = 0
        let candidato: Report | null = null

        // Um report principal emite na hora. Um nao-principal espera um frame,
        // para que uma principal que chegue no MESMO commit ganhe dele. Sem essa
        // folga, a ordem da arvore decidiria o numero.
        const aoReportar = (report: Report) => {
            if (jaEmitido.current === pathname) return
            if (report.principal) {
                cancelAnimationFrame(aguardandoFolga)
                emitir(atual, report)
                return
            }
            if (candidato) return
            candidato = report
            aguardandoFolga = requestAnimationFrame(() => emitir(atual, candidato))
        }

        const cancelarAssinatura = prontidao?.assinar(aoReportar)

        const naPintura = requestAnimationFrame(() => {
            atual.instanteDaPintura = performance.now()
        })

        // 2. A sessao pode terminar nesta tela. Sem isto, a ultima navegacao — a
        //    que diz onde o usuario parou — nunca chega.
        const aoSair = () => emitir(atual, null)
        window.addEventListener("pagehide", aoSair)

        return () => {
            cancelarAssinatura?.()
            cancelAnimationFrame(naPintura)
            cancelAnimationFrame(aguardandoFolga)
            window.removeEventListener("pagehide", aoSair)
            // Sem emissao aqui, de proposito. Ver o comentario do passo 1.
        }
    }, [pathname, prontidao, track])

    return null
}
```

> Três armadilhas deste arquivo, todas com teste no Passo 1:
>
> - **`jaEmitido` é por `pathname`, não booleano.** Ele é o que impede a segunda
>   linha na mesma navegação e o que sobrevive ao remonte do StrictMode.
> - **`anunciadas` entra na pendência como função**, não como número: no momento
>   em que a pendência é criada, nenhuma região anunciou ainda — o boundary
>   anuncia no efeito dele, que roda depois deste.
> - **A pendência anterior é descarregada antes do `limpar()`.** Invertido, o
>   `abandonado` viraria `pintura`, porque a contagem de anúncios já teria sido
>   zerada.


- [ ] **Passo 6: fazer o `QueryBoundary` anunciar e reportar**

Em `components/ui/query-boundary.tsx`, trocar o `useReportarVazio` por:

```tsx
import { useProntidao } from "@/features/telemetry/contexto"
import type { Desfecho } from "@/features/telemetry/contexto"

// ...dentro das Props:
    /**
     * Marca esta regiao como a que decide o `load_ms` e o `is_empty` da tela.
     * Uma por tela. Tela com varias regioes e nenhuma marcada usa a primeira
     * que resolver, e o evento grava `principal_declarada: false`.
     */
    principal?: boolean

// ...dentro do componente:
    const prontidao = useProntidao()

    // Anuncia UMA vez, na montagem: e o que distingue "tela sem regiao de
    // dados" de "regiao ainda carregando". Sem isto a telemetria teria de
    // decidir no primeiro frame, que e o defeito que esta secao conserta.
    useEffect(() => {
        prontidao?.anunciar()
    }, [prontidao])

    const desfecho: Desfecho | null = query.isPending
        ? null
        : query.isError
          ? "erro"
          : vazio
            ? "vazio"
            : "dados"

    useEffect(() => {
        if (desfecho) prontidao?.reportar({ desfecho, principal })
    }, [desfecho, principal, prontidao])
```

O cálculo de `vazio` e os quatro `return` de estado **não mudam**.

- [ ] **Passo 7: trocar o provider no layout**

Em `app/(dashboard)/layout.tsx`, `VazioDaTelaProvider` → `ProntidaoDaTelaProvider`.
O comentário que explica a ordem continua valendo e deve ser atualizado: o
`TelemetriaDeTela` precisa ficar dentro do provider, e agora o motivo é
`useProntidao` voltar `null` — não mais `useVazioDaTela`.

- [ ] **Passo 8: rodar tudo**

```bash
cd ArchSmart-web
npm run typecheck
npm test
```

Esperado: verde. O `query-boundary.test.tsx` pode precisar do provider em volta;
se algum teste de lá falhar por `prontidao` nulo, **não** remova o `?.` — o null
fora do provider é o contrato (a galeria depende dele). Verifique por que aquele
teste esperava outra coisa.

- [ ] **Passo 9: commit**

```bash
git add ArchSmart-web/src/features/telemetry ArchSmart-web/src/components/ui/query-boundary.tsx "ArchSmart-web/src/app/(dashboard)/layout.tsx" ArchSmart-web/src/__tests__
git commit -m "fix(telemetria): a tela declara prontidao; a telemetria para de inferir

Fecha as pendencias 2 e 4 da Secao 7 com um desenho so.

O TelemetriaDeTela nao espia mais o QueryCache: saem useQueryClient,
buscandoAlgo(), algumaBuscou e os dois rAF encadeados. O QueryBoundary
passa a anunciar que existe regiao de dados na tela e a reportar o
desfecho dela, e o evento grava medido_ate com cinco valores honestos —
dados, vazio, erro, pintura e abandonado —, medido_de (clique ou commit)
e principal_declarada.

Com isso a Biblioteca, que e servida por prefetch + HydrationBoundary e
nunca dispara requisicao do navegador, para de ser medida como 'pintura'
com o fallback do Suspense no ar."
```

---

## Tarefa 4 — `chave_por_conta` no rate limit

**Arquivos:**
- Modificar: `ArchSmart-api/app/core/rate_limit.py`
- Modificar: `ArchSmart-api/app/api/endpoints/telemetry.py:18`
- Test: `ArchSmart-api/tests/api/test_rate_limit.py` (criar)

**Interfaces:**
- Consome: nada.
- Produz: `chave_por_conta(request) -> str`.

- [ ] **Passo 1: escrever o teste (falha)**

```python
"""
Chave do rate limit do endpoint de telemetria.

O teste e direto na funcao de chave, nao enchendo o balde pelo endpoint: o
limite e estado de processo, e um teste que depende de ordem de execucao
para encher balde vira flake. O que importa provar e que dois portadores
diferentes produzem chaves diferentes, e que sem portador a chave cai no
comportamento de antes.
"""
import base64
import json

from starlette.requests import Request

from app.core.rate_limit import chave_por_conta


def _token(sub: str) -> str:
    corpo = base64.urlsafe_b64encode(json.dumps({"sub": sub}).encode()).decode().rstrip("=")
    return f"cabecalho.{corpo}.assinatura"


def _request(authorization: str | None) -> Request:
    cabecalhos = []
    if authorization:
        cabecalhos.append((b"authorization", authorization.encode()))
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/telemetry/events",
            "headers": cabecalhos,
            "client": ("10.0.0.1", 1234),
        }
    )


def test_portadores_diferentes_enchem_baldes_diferentes():
    a = chave_por_conta(_request(f"Bearer {_token('usuario-a')}"))
    b = chave_por_conta(_request(f"Bearer {_token('usuario-b')}"))
    assert a != b


def test_mesmo_portador_cai_no_mesmo_balde():
    token = _token("usuario-a")
    assert chave_por_conta(_request(f"Bearer {token}")) == chave_por_conta(
        _request(f"Bearer {token}")
    )


def test_sem_token_cai_no_ip():
    assert chave_por_conta(_request(None)) == "10.0.0.1"


def test_token_ilegivel_cai_no_ip():
    # Token que nao e um JWT nao pode derrubar requisicao: o limitador roda
    # antes de qualquer autenticacao, e quem responde 401 e o resolvedor de
    # identidade, nao este arquivo.
    assert chave_por_conta(_request("Bearer isto-nao-e-jwt")) == "10.0.0.1"


def test_sub_ausente_cai_no_ip():
    corpo = base64.urlsafe_b64encode(json.dumps({"aud": "x"}).encode()).decode().rstrip("=")
    assert chave_por_conta(_request(f"Bearer cab.{corpo}.ass")) == "10.0.0.1"
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
cd ArchSmart-api
pytest tests/api/test_rate_limit.py -v
```

Esperado: `ImportError: cannot import name 'chave_por_conta'`.

- [ ] **Passo 3: implementar**

Em `app/core/rate_limit.py`:

```python
import base64
import binascii
import json


def chave_por_conta(request: Request) -> str:
    """
    Chave de limite por portador do token, nao por IP do cliente.

    Mesmo motivo da `chave_por_apresentacao` acima: o uvicorn roda sem
    --forwarded-allow-ips, entao `get_remote_address` resolve para o IP do
    proxy em toda requisicao e o limite do endpoint vira um balde unico da
    plataforma inteira. No endpoint de telemetria isso significa que um
    usuario navegando rapido silencia os eventos de todos os outros — e o 429
    e engolido pelo cliente, entao a perda e indistinguivel de "ninguem
    navegou".

    DECODIFICA SEM VERIFICAR ASSINATURA, e isso serve para AGRUPAR, nunca
    para autorizar. Quem autoriza continua sendo `get_repo`, que resolve a
    identidade contra o Supabase. Consequencia assumida: um atacante anonimo
    rotacionando `sub` forjado escapa deste balde — e leva 401 do resolvedor
    de identidade, nao gravacao. O que esta chave protege e usuario legitimo
    de usuario legitimo.
    """
    autorizacao = request.headers.get("authorization", "")
    if autorizacao.lower().startswith("bearer "):
        token = autorizacao[7:]
        partes = token.split(".")
        if len(partes) == 3:
            try:
                corpo = partes[1]
                corpo += "=" * (-len(corpo) % 4)
                sub = json.loads(base64.urlsafe_b64decode(corpo)).get("sub")
            except (ValueError, binascii.Error, UnicodeDecodeError):
                sub = None
            if sub:
                return f"conta:{sub}"
    return get_remote_address(request)
```

E no endpoint:

```python
from app.core.rate_limit import chave_por_conta, limiter

@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("60/minute", key_func=chave_por_conta)
```

- [ ] **Passo 4: rodar os testes do backend**

```bash
cd ArchSmart-api
docker compose -f docker-compose.test.yml up -d --wait
pytest tests/api/test_rate_limit.py tests/api/test_telemetria.py -v
```

Esperado: os cinco novos passam e os de telemetria continuam passando. Depois
`pytest` inteiro, porque mexer em `rate_limit.py` toca o portal.

- [ ] **Passo 5: commit**

```bash
git add ArchSmart-api/app/core/rate_limit.py ArchSmart-api/app/api/endpoints/telemetry.py ArchSmart-api/tests/api/test_rate_limit.py
git commit -m "fix(telemetria): balde do rate limit por conta, nao por IP do proxy

Fecha a pendencia 3 da Secao 7 no lado do servidor. O 60/minute do
endpoint de telemetria era um balde unico da plataforma, porque
get_remote_address resolve para o IP do proxy — mesmo motivo que fez a
chave_por_apresentacao existir. Agora a chave sai do sub do portador.

Decodifica sem verificar assinatura, e o docstring diz em letras grandes
que isso agrupa e nao autoriza."
```

---

## Tarefa 5 — Fila de eventos no cliente

**Arquivos:**
- Criar: `ArchSmart-web/src/features/telemetry/fila.ts`
- Modificar: `ArchSmart-web/src/features/telemetry/hooks.ts`
- Modificar: `ArchSmart-web/src/lib/api/core.ts` (tipo `Requisicao`)
- Modificar: `ArchSmart-web/src/lib/api/telemetry.ts` (repassar `keepalive`)
- Test: `ArchSmart-web/src/__tests__/telemetry-fila.test.ts` (criar)

**Interfaces:**
- Consome: `enviarEventos(eventos: EventoDeProduto[]): Promise<void>`.
- Produz: `enfileirar`, `descarregar`, `_zerarFila`.

- [ ] **Passo 1: escrever o teste (falha)**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { EventoDeProduto } from "@/features/telemetry/types"

const lotes: EventoDeProduto[][] = []
vi.mock("@/lib/api/telemetry", () => ({
    enviarEventos: async (eventos: EventoDeProduto[]) => {
        lotes.push(eventos)
    },
}))

import { _zerarFila, descarregar, enfileirar } from "@/features/telemetry/fila"

describe("fila de eventos", () => {
    beforeEach(() => {
        lotes.length = 0
        _zerarFila()
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it("junta eventos da mesma janela numa requisicao so", async () => {
        enfileirar({ name: "a", properties: {} })
        enfileirar({ name: "b", properties: {} })
        enfileirar({ name: "c", properties: {} })
        expect(lotes).toHaveLength(0)

        await vi.advanceTimersByTimeAsync(1000)
        expect(lotes).toHaveLength(1)
        expect(lotes[0].map((e) => e.name)).toEqual(["a", "b", "c"])
    })

    it("descarrega sozinha ao encher, sem esperar o tempo", async () => {
        for (let i = 0; i < 20; i++) enfileirar({ name: `e${i}`, properties: {} })
        expect(lotes).toHaveLength(1)
        expect(lotes[0]).toHaveLength(20)
    })

    it("descarregar() manda o que houver e esvazia", async () => {
        enfileirar({ name: "a", properties: {} })
        descarregar()
        expect(lotes).toHaveLength(1)

        descarregar()
        // Fila vazia nao manda requisicao nenhuma.
        expect(lotes).toHaveLength(1)
    })

    it("nao perde evento quando o envio acontece durante o enfileiramento", async () => {
        enfileirar({ name: "a", properties: {} })
        descarregar()
        enfileirar({ name: "b", properties: {} })
        await vi.advanceTimersByTimeAsync(1000)
        expect(lotes.flat().map((e) => e.name)).toEqual(["a", "b"])
    })
})
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
cd ArchSmart-web
npm test -- src/__tests__/telemetry-fila.test.ts
```

Esperado: falha ao resolver `@/features/telemetry/fila`.

- [ ] **Passo 3: implementar a fila**

```ts
"use client"

import { enviarEventos } from "@/lib/api/telemetry"
import type { EventoDeProduto } from "./types"

/**
 * A fila de eventos.
 *
 * O contrato do servidor sempre foi um lote; o cliente e que mandava uma
 * requisicao por evento. Com o `screen_viewed` saindo a cada navegacao e a
 * Secao 8 acrescentando interacao, isso multiplicava requisicao sem precisar —
 * e o rate limit do endpoint e um balde por conta de 60/minuto.
 */
const JANELA_MS = 1000
const TAMANHO_MAXIMO = 20

let fila: EventoDeProduto[] = []
let timer: ReturnType<typeof setTimeout> | null = null

export function descarregar(opcoes: { keepalive?: boolean } = {}): void {
    if (timer !== null) {
        clearTimeout(timer)
        timer = null
    }
    if (fila.length === 0) return
    // Troca a referencia ANTES de enviar: evento enfileirado durante o envio
    // entra na fila nova, nao no lote que ja saiu.
    const lote = fila
    fila = []
    void enviarEventos(lote, opcoes)
}

export function enfileirar(evento: EventoDeProduto): void {
    fila.push(evento)
    if (fila.length >= TAMANHO_MAXIMO) {
        descarregar()
        return
    }
    if (timer === null) {
        timer = setTimeout(() => descarregar(), JANELA_MS)
    }
}

/** Só para teste. */
export function _zerarFila(): void {
    fila = []
    if (timer !== null) {
        clearTimeout(timer)
        timer = null
    }
}

// A sessao pode terminar com eventos na fila — e a ultima navegacao e a que
// diz onde o usuario parou. `keepalive` deixa a requisicao sobreviver a saida
// da pagina; sem ele o navegador a cancela.
if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => descarregar({ keepalive: true }))
    window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") descarregar({ keepalive: true })
    })
}
```

- [ ] **Passo 4: `keepalive` no cliente de API**

Em `lib/api/core.ts`, dentro de `Requisicao`:

```ts
    /**
     * Deixa a requisicao sobreviver a saida da pagina. So para telemetria: o
     * navegador limita o volume total de requisicoes keepalive, entao isto nao
     * e uma opcao para chamada comum.
     */
    keepalive?: boolean
```

e no `chamar(url, {...})`, acrescentar `keepalive: req.keepalive`.

Em `lib/api/telemetry.ts`:

```ts
export async function enviarEventos(
    eventos: EventoDeProduto[],
    opcoes: { keepalive?: boolean } = {},
): Promise<void> {
    if (eventos.length === 0) return
    try {
        await api<void>("/api/telemetry/events", {
            method: "POST",
            body: { eventos },
            keepalive: opcoes.keepalive,
        })
    } catch {
        // Silencio proposital. Ver a docstring.
    }
}
```

- [ ] **Passo 5: ligar o `useTrack` na fila**

```ts
export function useTrack() {
    return useCallback((nome: string, propriedades: Record<string, unknown> = {}) => {
        enfileirar({ name: nome, properties: propriedades })
    }, [])
}
```

- [ ] **Passo 6: rodar tudo**

```bash
cd ArchSmart-web
npm run typecheck
npm test
```

**O `telemetry.test.tsx` quebra aqui, e o conserto é obrigatório, não
condicional.** Ele mocka `@/lib/api/telemetry` e espera os eventos com `waitFor`,
cujo tempo padrão é 1000 ms — exatamente a janela da fila. Isso é um teste que
passa ou falha por sorte de relógio, e o `CLAUDE.md` proíbe conviver com isso.

Troque o mock daquele arquivo para interceptar **a fila**, não o envio:

```tsx
vi.mock("@/features/telemetry/fila", () => ({
    // Os testes do gatilho verificam QUANDO o evento e emitido e COM QUE
    // conteudo. O lote e a janela de 1s sao assunto de telemetry-fila.test.ts;
    // misturar os dois faz o relogio decidir se o teste do gatilho passa.
    enfileirar: (evento: EventoDeProduto) => {
        eventos.push(evento)
    },
    descarregar: () => {},
}))
```

O mock de `@/lib/api/telemetry` sai daquele arquivo: com a fila interceptada, ele
não é mais alcançado. E **não aumente nenhum `waitFor`** para contornar isso.

- [ ] **Passo 7: commit**

```bash
git add ArchSmart-web/src/features/telemetry ArchSmart-web/src/lib/api ArchSmart-web/src/__tests__/telemetry-fila.test.ts
git commit -m "perf(telemetria): eventos saem em lote, nao um por requisicao

Fecha a pendencia 3 da Secao 7 no lado do cliente. O contrato do servidor
sempre foi um lote; o useTrack mandava uma requisicao por evento. A fila
junta a janela de 1s, descarrega ao encher, e descarrega em pagehide e
visibilitychange com keepalive — senao a ultima navegacao da sessao, que e
a que diz onde o usuario parou, nunca chega."
```

---

## Tarefa 6 — Um `FormField` só

**Arquivos:**
- Modificar: `ArchSmart-web/src/components/ui/form.tsx`
- Apagar: `ArchSmart-web/src/components/ui/form-field.tsx`
- Modificar: `ArchSmart-web/src/app/dev/componentes/galeria.tsx`
- Modificar: `ArchSmart-web/src/__tests__/componentes-ui.test.tsx`

**Interfaces:**
- Consome: nada.
- Produz: `FormItem` com `sensivel?: boolean`.

- [ ] **Passo 1: reescrever os cinco testes contra o conjunto do rhf (falham)**

Em `componentes-ui.test.tsx`, trocar o `describe("FormField")` inteiro. O
conjunto do react-hook-form precisa de um formulário em volta:

```tsx
import { useForm } from "react-hook-form"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"

function FormularioDeTeste({
    sensivel = false,
    erro,
}: {
    sensivel?: boolean
    erro?: string
}) {
    const form = useForm({ defaultValues: { cpf: "" } })
    if (erro) form.setError("cpf", { message: erro })
    return (
        <Form {...form}>
            <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                    <FormItem sensivel={sensivel}>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                            <input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Form>
    )
}

describe("FormItem", () => {
    it("liga rotulo e campo por htmlFor", () => {
        render(<FormularioDeTeste />)
        const campo = screen.getByLabelText("CPF")
        expect(campo).toBeInTheDocument()
    })

    it("marca data-private quando o dado e sensivel", () => {
        const { container } = render(<FormularioDeTeste sensivel />)
        expect(container.querySelector('[data-private="true"]')).not.toBeNull()
    })

    it("nao marca data-private quando o dado nao e sensivel", () => {
        const { container } = render(<FormularioDeTeste />)
        expect(container.querySelector("[data-private]")).toBeNull()
    })

    it("anuncia o erro pelo aria-describedby e marca aria-invalid", async () => {
        render(<FormularioDeTeste erro="CPF invalido" />)
        const campo = await screen.findByLabelText("CPF")
        expect(campo).toHaveAttribute("aria-invalid", "true")
        const descrito = campo.getAttribute("aria-describedby") ?? ""
        expect(descrito.length).toBeGreaterThan(0)
        expect(screen.getByText("CPF invalido")).toBeInTheDocument()
    })
})
```

- [ ] **Passo 2: rodar e ver o `data-private` falhar**

```bash
cd ArchSmart-web
npm test -- src/__tests__/componentes-ui.test.tsx
```

Esperado: os testes de rótulo e erro passam (o conjunto do rhf já fazia isso);
os dois de `data-private` falham, porque `FormItem` ainda não aceita `sensivel`.

- [ ] **Passo 3: portar o `sensivel` para o `FormItem`**

```tsx
const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /**
     * Marca `data-private` para telemetria e session replay nunca capturarem o
     * valor. Mora aqui, e nao na tela, porque "este campo e sensivel" e
     * decisao de produto — deixa-la na tela e como ela some.
     */
    sensivel?: boolean
  }
>(({ className, sensivel = false, ...props }, ref) => {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        ref={ref}
        data-private={sensivel ? "true" : undefined}
        className={cn("space-y-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
})
```

- [ ] **Passo 4: apagar o componente órfão e tirá-lo da galeria**

```bash
git rm ArchSmart-web/src/components/ui/form-field.tsx
```

Na galeria, substituir a seção do `FormField` antigo por uma do conjunto do
rhf, para a galeria continuar mostrando o padrão **vigente** — é para isso que
ela existe.

- [ ] **Passo 5: provar que não sobrou import**

```bash
grep -rn "components/ui/form-field" ArchSmart-web/src
```

Esperado: nenhuma linha.

- [ ] **Passo 6: rodar tudo e commitar**

```bash
cd ArchSmart-web
npm run typecheck
npm test
cd ..
git add -A ArchSmart-web/src
git commit -m "refactor(ui): um FormField so, o do react-hook-form

Existiam dois componentes exportando FormField. O da Secao 6 era usado por
zero telas reais (so a galeria e o teste dela); o do react-hook-form, por
11. A unica coisa que o primeiro tinha e o segundo nao era a decisao de
produto sensivel -> data-private, que agora mora no FormItem.

Os cinco testes do componente apagado foram reescritos contra o conjunto
vigente, data-private incluido — nenhuma garantia morreu no caminho."
```

---

## Tarefa 7 — Biblioteca: os cinco estados, a região principal e o badge no prefetch

**Arquivos:**
- Modificar: `ArchSmart-web/src/app/(dashboard)/library/components/LibraryContent.tsx`
- Modificar: `ArchSmart-web/src/app/(dashboard)/library/components/LibraryData.tsx`
- Test: `ArchSmart-web/src/__tests__/library-estados.test.tsx` (criar)

**Interfaces:**
- Consome: `QueryBoundary` com `principal` (Tarefa 3); `useProducts`,
  `useInboxCount`, `RESPOSTA_VAZIA` (`features/library/hooks.ts`);
  `queryKeys.products.inboxCount()`.
- Produz: a Biblioteca como exemplo vivo do padrão das outras oito telas.

- [ ] **Passo 1: escrever os testes dos estados (falham)**

```tsx
// Os cinco estados da Biblioteca, pela tela e nao pelo componente: o que
// importa e que a tela nao tenha mais estado de carregamento escrito a mao.
it("mostra skeleton enquanto a lista nao chega", async () => { /* ... */ })
it("mostra o estado vazio quando a lista volta sem itens", async () => { /* ... */ })
it("mostra o estado de erro com acao de refazer quando a lista falha", async () => { /* ... */ })
it("renderiza a grade quando a lista tem itens", async () => { /* ... */ })
it("o erro da lista nao derruba a barra de ferramentas nem o badge", async () => { /* ... */ })
```

Cada um renderiza `LibraryContent` dentro de `QueryClientProvider` +
`ProntidaoDaTelaProvider`, com `useProducts` servido por `setQueryData` ou por
`queryFn` que estoura. Mocke `next/navigation` (`useSearchParams`) como o
`telemetry.test.tsx` já faz com `usePathname`.

- [ ] **Passo 2: rodar e ver falhar**

```bash
cd ArchSmart-web
npm test -- src/__tests__/library-estados.test.tsx
```

Esperado: o teste de erro falha — hoje a tela não tem estado de erro nenhum. O
`useProducts` com erro cai no `data ?? RESPOSTA_VAZIA` de `LibraryContent.tsx:55`
e a tela mostra **"Nenhum produto encontrado"**, que é uma mentira: mostra vazio
quando a verdade é que a requisição falhou.

- [ ] **Passo 3: trocar o estado manual pelo `QueryBoundary`**

Em `LibraryContent.tsx`, a região da lista passa a ser:

```tsx
{needsList && (
    <QueryBoundary
        query={query}
        principal
        skeleton={
            <div data-testid="library-skeleton" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-64 w-full" />
                ))}
            </div>
        }
        empty={<BibliotecaVazia filtros={filtros} />}
        error={(erro, refazer) => <ListaComErro erro={erro} refazer={refazer} />}
    >
        {(resposta) => (
            <>
                <div data-testid="product-grid" className="grid ...">
                    {resposta.items.map((product) => (
                        <ProductCard key={product.id} {...} />
                    ))}
                </div>
                {resposta.items.length > 0 && (
                    <PaginationControls
                        total={resposta.total}
                        page={resposta.page}
                        size={resposta.size}
                        pages={resposta.pages}
                    />
                )}
            </>
        )}
    </QueryBoundary>
)}
```

Três coisas a cuidar, nesta ordem:

1. **`principal` fica na lista**, não no badge. É a lista que define "dados na
   tela" para esta rota.
2. **O `placeholderData` do `useProducts`** mantém a lista anterior visível ao
   paginar. Com `QueryBoundary`, `isPending` é falso enquanto há
   `placeholderData`, então paginar não volta ao skeleton — que é o
   comportamento desejado e o motivo de `placeholderData` existir. Não troque
   para `isFetching`.
3. **`RESPOSTA_VAZIA` sai** de `LibraryContent`. Quem decide vazio agora é o
   `vazioPorPadrao` do boundary, que já reconhece o formato de página
   (`{items, total, page, size, pages}`). O `RESPOSTA_VAZIA` continua exportado
   por `features/library/hooks.ts` para quem mais o use — **meça antes de
   apagar**: `grep -rn "RESPOSTA_VAZIA" ArchSmart-web/src`.

`BibliotecaVazia` e `ListaComErro` vão em arquivos próprios dentro de
`app/(dashboard)/library/components/`, com a copy que hoje está inline, e a ação
"Limpar filtros" preservada (hoje em `LibraryContent.tsx:96-101`). O texto não
muda nesta tarefa: paridade é o primeiro item da definição de pronto.

- [ ] **Passo 4: pôr o badge do inbox no prefetch**

Em `LibraryData.tsx`, acrescentar o segundo prefetch:

```tsx
    // O badge do inbox ficou fora do prefetch na Secao 5, e por isso era a
    // UNICA requisicao que a Biblioteca disparava do navegador no primeiro
    // carregamento — foi ela que o load_ms quebrado da Secao 7 cronometrava.
    // `useInboxCount` tem `select`, entao o que se prefetcha e a resposta CRUA.
    await Promise.all([
        tentarPrefetch((signal) =>
            queryClient.prefetchQuery({
                queryKey: queryKeys.products.list(filtros),
                queryFn: () =>
                    apiServer<ProductsResponse>("/api/products", {
                        signal,
                        query: queryDeProdutos(filtros),
                    }),
            }),
        ),
        tentarPrefetch((signal) =>
            queryClient.prefetchQuery({
                queryKey: queryKeys.products.inboxCount(),
                queryFn: () =>
                    apiServer<ProductsResponse>("/api/products", {
                        signal,
                        query: { page: 1, size: 1, state: "CAPTURED" },
                    }),
            }),
        ),
    ])
```

> Os dois em `Promise.all`, não em sequência: são duas chamadas independentes, e
> em série elas somariam latência dentro do `<Suspense>` — o oposto do que a
> [ADR 0009](../../dev/decisoes/0009-prefetch-dentro-de-suspense.md) buscava.
> A query do badge é `page=1&size=1&state=CAPTURED`, igual à de `contarInbox`
> em `features/library/api.ts:46`; se as duas divergirem, o prefetch não é
> aproveitado e vira custo puro sem erro nenhum.

- [ ] **Passo 5: rodar tudo**

```bash
cd ArchSmart-web
npm run typecheck
npm test
```

- [ ] **Passo 6: commit**

```bash
git add "ArchSmart-web/src/app/(dashboard)/library" ArchSmart-web/src/__tests__/library-estados.test.tsx
git commit -m "feat(biblioteca): cinco estados pelo QueryBoundary e badge no prefetch

A lista passa a declarar-se regiao principal da tela, entao o load_ms e o
is_empty do screen_viewed saem dela. O estado de erro passa a existir: antes,
lista que falhava caia no `data ?? RESPOSTA_VAZIA` e a tela dizia 'nenhum
produto encontrado' — mostrava vazio onde a verdade era falha.

E o badge do inbox entra no prefetch, fechando a pendencia que a Secao 5
deixou: ele era a unica requisicao que a Biblioteca disparava do navegador
no primeiro carregamento."
```

---

## Tarefa 8 — Dividir os três arquivos acima de 400 linhas

**Arquivos:**
- Modificar: `ArchSmart-web/src/components/library/ProductFormSheet.tsx` (453)
- Modificar: `ArchSmart-web/src/components/library/NormalizationSheet.tsx` (437)
- Modificar: `ArchSmart-web/src/components/library/BatchNormalizeModal.tsx` (434)
- Criar: os arquivos extraídos, no mesmo diretório
- Modificar: `tools/catraca.json` (pela ferramenta)

**Interfaces:**
- Consome: nada das tarefas anteriores.
- Produz: `arquivos_acima_de_400` em 5.

> Esta é a tarefa com maior risco de **quebrar paridade sem teste perceber**.
> Divida por responsabilidade, não por contagem de linhas: se a divisão for só
> "corta na linha 200", ela não melhora nada e ainda embaralha o diff.

- [ ] **Passo 1: medir o ponto de partida**

```bash
wc -l ArchSmart-web/src/components/library/*.tsx | sort -n
python tools/catraca.py
```

- [ ] **Passo 2: ler cada arquivo e escrever, em uma linha, a responsabilidade de cada pedaço**

Faça isso **antes** de mover código. Candidatos típicos nestes três: o schema de
validação e os valores padrão do formulário; os campos de dimensão; a lista de
resultados do lote; a linha de um resultado. Extraia o que tem nome próprio.

- [ ] **Passo 3: extrair um pedaço, rodar os testes, repetir**

```bash
cd ArchSmart-web
npm run typecheck && npm test
```

Um commit por arquivo dividido, não um commit para os três: se a paridade
quebrar, o `git bisect` precisa de um alvo pequeno.

- [ ] **Passo 4: confirmar o número e regravar o baseline**

```bash
python tools/catraca.py
```

Esperado: `arquivos_acima_de_400` com 5 itens — os três da Biblioteca saíram e
sobraram `BuilderClient`, `settings/page.tsx`, `PortalBudget`, `produto/page.tsx`,
`EventDialog`. **São 5, e isso significa que a lista tem exatamente estes
cinco** — se outro nome aparecer, uma extração criou arquivo grande novo.

```bash
python tools/catraca.py --atualizar
```

Sem `--aceitar-piora`: aqui o número **desce**, e a ferramenta recusa gravar se
alguma medida tiver piorado.

- [ ] **Passo 5: commit**

```bash
git add ArchSmart-web/src/components/library tools/catraca.json
git commit -m "refactor(biblioteca): divide os tres arquivos acima de 400 linhas

ProductFormSheet (453), NormalizationSheet (437) e BatchNormalizeModal
(434) eram tres dos oito arquivos da lista da catraca. Divididos por
responsabilidade, nao por contagem de linhas. arquivos_acima_de_400: 8 -> 5."
```

---

## Tarefa 9 — Biblioteca: acessibilidade, tokens e responsivo

**Arquivos:**
- Modificar: `ArchSmart-web/src/components/library/NormalizationSheet.tsx:327,407`
- Modificar: `ArchSmart-web/src/components/library/ProductCard.tsx:112,121`
- Modificar: `ArchSmart-web/src/components/library/BatchNormalizeModal.tsx:340,351`
- Modificar: `ArchSmart-web/src/components/library/ClipperOnboarding.tsx:48`
- Modificar: `tools/catraca.json` (pela ferramenta)

(As linhas são as de hoje; depois da Tarefa 8 elas mudam de arquivo. **Meça de
novo** com os greps abaixo em vez de confiar nos números.)

**Interfaces:**
- Consome: a divisão da Tarefa 8.
- Produz: `cores_literais` −5, `tabindex_negativo` 0 na Biblioteca,
  `hover_sem_focus` −1.

- [ ] **Passo 1: medir o que existe**

```bash
cd ArchSmart-web/src
grep -rn "tabIndex={\s*-\s*1\s*}" components/library/ "app/(dashboard)/library/"
grep -rn "opacity-0\|group-hover" components/library/ "app/(dashboard)/library/"
grep -rnE "\b(bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|shadow|accent|caret|divide|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b" components/library/ "app/(dashboard)/library/"
grep -rnE "\b(bg|text|border)-(white|black)\b" components/library/ "app/(dashboard)/library/"
grep -rn "<img" components/library/ "app/(dashboard)/library/"
```

Em 11/09/2026 isso dava: 2 `tabIndex={-1}`, 1 hover sem foco
(`ProductCard.tsx:121`), 5 cores de paleta, 3 `<img>`.

- [ ] **Passo 2: os dois `tabIndex={-1}`**

São `TooltipTrigger` com `cursor-help` — informação que só existe para quem usa
mouse. Tire o `tabIndex={-1}`: o trigger é um `button`, então ele entra na ordem
de tabulação e o Radix abre o tooltip no foco. Se o conteúdo do tooltip for
essencial, ele precisa estar no texto visível também — registre o achado se for
o caso, e **não** reescreva a copy aqui.

- [ ] **Passo 3: o hover sem foco do `ProductCard`**

```tsx
<div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
```

A ação escondida atrás de hover vira alcançável por teclado. Confirme com a
régua consertada na Tarefa 2:

```bash
python tools/catraca.py   # hover_sem_focus deve cair de 9 para 8
```

- [ ] **Passo 4: as cinco cores literais**

`BatchNormalizeModal` tem `text-amber-600` num aviso, e `ClipperOnboarding` tem
quatro classes de verde num `Badge` de sucesso. Os dois são **semântica de
estado**, não decoração: use os tokens de aviso e de sucesso do tema. Se não
houver token de sucesso/aviso no tema, **pare e registre** — criar token novo é
decisão de design, e um token que nasça com contraste reprovado entra na medida
`contraste_reprovado` e reprova o portão (é assim de propósito).

- [ ] **Passo 5: os três `<img>`**

Troque por `next/image`. Os três mostram imagem de produto vinda de URL externa,
então o domínio precisa estar em `images.remotePatterns` do `next.config.ts` —
**confira antes**, porque `next/image` com domínio não declarado quebra a
imagem em tempo de execução, sem erro de build. Se a lista de domínios for
aberta (imagem vem de qualquer loja clipada), `unoptimized` no componente é a
saída honesta, com comentário dizendo por quê.

- [ ] **Passo 6: axe, teclado e as duas larguras**

Com o dev server de pé e sessão (Tarefa 1):

1. Rodar axe em `/library` nas duas abas (`library` e `inbox`) e na folha de
   produto aberta. Zero violação.
2. Navegar a tela inteira **só por teclado**: chegar a cada card, abrir a folha,
   fechar com `Esc`, chegar à paginação.
3. Olhar em **390px** e **1440px**: a grade é `grid-cols-1` a `xl:grid-cols-5`, e
   a barra de ferramentas é o lugar mais provável de estourar em 390px.

Registre o que viu em `docs/dev/modulos/library.md` (Tarefa 10 escreve o arquivo).

- [ ] **Passo 7: regravar o baseline e commitar**

```bash
python tools/catraca.py
python tools/catraca.py --atualizar
git add ArchSmart-web/src/components/library tools/catraca.json
git commit -m "a11y(biblioteca): teclado, tokens e next/image

- dois TooltipTrigger com tabIndex={-1} voltam para a ordem de tabulacao;
- a acao escondida atras de hover no ProductCard ganha group-focus-within;
- cinco classes de cor literal viram token semantico de aviso e de sucesso;
- tres <img> viram next/image.

Medido com a regua consertada na Tarefa 2, nao com a que tinha furos."
```

---

## Tarefa 10 — Portão de e2e, medição e fechamento

**Arquivos:**
- Modificar: `.github/workflows/ci.yml`
- Criar: `ArchSmart-web/e2e/telemetria-biblioteca.spec.ts`
- Modificar: `docs/dev/modulos/library.md`
- Modificar: `docs/dev/modulos/telemetry.md`
- Modificar: `docs/dev/medicoes/2026-09-06-biblioteca-depois.md`
- Modificar: `PROGRESS.md`, `CLAUDE.md`

**Interfaces:**
- Consome: tudo.
- Produz: os números que fecham a seção.

- [ ] **Passo 1: rodar os dois specs que já existem, contra staging**

```bash
cd ArchSmart-web
set -a; . ./.env.e2e.local; set +a
npx playwright test e2e/medicao-biblioteca.spec.ts e2e/hidratacao-biblioteca.spec.ts --reporter=line
```

Esperado: `hidratacao-biblioteca` verde — a lista continua hidratada e **nenhuma**
requisição da lista sai do navegador. Se ele falhar, a Tarefa 7 quebrou o
prefetch, e é isso que o spec existe para pegar.

Anote a mediana de `medicao-biblioteca` e compare com os **1454 ms** de
10/09/2026 (`AMOSTRAS=1434,1445,1454,1469,1948`). Uma piora grande aqui é
defeito desta seção, não ruído.

> ⚠️ O `hidratacao-biblioteca.spec.ts` discrimina por `state=NORMALIZED`. Com o
> badge do inbox agora prefetchado (Tarefa 7), a requisição de
> `state=CAPTURED` também deve desaparecer do navegador — acrescente essa
> asserção ao spec **no mesmo commit**, senão a Tarefa 7 fica sem guarda.

- [ ] **Passo 2: escrever a prova viva do `screen_viewed`**

`e2e/telemetria-biblioteca.spec.ts`: entrar, navegar para `/library` por **clique
em link** (não por `page.goto`, senão o `medido_de` sai `commit`), e capturar a
requisição `POST /api/telemetry/events`. Asserções:

- sai **um** `screen_viewed` para `/library`;
- `medido_ate` é `"dados"` — não `"pintura"`, que era o que o gatilho antigo
  produzia nesta tela;
- `medido_de` é `"clique"`;
- `principal_declarada` é `true`;
- `load_ms` está na ordem de grandeza da mediana do Passo 1 — a asserção é uma
  faixa generosa (por exemplo, entre 300 e 5000 ms), porque o que se está
  provando é **ordem de grandeza**, não um número exato. O defeito que ela pega
  é o `load_ms: 28` da Seção 7.

- [ ] **Passo 3: confirmar a gravação no banco**

Com a `DATABASE_URL` de **staging** (confira qual bloco do `.env` está ativo):

```bash
cd ArchSmart-api
python -c "from app.db.session import SessionLocal; from sqlalchemy import text; db=SessionLocal(); print(db.execute(text(\"select name, properties->>'screen', properties->>'medido_ate', properties->>'load_ms' from product_events where name='screen_viewed' order by created_at desc limit 5\")).fetchall())"
```

Esperado: linhas com `/library`, `dados`, e um `load_ms` na grandeza do Passo 1.
**Isto é o que fecha a pendência 2 da Seção 7 de verdade** — até aqui ela estava
provada só por vitest.

- [ ] **Passo 4: quarto job no CI**

Em `.github/workflows/ci.yml`, depois do job `frontend`:

```yaml
  e2e:
    name: E2E — Playwright contra staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: npm
          cache-dependency-path: ArchSmart-web/package-lock.json
      - name: Instalar dependencias
        working-directory: ArchSmart-web
        run: npm ci
      - name: Instalar o Chromium do Playwright
        working-directory: ArchSmart-web
        run: npx playwright install --with-deps chromium
      - name: Rodar os specs
        working-directory: ArchSmart-web
        env:
          E2E_EMAIL: ${{ secrets.E2E_EMAIL }}
          E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
        # O cold start do Render ja foi medido em 41,9 s (ADR 0009) e em 41,4 s
        # em 08/09/2026. O timeout tem de cobrir isso, senao o primeiro PR da
        # manha reprova por um motivo que nao e defeito de codigo.
        timeout-minutes: 15
        run: npx playwright test --reporter=line
```

Thiago precisa criar os dois Secrets no repositório (`E2E_EMAIL`,
`E2E_PASSWORD`) — **peça; não tente criar, e não ponha a senha em lugar nenhum
do repositório.** Sem os Secrets, o job falha no login, e falha é falha: não
adicione `continue-on-error`.

- [ ] **Passo 5: a documentação dos módulos**

`docs/dev/modulos/library.md`: o que a tela consome, os cinco estados, quem é a
região principal, o que o prefetch entrega, e **os números medidos** (mediana do
Passo 1, `load_ms` do Passo 3, P95 da API do Passo 6).

`docs/dev/modulos/telemetry.md`: reescrever a parte que hoje diz que `load_ms`
não é dado utilizável. O protocolo novo (anúncio, report, os cinco valores de
`medido_ate`, `medido_de`, `principal_declarada`), o preço assumido (tela sem
região emite ao sair) e a fila de eventos.

- [ ] **Passo 6: o orçamento de API, e a decisão sobre a Tarefa 11**

```bash
# P95 de /api/products contra staging, com o seed de volume.
```

Meça com dado realista (o `seed.py` com os parâmetros que a própria docstring
dele sugere) e registre o número em `docs/dev/modulos/library.md`. **Se passar de
400 ms, abra a Tarefa 11 como tarefa explícita de backend** — não otimize query
dentro desta tarefa. Se ficar abaixo, registre que o orçamento fechou e diga
com qual volume.

- [ ] **Passo 7: `PROGRESS.md` e `CLAUDE.md`**

Marque `- [x] Biblioteca` na Seção 8 e rode:

```bash
python tools/progresso.py --write
python tools/progresso.py --check
python tools/checa_links.py
```

Esperado: **50/64 (78%)**. No `CLAUDE.md`, registre o fechamento da Seção 8 no
estado, com o que ficou aberto — e **risque as quatro pendências da Seção 7**,
cada uma com o que a fechou, que é a forma que este repositório usa para impedir
que uma pendência volte pelo mesmo caminho.

- [ ] **Passo 8: commit e PR**

```bash
git add -A
git commit -m "ci(secao-8): portao de e2e, medicao da Biblioteca e fechamento

O e2e deixa de ser instrumento de uma vez e passa a ser guarda: quarto job
no CI, rodando os specs contra staging. A prova viva do screen_viewed
rodou — um load_ms na ordem de grandeza da mediana medida, gravado em
product_events —, o que fecha a pendencia 2 da Secao 7 de fora, nao por
vitest."
```

---

## Revisão do plano contra a spec

**Cobertura.** As cinco decisões de fronteira da spec têm tarefa: decisão 1 →
Tarefa 1; decisão 2 → Tarefa 3 (e a prova viva na 10); decisão 3 → Tarefas 4 e
5; decisão 4 → Tarefa 6; decisão 5 → Tarefa 2. O portão de e2e → Tarefa 10. Os
nove itens da definição de pronto da Biblioteca → Tarefas 7, 8, 9 e 10. O
orçamento de API e a Tarefa 11 condicional → Passo 6 da Tarefa 10.

**Duas coisas que a spec não previa e que este plano decide**, porque escrever os
passos revelou a ambiguidade:

1. **O prazo não existe.** A spec dizia que `"pintura"` vale para tela sem
   `QueryBoundary`, sem dizer **quando** isso é decidido. Qualquer prazo fixo
   falha: o boundary da Biblioteca só monta depois de a API responder (P95 de
   1.220 ms), então prazo curto rotula a Biblioteca errado e prazo longo atrasa
   toda tela sem região. O plano decide no **fim da navegação**, com o instante
   da pintura capturado antes e usado depois.
2. **`abandonado` é um quinto valor de `medido_ate`.** Região que anuncia e
   nunca resolve não é `pintura` — chamá-la assim seria a mesma classe de
   mentira que esta seção conserta. Ela ganha rótulo próprio, e ele é
   informação útil: é o usuário desistindo antes do dado chegar.

Ambas estão registradas na spec como correção datada de 11/09/2026.
