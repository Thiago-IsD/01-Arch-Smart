import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ProjetosVazio() {
    return (
        <div
            data-testid="projetos-vazio"
            className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 py-20"
        >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Plus className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Nenhum projeto ainda</h3>
            <p className="mb-6 max-w-sm text-center text-muted-foreground">
                Comece criando seu primeiro projeto arquitetônico e vincule o seu cliente.
            </p>
            <Button asChild>
                <Link href="/projects?action=new">Criar Primeiro Projeto</Link>
            </Button>
        </div>
    )
}
