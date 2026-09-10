"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, Store } from "lucide-react"

import { Button } from "@/components/ui/button"

import { formatCurrency } from "./format"
import type { DashboardLeanResponse } from "./types"

/** Coluna 3 do grid secundario: "Adicoes na Biblioteca". */
export function RecentProductsColumn({ data }: { data: DashboardLeanResponse | null }) {
    const router = useRouter()

    return (
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                            <Package className="h-5 w-5 text-indigo-500" /> Adições na Biblioteca
                        </h2>
                        <Button variant="ghost" size="sm" className="text-indigo-500 hover:text-indigo-600 font-semibold p-0 h-auto" onClick={() => router.push("/library")}>
                            Ver Biblioteca
                        </Button>
                    </div>

                    {!data?.recent_products || data.recent_products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                            <p className="text-sm font-medium">Nenhum produto salv recentemente.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {data.recent_products.map((prod) => (
                                <Link key={prod.id} href={`/library?product=${prod.id}`} className="group">
                                    <div className="flex flex-col rounded-xl border bg-card overflow-hidden hover:border-indigo-300 transition-all duration-300 h-full">
                                        <div className="relative aspect-[4/3] w-full bg-muted border-b overflow-hidden">
                                            {prod.image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={prod.image_url}
                                                    alt={prod.name}
                                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="flex w-full h-full items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-400 text-xs">
                                                    Sem imagem
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2.5 flex flex-col justify-between flex-1 gap-1">
                                            <div>
                                                <p className="text-xs font-semibold text-foreground truncate pr-1 group-hover:text-primary transition-colors">
                                                    {prod.name}
                                                </p>
                                                {prod.store && (
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                                        <Store className="h-2.5 w-2.5 shrink-0" />
                                                        {prod.store}
                                                    </span>
                                                )}
                                            </div>
                                            {prod.price !== undefined && prod.price !== null && prod.price > 0 && (
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                                                    {formatCurrency(prod.price)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
    )
}
