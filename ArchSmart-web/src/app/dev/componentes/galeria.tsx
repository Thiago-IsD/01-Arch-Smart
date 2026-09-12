"use client"

import * as React from "react"
import type { UseQueryResult } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { CurrencyInput } from "@/components/ui/currency-input"
import { DataTable } from "@/components/ui/data-table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { QueryBoundary } from "@/components/ui/query-boundary"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Query falsa, só para a galeria mostrar cada estado sem rede.
 *
 * AVISO: o cast `as unknown as UseQueryResult<T>` esconde um risco. O objeto
 * falso não satisfaz o shape real do `UseQueryResult` — hoje funciona porque
 * `QueryBoundary` lê só `isPending`, `isError`, `data`, `error` e `refetch`.
 * Se `QueryBoundary` passar a ler outro campo no futuro, a galeria continua
 * compilando e passa a mostrar o estado errado, **sem erro de tipo**. Quem
 * mexer em `QueryBoundary` precisa confirmar se este `fake` segue válido.
 */
function fake<T>(parcial: Partial<UseQueryResult<T>>): UseQueryResult<T> {
    return {
        isPending: false,
        isError: false,
        data: undefined,
        error: null,
        refetch: () => {},
        ...parcial,
    } as unknown as UseQueryResult<T>
}

function Secao({ nome, children }: { nome: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-4 border-b border-border py-8">
            <h2 className="text-xl font-semibold">{nome}</h2>
            {children}
        </section>
    )
}

const LINHAS = [
    { nome: "Cadeira Eames", valor: 300 },
    { nome: "Abajur Linho", valor: 100 },
]

/**
 * Campo de CurrencyInput dentro do conjunto de formulario do react-hook-form
 * — o padrao vigente desde a Secao 8 (ver "Um FormField so" no CLAUDE.md).
 * `CurrencyInput` fala centavos direto (nao evento), por isso o `onChange`
 * aqui chama `field.onChange(novoCentavos)` com o valor, nao com o evento —
 * o proprio react-hook-form aceita os dois formatos.
 */
function CampoDeValor({ centavos, setCentavos }: { centavos: number; setCentavos: (v: number) => void }) {
    const form = useForm({ defaultValues: { valor: centavos } })

    return (
        <Form {...form}>
            <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Valor do item</FormLabel>
                        <FormControl>
                            <CurrencyInput
                                value={field.value}
                                onChange={(novoCentavos) => {
                                    field.onChange(novoCentavos)
                                    setCentavos(novoCentavos)
                                }}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
        </Form>
    )
}

/**
 * Mostra o conjunto completo: rotulo ligado por `htmlFor`, erro anunciado por
 * `aria-describedby`/`aria-invalid`, e `sensivel` -> `data-private` no
 * `FormItem` (a decisao de produto que veio do componente apagado na Secao 8).
 */
