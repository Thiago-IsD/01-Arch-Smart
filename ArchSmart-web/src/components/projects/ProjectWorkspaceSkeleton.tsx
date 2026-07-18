import { Skeleton } from "@/components/ui/skeleton"

/**
 * Esqueleto exibido instantaneamente ao navegar entre as abas do projeto
 * (Ambientes / Orçamento / Apresentação). Como cada aba é uma rota SSR
 * separada, sem isto a página anterior "congela" 1-2s até o servidor render­izar.
 * O loading.tsx de cada rota renderiza este componente enquanto os dados chegam.
 */
export function ProjectWorkspaceSkeleton() {
    return (
        <div className="h-full flex flex-col space-y-6 p-8">
            {/* Voltar + título */}
            <div className="space-y-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-4 w-80" />
            </div>

            {/* Abas */}
            <div className="flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-32" />
            </div>

            {/* Conteúdo */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full rounded-xl" />
                ))}
            </div>
        </div>
    )
}
