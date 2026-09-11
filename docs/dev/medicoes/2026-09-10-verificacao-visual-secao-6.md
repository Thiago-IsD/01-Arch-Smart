# Verificação visual do que a Seção 6 mudou — 10/09/2026

Tarefa 1 da Seção 7. Objetivo original do brief: abrir a galeria e as 5 telas
reais e olhar as três mudanças visuais da Seção 6. **Não foi possível abrir
nenhuma das duas** — bloqueio de autenticação, detalhado abaixo. O que segue
é o que deu para verificar sem abrir o navegador contra o app rodando, mais o
registro exato do bloqueio.

## Bloqueio: toda rota exige sessão, inclusive a galeria

`src/proxy.ts` (middleware) chama `supabase.auth.getUser()` e redireciona para
`/auth/login` qualquer rota fora de `ROTAS_PUBLICAS` — e `/dev/componentes`
**não** está nessa lista:

```
curl -s -D - -o /dev/null http://localhost:3000/dev/componentes --max-time 8 | grep -i location
location: /auth/login
```

(servidor local: `cd ArchSmart-web && npm run dev`, confirmado no ar com
`curl http://localhost:3000/` → `200`).

Isso significa que a galeria — pensada para ser vista sem dado de conta real —
está atrás do mesmo login que as telas de produto, porque o middleware decide
por rota pública/privada, não por ambiente. Registro à parte, não é bug desta
tarefa: é um fato novo sobre a superfície da galeria que vale a pena outra
seção (ou a própria Seção 7) considerar, já que o objetivo dela é "existir
para ser olhada" (`CLAUDE.md`, pendência 1 da Seção 6) e hoje isso exige login
mesmo em desenvolvimento.

Sem sessão eu não consigo entrar. As duas credenciais disponíveis foram
descartadas, por motivos diferentes:

- **`ana.arquiteta@seed.arqsmart.local`** (usuário de teste E2E, com dado de
  volume semeado): a senha é **deliberadamente não versionada** — nem em
  `.env`, nem em nenhum arquivo do repositório (`docs/dev/medicoes/2026-09-09-usuario-de-teste-e2e.md`).
  Confere: `grep -rn "seed.arqsmart.local" . --include=*.env* --include=*.md`
  não traz senha nenhuma em lugar nenhum, só o e-mail.
- O navegador (perfil real de Thiago) tinha um login **diferente** salvo por
  autofill do Chrome para `localhost:3000/auth/login` — um e-mail real, não o
  de teste. Não usei: autenticar com essa credencial (a) não é a conta que
  este brief tinha em mente, (b) é conta de identidade desconhecida — pode
  carregar dado real —, e (c) autenticar-se em nome de alguém, mesmo com
  senha autopreenchida pelo próprio navegador, está fora do que posso fazer
  sem uma instrução explícita de Thiago para esta conta específica. Não
  salvei captura dessa tela porque ela expõe esse e-mail em texto.

Resultado: **nenhuma das 6 superfícies (galeria + 5 telas) foi aberta.**
Nenhuma captura de tela foi produzida. Nenhuma altura foi medida no DOM
renderizado do app de verdade.

## O que deu para verificar sem login — por leitura de código e suíte existente

Tudo abaixo é **verificado por máquina**, com o comando colado. Nenhum é
substituto da medição pedida no brief (altura real renderizada, tela aberta,
leitor de tela de verdade) — são evidência de código, não de tela.

### 1. `min-h-11` no `DropdownMenuItem`

A classe mora uma vez só, no componente base, não repetida em cada uso:

```
grep -n "min-h-11" ArchSmart-web/src/components/ui/dropdown-menu.tsx
86:      "relative flex min-h-11 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
```

Contagem exata de `<DropdownMenuItem` (tag de abertura, não a palavra solta)
nos 6 arquivos do brief:

```
FinancialTable.tsx        -> 2
galeria.tsx                -> 2
Header.tsx                  -> 2
ProductCard.tsx            -> 3
EnvironmentCard.tsx        -> 2
theme-toggle.tsx            -> 3
                       total -> 14
```

Bate com os "14 itens em 6 arquivos" do brief. **O que isto NÃO prova:** que a
altura renderizada é ≥ 44px de verdade — `min-h-11` é `min-height: 2.75rem`
(44px a 16px de root) só enquanto nada em volta (flex, padding, conteúdo)
empurra o item para maior ou o comprime; ler a classe não é medir o
`getBoundingClientRect().height` pedido no Passo 3 do brief. Isso continua
**dependendo de olho humano** (ou, no mínimo, de uma sessão autenticada
rodando o Passo 3 no console).

