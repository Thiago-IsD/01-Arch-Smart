import { Suspense } from "react"

import { DashboardData } from "./components/DashboardData"
import { DashboardSkeleton } from "./components/DashboardSkeleton"

/**
 * Server Component. O fallback e o SERVIDOR fazendo stream (DashboardData ainda
 * nao chegou); o skeleton do QueryBoundary, dentro de DashboardContent, e o
 * CLIENTE carregando. Por isso o `data-testid` do wrapper e diferente: na
 * Biblioteca os dois tinham o mesmo, e um teste que esperava "o skeleton do
 * cliente apareceu" passava aqui sem nunca chegar ao boundary.
 */
export default function DashboardPage() {
    return (
        <Suspense
            fallback={
                <div data-testid="dashboard-shell-streaming">
                    <DashboardSkeleton />
                </div>
            }
        >
            <DashboardData />
        </Suspense>
    )
}
