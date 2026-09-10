"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, FolderGit2, FolderIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import type { DashboardLeanResponse } from "./types"

/** Coluna 1 do grid secundario: "Continuar Trabalhando". */
export function RecentProjectsColumn({ data }: { data: DashboardLeanResponse | null }) {
    const router = useRouter()

    return (
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h2 className="text-xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
                            <FolderGit2 className="h-5 w-5 text-primary" /> Continuar Trabalhando
                        </h2>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 font-semibold p-0 h-auto" onClick={() => router.push("/projects")}>
                            Ver Todos
                        </Button>
                    </div>
                    
                    {!data?.recent_projects || data.recent_projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed text-muted-foreground bg-muted/20">
                            <FolderIcon className="h-10 w-10 mb-3 text-muted-foreground/40" />
                            <p className="mb-4 text-sm font-medium">Você ainda não tem projetos ativos.</p>
                            <Button size="sm" onClick={() => router.push("/projects")}>
                                Criar Primeiro Projeto
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {data.recent_projects.map((proj) => (
                                <Link key={proj.id} href={`/projects/${proj.id}`}>
                                    <Card className="hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-300 cursor-pointer group">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{proj.name}</h3>
                                                {proj.client_name ? (
                                                    <p className="text-xs text-muted-foreground mt-0.5">Cliente: {proj.client_name}</p>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground mt-0.5">Sem cliente vinculado</p>
                                                )}
                                            </div>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
    )
}
