# O custo de uma requisição autenticada — medido em 13/09/2026

> **Medida, consertada em quatro pontos, e medida de novo depois do deploy.**
> A tarefa foi descrita em 13/09/2026, por decisão de Thiago, para preceder o
> Dashboard, e executada no mesmo dia: os números do diagnóstico estão em "Onde
> vão os ~1,5 s". Thiago escolheu "as baratas primeiro, a distância depois"; o
> que entrou está em "O que foi consertado", e o efeito **medido contra a API
> implantada em 14/09/2026** está logo abaixo daquilo: a chamada da Biblioteca
> caiu **48%**, de 2,29 s para **1,175 s**.
>
> **O que continua aberto é a distância até o banco.** O P95 da rota é
> **1613 ms** contra um orçamento de **400 ms** — quatro vezes acima —, e as
> 6 idas ao banco que sobraram custam 0,17 s cada porque a API e o banco estão
> longe um do outro. Nenhuma correção de código alcança isso; as três saídas
> estão em "As saídas", e a escolha é de Thiago.
>
> Leia até o fim antes de escolher o trabalho. **A primeira hipótese estava
> errada** — a seção "O que eu afirmei e a medição desmentiu" diz em quê — e a
> segunda estava incompleta: a medição encontrou uma causa maior que o JWT, e
> "O que esta medição corrige" diz qual.

## Por que esta tarefa existe

A Seção 8 mediu o P95 de `/api/products` em **634 ms** contra um orçamento de
**400 ms** ([medição de 12/09](2026-09-06-biblioteca-depois.md)). A spec decidiu,
antes de saber o número, que estourar o orçamento **abre tarefa de backend
própria** em vez de virar otimização de passagem — e é esta.

O que a Seção 8 concluiu na hora: "o Supabase de staging assina em ES256, a API
valida em HS256, então toda requisição autenticada paga uma ida remota; a tarefa
é verificação por JWKS". **A parte do diagnóstico está certa. A conclusão sobre
o tamanho do problema não estava.**

## O que foi medido

Contra a API **implantada** em `https://arqsmart-staging.onrender.com`, em
13/09/2026, com token real do usuário de teste. Cada linha é a mediana de 3 a 6
chamadas, depois de aquecer o contêiner:

| Chamada | Status | Tempo |
|---|---|---|
| `/health` — sem autenticação | 200 | **0,27 s** |
| `/api/users/me` — token **inválido** | 401 | **0,55 s** |
| `/api/users/me` — token **válido** | 200 | **2,1–2,4 s** |
| `/api/projects?page=1&size=1` — token válido | 200 | **2,3–2,4 s** |
| `/api/products?page=1&size=1` — token válido | 307 → 200 | **2,4 s** |

Reproduz com:

```bash
cd ArchSmart-web
set -a; . ./.env.e2e.local; . ./.env.local; set +a
TOKEN=$(python -c "
import json,os,urllib.request
url=os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')+'/auth/v1/token?grant_type=password'
c=json.dumps({'email':os.environ['E2E_EMAIL'],'password':os.environ['E2E_PASSWORD']}).encode()
r=urllib.request.Request(url,data=c,method='POST',headers={'apikey':os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],'Content-Type':'application/json'})
print(json.load(urllib.request.urlopen(r,timeout=45))['access_token'])")
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://arqsmart-staging.onrender.com/health
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" -H "Authorization: Bearer nao.e.jwt" https://arqsmart-staging.onrender.com/api/users/me
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" -H "Authorization: Bearer $TOKEN"  https://arqsmart-staging.onrender.com/api/users/me
```

### Três leituras, nesta ordem

**1. A validação remota do JWT existe e custa ~0,28 s.** É a diferença entre o
token inválido (0,55 s) e a rota sem autenticação (0,27 s): esse caminho não
toca o banco, não monta contexto, e só faz a ida ao Supabase que volta
"inválido". O diagnóstico da Seção 8 está confirmado — e o algoritmo também:

> Este 0,28 s veio de 3 a 6 amostras. A medição da tarde do mesmo dia repetiu a
> conta com **9 amostras de cada lado** e fechou em **0,240 s** (0,527 − 0,287).
> É o mesmo fenômeno com amostra maior; use **0,240 s**, que é o número que a
> seção "Cada parcela, isolada" sustenta.

```bash
# o cabeçalho do JWT que staging emite
# -> {"alg": "ES256", "kid": "...", "typ": "JWT"}
```

contra `ArchSmart-api/app/core/security.py:81`, que aceita **só** `HS256`, e
`app/core/config.py:21-22`, que documenta a queda para o caminho remoto quando o
segredo não serve.

**2. Mas ~0,28 s não é o problema.** Uma requisição autenticada custa **~2,3 s**.
Consertar só o JWT recupera **um oitavo** disso, e continua a **cinco vezes** do
orçamento de 400 ms.

**3. O custo está no caminho compartilhado, não no trabalho de cada rota.**
`/api/users/me` (identidade e entitlements) e `/api/projects` (lista paginada)
fazem trabalhos diferentes e custam **o mesmo**. Some-se a isso que a própria
Seção 8 mediu o SQL de produtos em **17 ms**: o que consome os ~1,5 s restantes
**não é a query, não é o endpoint, e não é o JWT**. É o que roda entre receber a
requisição e entregar o contexto — e **ninguém mediu onde**.

## O que eu afirmei e a medição desmentiu

Em 12/09/2026 eu recomendei a Thiago, por escrito, que a tarefa fosse
"verificação por JWKS" e que o defeito fosse "um imposto de ~420 ms por
requisição autenticada". **A medição de 13/09 mostra que o imposto é ~0,28 s e
que ele é a menor parte de um custo de ~2,3 s.** Quem executasse aquela
recomendação teria feito o conserto certo do problema errado, medido depois, e
encontrado a rota ainda a cinco vezes do orçamento.

O erro tem nome e é o mesmo que este repositório persegue: **atribuir uma causa
sem isolá-la**. A diferença entre `/health` e uma rota autenticada estava
medida; a atribuição dessa diferença ao JWT era inferência. Bastou um token
inválido para separar as duas.

## Onde vão os ~1,5 s — medido em 13/09/2026

### O método: fazer o número de consultas variar

Medir por dentro exigiria instrumentar e implantar. Não foi preciso, porque a
própria API oferece uma alavanca: **`GET /api/projects` tem N+1** — carrega
`environments` e `clients` por projeto —, então o número de consultas muda com
o tamanho da página sem mudar mais nada. Com o número de consultas conhecido
para cada rota, o tempo medido de fora vira um sistema de equações.

Duas condições precisam valer para a contagem feita aqui descrever o que a API
implantada executa, e as duas foram verificadas antes:

```bash
git log --oneline origin/staging..HEAD -- ArchSmart-api   # vazio: e o mesmo codigo
```

e a contagem roda contra o **banco de staging**, que é o mesmo que a API
implantada usa (bloco ativo do `ArchSmart-api/.env`).

