# extension — regras do Web Clipper

Extensão de navegador: `manifest.json`, `content.js`, `popup.js`, `popup.html`, `popup.css` — 281 linhas de código funcional (`content.js` + `popup.js` + `popup.html`). Captura o produto exibido na página de uma loja e envia para a biblioteca da conta autenticada no Arq Smart. Leia `../CLAUDE.md` para o estado geral da reestruturação.

## Arquivos

`content.js` só lê a página (título, `og:image`/`twitter:image`, maior imagem visível) e devolve os dados — é injetado sob demanda quando o usuário clica no popup, nunca roda sozinho. `popup.js` monta a UI, chama `content.js` e envia o produto para a API.

## As 4 diretrizes do parecer jurídico (Art. 11)

Não são recomendações — são condição de legalidade da feature. Qualquer mudança aqui precisa preservar as quatro:

1. **Isolamento de tenant** — produto capturado visível só para a conta que capturou. Proibido publicar em catálogo global aberto.
2. **Atribuição obrigatória da fonte** — `source_url` da loja original (já enviado por `popup.js` em todo produto capturado) aparece sempre: no card, na prancha e no orçamento exportado.
3. **Canal de takedown** — endereço de compliance visível e fluxo de remoção rápida a pedido do lojista.
4. **Gatilho por ação humana** — a captura é sempre iniciada por clique do usuário no popup da extensão. **Proibido scraper automatizado em lote no backend**, em qualquer circunstância.

## Defeito conhecido — não copie

`manifest.json` publica `http://localhost:3000/*` e `http://127.0.0.1:8000/*` em `host_permissions`, junto de `<all_urls>` — viola o Art. 4 (nenhum host fixo no código, e `<all_urls>` já é permissivo demais por si só). `popup.js` também tem um mapa `ENVIRONMENTS` com as URLs de dev e prod escritas no código e uma constante `ENV` trocada manualmente antes de publicar. Nenhum dos dois é para imitar; ambos serão corrigidos quando a extensão for reescrita.

## Nome errado — não copie

O manifesto declara `"name": "Arch Smart Clipper"` e `"default_title": "Arch Smart Clipper"`. A grafia correta da marca é **Arq Smart** (Art. 8). A correção do manifesto acompanha a reescrita da extensão; até lá, não introduza "Arch Smart" em nenhum texto novo.

## Build

Esta pasta é a fonte; o pacote distribuído é gerado, não versionado manualmente. Depois de editar qualquer arquivo aqui, rode a partir de `ArchSmart-web/`:

```
npm run build:clipper
```

Isso regenera `ArchSmart-web/public/arch-smart-clipper.zip` (prod) e `arch-smart-clipper-dev.zip` (dev), forçando o valor de `ENV` em cada um — independente do que estiver salvo em `popup.js`. Rode sempre antes de commitar uma mudança em `extension/`.

## Testes

Não há suíte automatizada aqui hoje. Verificação é manual: carregar `extension/` como extensão "não empacotada" no Chrome (`chrome://extensions` → Modo desenvolvedor → Carregar sem compactação) e testar a captura numa página de produto real.

## Onde ler mais

`spec-kit-2/memory/constitution.md` (Art. 4, 8 e 11 na íntegra).
