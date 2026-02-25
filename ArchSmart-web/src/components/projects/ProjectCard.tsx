import * as React from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, LayoutDashboard, Calendar } from "lucide-react"
import Link from "next/link"

interface ProjectCardProps {
    id: string
    name: string
    clientName?: string
    status?: string
    serviceType?: string
    createdAt: string
    environmentsCount?: number
}

export function ProjectCard({
    id,
    name,
    clientName,
    status = "ACTIVE",
    serviceType,
    createdAt,
    environmentsCount = 0
}: ProjectCardProps) {
    const isCompleted = status === "COMPLETED"

    return (
        <Link href={`/projects/${id}`} className="block h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl">
            <Card className={`h-full relative overflow-hidden transition-all hover:shadow-md hover:border-primary/50 ${isCompleted ? 'opacity-70' : ''}`}>
                {status === "ACTIVE" && (
                    <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                        <div className="absolute top-4 -right-6 w-24 text-center transform rotate-45 bg-primary text-primary-foreground text-[10px] font-bold py-0.5">
                            ATIVO
                        </div>
                    </div>
                )}

                <CardHeader className="pb-2 pr-12">
                    <CardTitle className="text-xl leading-tight line-clamp-1" title={name}>
                        {name}
                    </CardTitle>
                    {serviceType && (
                        <div className="text-xs text-muted-foreground mt-1">
                            {serviceType}
                        </div>
                    )}
                </CardHeader>

                <CardContent className="pb-4 space-y-3">
                    <div className="flex items-center text-sm text-muted-foreground">
                        <User className="mr-2 h-4 w-4" />
                        <span className="line-clamp-1">{clientName || "Sem Cliente"}</span>
                    </div>

                    <div className="flex items-center text-sm text-muted-foreground">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>{environmentsCount} {environmentsCount === 1 ? 'Ambiente' : 'Ambientes'}</span>
                    </div>

                    <div className="flex items-center text-xs text-muted-foreground pt-1">
                        <Calendar className="mr-2 h-3 w-3" />
                        <span>Criado em {new Date(createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                </CardContent>

                <CardFooter className="pt-0 pb-4 mt-auto">
                    <Badge variant={isCompleted ? "secondary" : "default"}>
                        {status === "ACTIVE" ? "Em Andamento" : status}
                    </Badge>
                </CardFooter>
            </Card>
        </Link>
    )
}
