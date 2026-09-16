import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { UpgradeAlertModal } from "@/components/projects/UpgradeAlertModal"
import { estadoDoLimite } from "@/features/projects/limite"

/**
 * `ativos` vem de `active_count` da API — nunca contado sobre a pagina.
 * Sem `planLimit` (a chamada a /me falhou) nao ha contador nem modal: a tela
 * nao inventa limite (Art. 3). "Plano Solo" continua fixo: recusado por
 * escrito na spec de Projetos, decisao 2.
 */
export function CabecalhoDeProjetos({ ativos, planLimit }: { ativos: number; planLimit?: number }) {
    const limite = planLimit === undefined ? undefined : estadoDoLimite(ativos, planLimit)

    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <div className="mb-1 flex flex-wrap items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight">Projetos</h2>

                    {limite && (
                        <div className="flex items-center gap-3 rounded-full border bg-muted/40 px-3 py-1.5 shadow-sm">
                            <span className="hidden text-xs font-medium text-muted-foreground sm:inline-block">
                                Plano Solo
                            </span>
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                <div
                                    className={`h-full ${limite.noLimite ? "bg-destructive" : "bg-primary"} transition-all duration-500`}
                                    style={{ width: `${limite.fracao * 100}%` }}
                                />
                            </div>
                            <span className={`text-xs font-bold ${limite.noLimite ? "text-destructive" : "text-primary"}`}>
                                {ativos}/{planLimit}
                            </span>
                        </div>
                    )}
                </div>

                <p className="text-muted-foreground">Acompanhe seus projetos, ambientes e faturamento centralizados.</p>
            </div>

            <div className="flex items-center gap-2">
                {limite?.noLimite && planLimit !== undefined ? (
                    <UpgradeAlertModal planLimit={planLimit} />
                ) : (
                    <Button asChild>
                        <Link href="/projects?action=new">
                            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Novo Projeto
                        </Link>
                    </Button>
                )}
            </div>
        </div>
    )
}