A contagem, com `before_cursor_execute` ligado no engine (script em "Como
reproduzir"):

| Rota | Consultas | Quais |
|---|---:|---|
| caminho compartilhado, antes de qualquer endpoint | **2** | `users` (resolvedor de identidade) + `subscriptions⋈plans` (entitlements) |
| `/health/db` | 1 | `SELECT 1` |
| `/api/products/?size=1` | 6 | as 2 + contagem + página + `product_states` + `product_origins` |
| `/api/products/?size=15` — **a chamada que a Biblioteca faz** | 8 | as 2 + contagem + página + `product_states` + `product_origins` ×3 |
| `/api/projects?size=1` | 6 | as 2 + contagem + página + `environments` + `clients` |
| `/api/projects?size=20` | **12** | as 2 + contagem + página + `environments` ×5 + `clients` ×3 — **N+1** |
| `/api/users/me` | 6 | repete `users` e os entitlements que o caminho compartilhado já tinha buscado |

### O tempo, medido de fora contra a API implantada

Medianas de 7 amostras, descartada a rodada de aquecimento, com o contêiner
quente — a primeira chamada do dia custou **41,8 s** de cold start ([ADR
0009](../decisoes/0009-prefetch-dentro-de-suspense.md)):

| Rota | Consultas | Mediana | Faixa |
|---|---:|---:|---|
| `/health` | 0 | **0,294 s** | 0,269 – 0,682 |
| `/health/db` | 1 | **0,990 s** | 0,968 – 1,426 |
| `/api/products/?size=1` | 6 | **2,013 s** | 1,931 – 2,598 |
| `/api/products/?size=15` (a da tela) | 8 | **2,29 s** | 2,280 – 2,900 |
| `/api/products/?size=20` | 8 | **2,319 s** | 2,280 – 4,842 |
| `/api/projects?size=20` | 12 | **3,037 s** | 3,011 – 3,563 |
| `/api/users/me` com token **inválido** | 0 | **0,527 s** | 0,473 – 0,965 (n=9) |

### O modelo que sai desses números

Mínimos quadrados sobre os três pontos autenticados (6, 8 e 12 consultas) dá
**0,172 s por consulta** e um custo fixo de 0,966 s. As duas rotas sem
autenticação caem na mesma reta se o custo fixo incluir **três idas de
protocolo** além das consultas:

```
tempo ≈ 0,29 s  (rede ate o Render + app)
      + 0,24 s  (so se autenticado: a validacao remota do JWT)
      + 0,17 s × (3 + numero de consultas)
      + 0,29 s  (so se a chamada vier sem a barra final: o 307)
```

| Rota | Previsto | Medido | Resíduo |
|---|---:|---:|---:|
| `/health/db` | 0,98 s | 0,99 s | +0,01 |
| `/api/products/?size=1` | 2,09 s | 2,01 s | −0,08 |
| `/api/products/?size=15` | 2,42 s | 2,29 s | −0,13 |
| `/api/projects?size=20` | 3,10 s | 3,04 s | −0,06 |

O resíduo é negativo e cresce com o número de consultas: a consulta marginal
custa um pouco **menos** que 0,17 s, e o modelo superestima na casa de 5%. Ele
não é teoria — é o ajuste de três séries independentes, e cada parcela dele foi
medida **separada** abaixo.

### Cada parcela, isolada

**1. Uma ida ao banco custa 0,17 s a partir do contêiner — e 0,016 s deste
notebook.** O coeficiente sai de dois segmentos independentes:
(2,319−2,013)/2 = 0,153 e (3,037−2,319)/4 = 0,180. O mesmo pooler, consultado
direto daqui, responde um `SELECT 1` em **15,6 ms** (mediana de 10). A API está
cerca de **onze vezes mais longe do banco** do que um notebook no Brasil está.

**2. São três idas de protocolo por requisição, além das consultas.** Um ciclo
de sessão com o pool **já quente** — abrir `SessionLocal`, um `SELECT 1`,
fechar — custa **64,7 ms** aqui, contra os 15,6 ms do round trip cru: **4,1
idas para uma consulta só**. O log com `sqlalchemy.pool` em DEBUG nomeia as
outras três:

```
Pool pre-ping on connection ...   <- pool_pre_ping=True, 1 ida
BEGIN (implicit)                  <- 1 ida
SELECT 1                          <- a consulta
ROLLBACK                          <- db.close(), 1 ida
```

A 0,17 s cada, isso é **~0,52 s por requisição que não é consulta nenhuma** — e
bate com o custo fixo que o ajuste externo encontrou (0,966 − 0,29 − 0,24 =
0,44 s, mesma ordem). Abrir a conexão física, quando é preciso, custa **412 ms**
daqui.

**3. A validação remota do JWT custa 0,240 s.** É a diferença entre
`/api/users/me` com token inválido (0,527 s) e `/health` (0,287 s), medianas de
9 amostras cada. Esse caminho não toca o banco: o `get_db` só abre conexão na
primeira consulta, e ela não acontece. O diagnóstico da Seção 8 continua certo
— staging assina em ES256 e `app/core/security.py:81` aceita só HS256 — e agora
tem tamanho: **12% do custo da chamada da Biblioteca**.

**4. O desvio 307 custa 0,29 s, e a Biblioteca o paga duas vezes.** O `307`
sozinho mede 0,285 s, igual ao `/health`, porque não toca banco nem token.
`LibraryData.tsx:36` e `:46` chamam `/api/products` **sem** a barra final, então
a lista e o badge pagam um ida-e-volta cada antes de a requisição de verdade
começar.

**5. Não é a CPU do free tier.** Oito requisições de 12 consultas em paralelo —
96 idas ao banco — terminaram em **4,11 s de parede**, cada uma levando ~3,8 s
contra 3,4 s sozinha. Se o custo fosse CPU serializada seriam ~24 s. **O tempo é
espera, não cálculo.**

### O que esta medição corrige

- **"Isso mede a ida e volta Brasil → Render free tier mais a CPU do free
  tier"** — a nota de 12/09 em
  [`2026-09-06-biblioteca-depois.md`](2026-09-06-biblioteca-depois.md) sobre os
  2762 ms medidos contra staging. A ida e volta até o Render mede **0,29 s**, e a
  CPU não é o gargalo (leitura 5). O que sobra é o trecho **Render → banco**, que
  ninguém tinha medido.
- **"O imposto do JWT é ~420 ms"**, que eu escrevi em 12/09: são **240 ms**.
- **Os dois números da Seção 8 estão certos, e medem ambientes diferentes.** O
  P95 de 634 ms foi medido contra a API **local**, onde uma ida ao banco custa
  16 ms e o JWT remoto domina — foi por isso que a conclusão de lá apontou para
  JWKS. Na API **implantada**, o mesmo endpoint custa 2,29 s e quem domina é a
  distância até o banco. As duas leituras são verdadeiras; a implantada é a que o
  usuário sente.

### As saídas, e o que cada uma tem para dar

Estimativas **derivadas do modelo acima**, não medições — a medição vem depois
do conserto. Referência: a chamada que a Biblioteca faz, **2,29 s**, com 8
consultas e 11 idas ao banco.

| Saída | Ganho estimado | O que custa |
|---|---:|---|
| Barra final na chamada do front (mata o 307) | **−0,29 s** ×2 chamadas | uma linha em `LibraryData.tsx`; sem risco |
| Validar ES256 localmente por JWKS | **−0,24 s** | tarefa de backend; tira o Supabase do caminho quente |
| Unir as 2 consultas do caminho compartilhado em 1 | −0,17 s | um join em `get_context` |
| `joinedload` em `product_states`/`product_origins` | −0,5 s | some com 3 das 8 consultas da lista |
| Matar o N+1 de `/api/projects` | −1,0 s naquela rota | 12 consultas → 4 |
| Desligar `pool_pre_ping` | −0,17 s | troca latência por risco de servir conexão morta |
| **Encurtar a distância até o banco** | **−1,8 s** | ver abaixo — é a única que sozinha cabe no orçamento |

Somando **tudo menos a última**, a chamada cairia para ~1,2 s: ainda **três
vezes** o orçamento de 400 ms. A distância é o multiplicador; o resto é adição.

**E a distância tem uma restrição que muda as opções:** o Render **não tem
região na América do Sul** — Oregon, Ohio, Virgínia, Frankfurt e Singapura — e
**não permite trocar a região de um serviço existente**; a saída dele é recriar
o serviço em outra região ([render.com/docs/regions](https://render.com/docs/regions),
lido em 13/09/2026). O banco está em `aws-0-sa-east-1` e os usuários também
estão no Brasil. As três formas de encurtar a distância não são equivalentes:

1. **Mover a API para um host com São Paulo** (Fly.io `gru`, Cloud Run
   `southamerica-east1`, AWS `sa-east-1`): fica perto do banco **e** dos
   usuários. É a única que melhora as duas pontas.
2. **Mover o banco para a região da API**: aproxima os dois, mas afasta o Auth do
   Supabase dos usuários, e trocar de projeto Supabase é recriar Auth e dados —
   barato em staging, caro em produção.
3. **Recriar o serviço Render na Virgínia**: mais perto que Oregon, sem trocar de
   fornecedor; ganho parcial e não medido.

**Nenhuma das três é decisão de quem executa**: é troca de fornecedor ou de
topologia, e é de Thiago.

> **Um fato que falta, e que só o painel do Render tem:** em que região o
> serviço de staging está. Nada aqui depende dele — a distância foi medida, não
> deduzida —, mas ele diz qual das três saídas é a mais curta. `docs/dev/`
> registra a região do banco e do frontend, e **não** a do Render.

### Como reproduzir

```bash
# 1. token do usuario de teste
cd ArchSmart-web
set -a; . ./.env.e2e.local; . ./.env.local; set +a
TOKEN=$(python -c "
import json,os,urllib.request
url=os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')+'/auth/v1/token?grant_type=password'
c=json.dumps({'email':os.environ['E2E_EMAIL'],'password':os.environ['E2E_PASSWORD']}).encode()
r=urllib.request.Request(url,data=c,method='POST',headers={'apikey':os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],'Content-Type':'application/json'})
print(json.load(urllib.request.urlopen(r,timeout=45))['access_token'])")

# 2. a serie de tempos. A PRIMEIRA chamada do dia paga ~42 s de cold start:
#    descarte a rodada de aquecimento antes de tirar mediana.
API=https://arqsmart-staging.onrender.com; H="Authorization: Bearer $TOKEN"
for n in $(seq 8); do
  for u in "$API/health" "$API/health/db" "$API/api/products/?page=1&size=1" \
           "$API/api/products/?page=1&size=20" "$API/api/projects?page=1&size=20"; do
    curl -s -o /dev/null -w "$u %{time_total}\n" --max-time 120 -H "$H" "$u"
  done
done

# 3. a ida remota do JWT, isolada por um token invalido (nao toca o banco)
curl -s -o /dev/null -w "%{http_code} %{time_total}\n" \
  -H "Authorization: Bearer nao.e.jwt" "$API/api/users/me"

# 4. o custo do 307: sem barra final contra com barra final
curl -s -o /dev/null -w "%{http_code} %{time_total}\n" -H "$H" "$API/api/products?page=1&size=20"
curl -s -o /dev/null -w "%{http_code} %{time_total}\n" -H "$H" "$API/api/products/?page=1&size=20"

# 5. nao e CPU: oito pesadas em paralelo (~4 s de parede, nao ~24 s)
for i in $(seq 8); do curl -s -o /dev/null -w "p$i=%{time_total}\n" -H "$H" \
  "$API/api/projects?page=1&size=20" & done; wait

# 6. o round trip cru ate o mesmo pooler, deste notebook: mediana 15,6 ms
cd ../ArchSmart-api && ./venv/Scripts/python.exe -c "
import os,time,statistics,psycopg2
from dotenv import load_dotenv; load_dotenv('.env')
c=psycopg2.connect(os.environ['DATABASE_URL']); cur=c.cursor()
a=[]
for _ in range(10):
    t=time.perf_counter(); cur.execute('SELECT 1'); cur.fetchone(); a.append((time.perf_counter()-t)*1000)
print('SELECT 1 mediana', round(statistics.median(a),1), 'ms')"
```

A contagem de consultas por rota, contra o banco de staging (só leitura), com o
`venv` da API e o `TOKEN` acima no ambiente:

```python
# rode de ArchSmart-api
import time
from sqlalchemy import event
from app.db.session import engine
from app.main import app
from fastapi.testclient import TestClient

q = []
event.listen(engine, "before_cursor_execute",
             lambda c, cur, s, p, ctx, m: c.info.__setitem__("_t0", time.perf_counter()))
event.listen(engine, "after_cursor_execute",
             lambda c, cur, s, p, ctx, m: q.append(((time.perf_counter() - c.info["_t0"]) * 1000, s)))

r = TestClient(app).get("/api/products/?page=1&size=15",
                        headers={"Authorization": f"Bearer {TOKEN}"})
print(r.status_code, "consultas:", len(q), "soma_sql:", round(sum(ms for ms, _ in q)), "ms")
```

As três idas de protocolo aparecem com os dois loggers do SQLAlchemy em DEBUG —
`sqlalchemy.pool` imprime o pre-ping, `sqlalchemy.engine` imprime `BEGIN` e
`ROLLBACK` — num ciclo de sessão feito **depois** de o pool já estar quente.

## A tarefa — o que sobrou dela

**Primeiro medir onde vão os ~1,5 s, depois consertar.** A primeira metade está
feita, e as quatro perguntas que ela tinha que separar têm resposta medida:

- ~~**quantas idas ao banco**~~ → **duas antes do endpoint** (usuário e
  entitlements), **oito** na chamada que a Biblioteca faz, e **mais três de
  protocolo** por requisição (pre-ping, `BEGIN`, `ROLLBACK`). E era
  multiplicação mesmo: **0,17 s cada**, contra 0,016 s deste notebook para o
  mesmo pooler.
- ~~**quanto custa a ida remota do JWT**~~ → **0,240 s**, 12% do total da
  chamada da Biblioteca.
- ~~**quanto é do Render free tier**~~ → a ida e volta até ele mede **0,29 s**, e
  a **CPU não é o gargalo**: oito requisições de 12 consultas em paralelo
  terminam em **4,11 s** de parede, não nos ~24 s que a CPU serializada exigiria.
- ~~**quanto é do desvio 307**~~ → **0,29 s**, e a Biblioteca o paga **duas
  vezes** (`LibraryData.tsx:36` e `:46`).

**O que sobrou é a escolha do conserto.** As opções, com o ganho estimado de
cada uma, estão em "As saídas, e o que cada uma tem para dar" — e a conta que
decide é esta: **somadas, todas as correções de código deixam a chamada em
~1,2 s**, ainda três vezes o orçamento; **só encurtar a distância até o banco
cabe nos 400 ms**, e isso é troca de topologia ou de fornecedor, porque o Render
não tem região na América do Sul. **É decisão de Thiago, não de quem executa.**

## O que foi consertado em 13/09/2026, e o que ainda não foi medido

Thiago escolheu "as baratas primeiro, a distância depois". Quatro correções
entraram na branch `custo-da-requisicao-autenticada`, cada uma com o teste que
reprova a volta do defeito:

| Correção | Commit | O que mudou, medido |
|---|---|---|
| Barra final nas duas rotas que a exigem | `7ed0ac5` | 6 chamadas do front deixaram de pagar um `307` de 0,29 s; a Biblioteca pagava **dois** |
| `joinedload` em `state` e `origin` da lista | `5fb707e` | a chamada da Biblioteca foi de **8 para 4** consultas |
| Usuário e entitlements numa consulta só | `302c19c` | o caminho compartilhado foi de **2 para 1**; a chamada da Biblioteca, de 4 para **3** |
| Validação local do ES256 por JWKS | `7daf7ae` | a ida remota a `/auth/v1/user` **sumiu** do caminho quente |

**As contagens são medidas, contra o banco de staging**, com o mesmo contador de
"Como reproduzir". A chamada que a Biblioteca faz saiu de **8 consultas** para
**3** — `users`, a contagem, e a página.

A ida remota do JWT sumiu de verdade, e isso é observável no log: a linha
`Validacao local do JWT falhou (The specified alg value is not allowed);
tentando remota` e o `GET .../auth/v1/user` que vinha atrás dela **não aparecem
mais**. No lugar delas, um `GET .../auth/v1/.well-known/jwks.json` **uma vez por
processo**. O preço assumido: a primeira requisição autenticada de cada processo
paga essa busca; as seguintes, nenhuma.

### O que isso devia dar na API implantada — a previsão que foi escrita antes

Pelo modelo desta página, a chamada que a Biblioteca faz sairia de **2,55 s** (o
`307` mais a requisição) para:

```
0,29  rede ate o Render + app
0,00  JWT remoto (era 0,24)
1,02  0,17 × (3 de protocolo + 3 consultas)
----
1,31 s
```

Ela fica registrada porque foi escrita **antes** do deploy, e porque a medição
que veio depois a julga: deu **1,175 s** — a previsão era pessimista em 11%.

### Medido contra a API implantada, em 14/09/2026 — depois do deploy

O PR #10 (`develop` → `staging`, merge `057085a`) subiu os quatro consertos. A
primeira chamada depois do deploy custou **6,4 s** (contêiner subindo); a
seguinte, **1,18 s**. Medianas de 7 amostras, descartada a rodada de
aquecimento, com o contêiner quente:

| Rota | Consultas antes → depois | Antes | Depois | |
|---|---|---:|---:|---|
| `/health` | 0 | 0,294 s | 0,323 s | controle |
| `/health/db` | 1 → 1 | 0,990 s | **0,990 s** | controle |
| `/api/users/me`, token **inválido** | 0 → 0 | 0,527 s | **0,524 s** | controle |
| `/api/products/?size=1` | 6 → 3 | 2,013 s | **1,170 s** | |
| `/api/products/?size=15` — a da tela | 8 → 3 | 2,29 s | **1,175 s** | P50, n=40 |
| `/api/products/?size=20` | 8 → 3 | 2,319 s | **1,177 s** | |
| `/api/projects?size=20` | 12 → 11 | 3,037 s | **2,575 s** | |

**Os três controles são o que separa "o código melhorou" de "a rede estava
boa hoje".** `/health/db` não passa por autenticação e continua fazendo uma
consulta: mediu **0,990 s** nos dois dias, o mesmo número. O token inválido não
consegue ser validado localmente e continua pagando a ida remota: **0,527 →
0,524 s**. Nada no ambiente mudou; o que mudou foi o que a requisição faz.

E o ajuste concorda: refazendo os mínimos quadrados com as contagens novas
(3 e 11 consultas), a **inclinação continua 0,175 s por consulta** — era 0,172 —
e o **custo fixo caiu de 0,966 s para 0,652 s**. A queda de 0,314 s é a ida
remota do JWT (0,240 s) somada ao ruído do dia. A distância não mudou, e não
tinha como mudar: nenhum dos quatro consertos a toca.

**A chamada que a Biblioteca faz caiu 48%**: 2,29 s → 1,175 s. A previsão do
modelo era 1,31 s — pessimista em 11%.

### O orçamento, e por que ele continua estourado

**Volume declarado**: 300 produtos na conta do usuário de teste, 90
`NORMALIZED` — o mesmo volume da medição da Seção 8, para os números serem
comparáveis. 40 amostras, após 5 de aquecimento.

```
P50 = 1175 ms      P95 = 1613 ms      orcamento = 400 ms
```

**P95 quatro vezes acima do orçamento.** Era ~5,7× antes (2,29 s de mediana).
Cada uma das 6 idas ao banco que sobraram custa 0,17 s porque a API e o banco
estão longe um do outro — e essa é a parte que código não conserta.

### A tela, no mesmo arranjo da Seção 8

```
AMOSTRAS=958,980,992,1003,1174
MEDIANA_MS=992
```

Contra **1415 ms** medidos em 12/09/2026 — **−423 ms**, mesma máquina, mesmo
comando, mesmo banco. O ganho aqui é menor que o da API implantada porque este
arranjo roda a **API local**, onde uma ida ao banco custa 16 ms em vez de
170 ms: localmente quase todo o ganho é a ida remota do JWT que sumiu.

> **Duas armadilhas que custaram duas execuções, para quem for repetir isto.**
> `medicao-biblioteca.spec.ts` sobe o `npm run dev`, e o front lê
> `NEXT_PUBLIC_API_URL` de `.env.local`, que aponta para **`http://localhost:8000`**
> — sem a API local de pé, o login falha com `ERR_CONNECTION_REFUSED` e o spec
> morre em `waitForURL` sem dizer por quê. É por isso que este número **não** é
> comparável ao da API implantada: os 1415 ms da Seção 8 foram medidos com API
> local, e este também. E o `timeout` local do `playwright.config.ts` é de 30 s
> (120 s só no CI), o que não cobre a primeira compilação das rotas pelo dev
> server — rode com `--timeout=180000` ou aqueça as rotas antes.


### O que ficou de fora, de propósito

- **O N+1 de `/api/projects`** (12 consultas numa página de 5 projetos:
  `environments` e `clients` por linha). Não estava na escolha de Thiago, e é a
  próxima economia óbvia de código — vale ~1,0 s naquela rota. Quem migrar a
  tela de Projetos encontra isso pela frente.
- **`pool_pre_ping`**, que vale 0,17 s por requisição. Desligá-lo troca latência
  por risco de servir conexão morta, e a decisão não é de quem executa.
- **As três idas de protocolo** (pre-ping, `BEGIN`, `ROLLBACK`) continuam as
  três.

### O que não fazer

- **Não otimize query.** O SQL de produtos custa 17 ms; o orçamento é 400 ms.
  Índice aqui é trabalho no lugar errado.
- **Não meça só localmente.** A API local e a implantada dão números diferentes
  (a Seção 8 mediu P95 de 694 ms para `/api/users/me` **local**; a implantada dá
  ~2,3 s). As duas medições são verdadeiras e medem coisas diferentes — e é a
  implantada que o usuário sente.
- **Não migre tela nenhuma antes de decidir isto.** Cada uma das oito telas
  restantes vai medir o mesmo custo compartilhado e parecer lenta por conta
  própria, e você terá oito medições contaminadas pela mesma causa sem nenhuma
  delas apontando para ela.

  > ✅ **Decidido em 14/09/2026, por escrito: carregada adiante.** Thiago
  > decidiu não bloquear a próxima tela nesta decisão — ver decisão 1 de
  > [`docs/superpowers/specs/2026-09-14-secao-8-dashboard-design.md`](../../superpowers/specs/2026-09-14-secao-8-dashboard-design.md).
  > O Dashboard migrou em 14/09/2026 sem o conserto do caminho compartilhado, e
  > registra o orçamento de API como **"não atingido, por distância, não pela
  > tela"** em vez de marcado como atingido. O aviso acima continua valendo
  > para a leitura do número: as oito telas restantes vão medir o mesmo custo
  > compartilhado, e cada uma precisa repetir esse rótulo em vez de reivindicar
  > o orçamento como cumprido.

## Como saber que fechou

O orçamento da spec: **P95 de API < 400 ms**. Meça com o mesmo comando desta
página, contra a API **implantada**, com volume declarado. E registre o número
com o comando ao lado, como todo número deste repositório.
