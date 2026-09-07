# Módulo: `features/library`

A camada de dados do domínio Biblioteca — o piloto da Seção 5.

## O que expõe

| Símbolo | Onde | O que faz |
|---|---|---|
| `useProducts(filtros, { ativo })` | `hooks.ts` | Lista paginada e filtrada. `placeholderData` mantém a lista anterior visível ao paginar. |
| `useInboxCount()` | `hooks.ts` | Total de produtos `CAPTURED` (o badge do inbox). Devolve número, não a resposta inteira. |
| `useProduct(id, ativo)` | `hooks.ts` | Um produto, para editar ou normalizar. |
| `useCreateProduct()` / `useUpdateProduct()` | `hooks.ts` | Cria e edita. Invalida `queryKeys.products.all`. |
| `useDeleteProduct()` | `hooks.ts` | Soft delete. |
| `useApproveProduct()` / `useBatchApprove()` | `hooks.ts` | Move de `CAPTURED` para `NORMALIZED`. |
| `useMoveToProject()` | `hooks.ts` | Cria item de orçamento a partir de um produto. Invalida `projects`, não `products`. |
| `stateDaAba(tab)` | `api.ts` | Traduz aba (`inbox`/`library`) para estado (`CAPTURED`/`NORMALIZED`). |

## Do que depende

`lib/api/client.ts` (header, erro, cancelamento) e `lib/query/keys.ts` (chaves
e política de cache). Não fala com Supabase e não monta URL — Art. 4.

## Invalidação

Todas as chaves de produto são filhas de `queryKeys.products.all`, então uma
mutação invalida o ramo inteiro — lista, detalhe e o badge do inbox — com uma
chamada. Antes da Seção 5, `["products"]` e `["inbox-count"]` eram irmãs
planas e o `BatchNormalizeModal` invalidava as duas à mão; três outras
mutações chamavam `router.refresh()`, que revalida Server Component e **não**
toca no cache do cliente de onde a grade lê.