Existe um teste automatizado (`npm test`) que cobre o nível de classe, não de
pixel:

```
src/__tests__/componentes-ui.test.tsx:265
"DropdownMenuItem tem alvo de toque de no minimo 44px"
  → expect(screen.getByRole("menuitem")).toHaveClass("min-h-11")
```

Rodei a suíte inteira: `npm test` → `Test Files 19 passed (19)`,
`Tests 151 passed (151)` (10/09/2026). Este teste passa, mas ele roda em
jsdom — jsdom não tem motor de layout real, então `toHaveClass` confirma que a
classe está no elemento, não que o navegador a resolve em 44px de verdade.
**Rotulo: verificado por máquina (presença da classe), não verificado
(altura renderizada) — depende de olho humano/sessão autenticada.**

### 2. `Skeleton` com `aria-hidden="true"`

Lido direto do componente, não condicional a prop nenhuma:

```
cat ArchSmart-web/src/components/ui/skeleton.tsx
...
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
```

`aria-hidden="true"` está hardcoded no componente base — todo uso herda,
não é algo que cada tela precise lembrar de passar. Teste automatizado
cobrindo isso:

```
src/__tests__/componentes-ui.test.tsx:278
"Skeleton nao e lido por leitor de tela"
  → expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
```

Passou na mesma rodada de `npm test` acima. **Rótulo: verificado por
máquina** — leitura de código confirma o atributo no componente-fonte, e o
teste confirma no DOM renderizado (mesmo que em jsdom, `aria-hidden` é
atributo estático, não depende de motor de layout — jsdom resolve isso
corretamente). Isto fecha a pergunta "o leitor de tela vai ignorar o
esqueleto?" no nível de atributo. O que não foi visto: o esqueleto de
verdade, na tela de verdade, com um leitor de tela de verdade rodando —
isso **depende de olho humano** (ou ouvido humano).

### 3. Botão de fechar do toast destrutivo

```
grep -n "text-red\|bg-red\|border-red\|#[0-9a-fA-F]\{3,6\}" ArchSmart-web/src/components/ui/toast.tsx
(sem saída — exit code 1, zero ocorrências)
```

`ToastClose` (`src/components/ui/toast.tsx:73-88`) usa só tokens:

```
group-[.destructive]:text-destructive-foreground/70
group-[.destructive]:hover:text-destructive-foreground
group-[.destructive]:focus:ring-destructive-foreground
group-[.destructive]:focus:ring-offset-destructive
```

Nenhum `text-red-*` nem hex. **Rótulo: verificado por máquina** que a classe
não é mais cor literal (grep). **Não verificado**: se o X fica de fato legível
— contraste e legibilidade visual **dependem de olho humano** (a catraca já
registra `contraste_reprovado` nascendo em 4 pares, incluindo `destructive`
no tema claro — `CLAUDE.md`, notas da Seção 6 — então há razão concreta para
não presumir "legível" só porque a classe é token).

## O que ficou sem verificar (depende de olho humano ou de sessão)

- Altura real renderizada dos 14 itens de `DropdownMenuItem`, nos dois temas
  e nas duas larguras (390px/1440px) — Passo 3 do brief.
- Toast destrutivo disparado de verdade, com o X visto sobre o fundo
  destrutivo — Passo 4.
- `Skeleton` inspecionado no DOM de uma tela real carregando — Passo 4.
- As 5 telas reais (cabeçalho, card de produto, tabela financeira, card de
  ambiente, alternador de tema) com o menu aberto, nos dois temas — Passo 5.
- Nenhuma captura de tela foi produzida (nenhuma superfície do brief foi
  aberta).

## Conclusão

**Não fechei a pendência.** O que a Seção 6 deixou em aberto (`CLAUDE.md`,
"O que a Seção 6 deixou em aberto", item 1) continua aberto: ninguém olhou
as três mudanças visuais na tela de verdade. O que existe agora a mais do que
antes desta tarefa: confirmação por grep/teste de que o código-fonte tem as
três mudanças (classe, atributo, token), e o registro exato de por que a
verificação visual não rodou — para quem pegar isso depois não repetir a
mesma tentativa sem primeiro resolver o acesso.

**Para desbloquear:** ou Thiago passa a senha do usuário de teste E2E (fora
do controle de versão, combinado) por um canal fora deste repositório, ou
autoriza explicitamente o uso de uma conta específica para esta verificação.
