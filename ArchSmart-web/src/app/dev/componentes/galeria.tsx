"use client"

import * as React from "react"
import type { UseQueryResult } from "@tanstack/react-query"

import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog"
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
import { FormField } from "@/components/ui/form-field"
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
                <FormField id="galeria-valor" rotulo="Valor do item">
                    <CurrencyInput id="galeria-valor" value={centavos} onChange={setCentavos} />
                </FormField>
                <p className="text-sm text-muted-foreground">Em centavos: {centavos}</p>
            </Secao>

            <Secao nome="FormField">
                <FormField id="galeria-email" rotulo="E-mail" erro="E-mail invalido">
                    <input id="galeria-email" className="rounded border border-input p-2" />
                </FormField>
                <FormField id="galeria-cpf" rotulo="CPF" sensivel>
                    <input id="galeria-cpf" className="rounded border border-input p-2" />
                </FormField>
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