function FormularioDeExemplo() {
    const form = useForm({ defaultValues: { email: "", cpf: "" } })

    React.useEffect(() => {
        // So para a galeria mostrar o estado de erro sem precisar de
        // interacao — nao dispara de novo porque so roda no mount.
        form.setError("email", { message: "E-mail invalido" })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <Form {...form}>
            <div className="flex flex-col gap-4">
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                                <input {...field} className="rounded border border-input p-2" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                        <FormItem sensivel>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                                <input {...field} className="rounded border border-input p-2" />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>
        </Form>
    )
}

export function Galeria() {
    const [centavos, setCentavos] = React.useState(12345)

    return (
        <main className="mx-auto flex max-w-4xl flex-col px-4">
            <h1 className="py-8 text-3xl font-bold">Componentes — Arq Smart</h1>

            <Secao nome="EmptyState">
                <EmptyState
                    titulo="Nenhum produto"
                    descricao="Use o Web Clipper para trazer o primeiro."
                    acao={{ rotulo: "Abrir o Clipper", aoClicar: () => {} }}
                />
            </Secao>

            <Secao nome="CurrencyInput">
                <CampoDeValor centavos={centavos} setCentavos={setCentavos} />
                <p className="text-sm text-muted-foreground">Em centavos: {centavos}</p>
            </Secao>

            <Secao nome="FormField">
                <FormularioDeExemplo />
            </Secao>

            <Secao nome="DataTable">
                <DataTable
                    colunas={[
                        { chave: "nome", rotulo: "Nome" },
                        { chave: "valor", rotulo: "Valor" },
                    ]}
                    linhas={LINHAS}
                    chaveDaLinha={(l) => l.nome}
                />
            </Secao>

            <Secao nome="QueryBoundary">
                <div data-testid="qb-carregando">
                    <QueryBoundary
                        query={fake<string[]>({ isPending: true })}
                        skeleton={<Skeleton className="h-8 w-40" />}
                        empty={<EmptyState titulo="Vazio" descricao="Nada aqui." />}
                        error={(erro) => <p className="text-destructive">{erro.message}</p>}
                    >
                        {(dados) => <p>{dados.join()}</p>}
                    </QueryBoundary>
                </div>
                <div data-testid="qb-vazio">
                    <QueryBoundary
                        query={fake<string[]>({ data: [] })}
                        skeleton={<Skeleton className="h-8 w-40" />}
                        empty={<EmptyState titulo="Vazio" descricao="Nada aqui." />}
                        error={(erro) => <p className="text-destructive">{erro.message}</p>}
                    >
                        {(dados) => <p>{dados.join()}</p>}
                    </QueryBoundary>
                </div>
                <div data-testid="qb-erro">
                    <QueryBoundary
                        query={fake<string[]>({ isError: true, error: new Error("A API nao respondeu") })}
                        skeleton={<Skeleton className="h-8 w-40" />}
                        empty={<EmptyState titulo="Vazio" descricao="Nada aqui." />}
                        error={(erro) => <p className="text-destructive">{erro.message}</p>}
                    >
                        {(dados) => <p>{dados.join()}</p>}
                    </QueryBoundary>
                </div>
                <div data-testid="qb-dados">
                    <QueryBoundary
                        query={fake<string[]>({ data: ["Cadeira", "Abajur"] })}
                        skeleton={<Skeleton className="h-8 w-40" />}
                        empty={<EmptyState titulo="Vazio" descricao="Nada aqui." />}
                        error={(erro) => <p className="text-destructive">{erro.message}</p>}
                    >
                        {(dados) => <p>{dados.join(", ")}</p>}
                    </QueryBoundary>
                </div>
            </Secao>

            <Secao nome="ErrorBoundary">
                <ErrorBoundary fallback={(erro) => <p className="text-destructive">{erro.message}</p>}>
                    <p>Conteudo normal — o fallback so aparece quando um filho estoura.</p>
                </ErrorBoundary>
            </Secao>

            <Secao nome="AlertDialog">
                <AlertDialog>
                    <AlertDialogTrigger className="rounded bg-destructive px-3 py-2 text-destructive-foreground">
                        Excluir projeto
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <p>Esta acao nao pode ser desfeita.</p>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </Secao>

            <Secao nome="DropdownMenu">
                <DropdownMenu>
                    <DropdownMenuTrigger className="rounded border border-input px-3 py-2">
                        Acoes
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem>Duplicar</DropdownMenuItem>
                        <DropdownMenuItem>Arquivar</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </Secao>

            <Secao nome="Skeleton">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-40" />
            </Secao>

            <Secao nome="Tokens de estado">
                <div className="flex flex-wrap gap-2">
                    <span className="rounded bg-success px-3 py-1 text-success-foreground">success</span>
                    <span className="rounded bg-warning px-3 py-1 text-warning-foreground">warning</span>
                    <span className="rounded bg-info px-3 py-1 text-info-foreground">info</span>
                    <span className="rounded bg-destructive px-3 py-1 text-destructive-foreground">
                        destructive
                    </span>
                </div>
            </Secao>
        </main>
    )
}
