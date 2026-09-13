# O custo de uma requisição autenticada — medido em 13/09/2026

> **Isto é a descrição da tarefa que precede a migração da próxima tela**, e a
> evidência que a justifica. Ela **não** foi executada: foi descrita, por decisão
> de Thiago em 13/09/2026, para começar antes do Dashboard.
>
> Leia até o fim antes de escolher o trabalho. **A primeira hipótese estava
> errada**, e a seção "O que eu afirmei e a medição desmentiu" diz em quê.

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

## A tarefa

**Primeiro medir onde vão os ~1,5 s, depois consertar.** Escolher o conserto
antes da medição é repetir o erro acima, com mais confiança.

O que a medição precisa separar, porque cada um tem conserto diferente:

- **quantas idas ao banco** uma requisição autenticada faz antes de chegar ao
  endpoint. O resolvedor de identidade busca usuário, conta e entitlements; se
  forem consultas sequenciais contra o pooler em `sa-east-1`, cada ida custa
  latência de rede, e o total é multiplicação, não soma;
- **quanto custa a ida remota do JWT** dentro do total (já medido isolado: ~0,28 s);
- **quanto é do Render free tier** — instância pequena, e o
  [ADR 0009](../decisoes/0009-prefetch-dentro-de-suspense.md) já registra cold
  start de 41,9 s. O contêiner foi aquecido antes destas medições, mas "aquecido"
  não é "rápido";
- **quanto é do desvio 307.** `/api/products` sem barra final responde 307 para
  `/api/products/`, e o navegador paga as duas idas. Não é o grosso, mas é
  gratuito de consertar e está em rota que toda tela usa.

Só depois disso escolher entre: verificação local do JWT por JWKS (recupera os
~0,28 s e tira a dependência do Supabase do caminho quente), reduzir as idas ao
banco na montagem do contexto, cache de contexto por requisição, ou instância
maior.

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

## Como saber que fechou

O orçamento da spec: **P95 de API < 400 ms**. Meça com o mesmo comando desta
página, contra a API **implantada**, com volume declarado. E registre o número
com o comando ao lado, como todo número deste repositório.
