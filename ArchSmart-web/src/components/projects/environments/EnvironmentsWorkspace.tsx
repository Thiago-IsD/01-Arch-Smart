"use client"

import { useState } from "react"
import { EnvironmentCard } from "./EnvironmentCard"
import { NewEnvironmentModal } from "./NewEnvironmentModal"
import { DNAEditorSheet } from "./DNAEditorSheet"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface EnvironmentsWorkspaceProps {
    projectId: string
    initialEnvironments: any[]
}

export function EnvironmentsWorkspace({ projectId, initialEnvironments }: EnvironmentsWorkspaceProps) {
    const [environments, setEnvironments] = useState(initialEnvironments)
    const [isNewModalOpen, setIsNewModalOpen] = useState(false)

    // DNA Editor State
    const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null)

    const handleEnvironmentAdded = (newEnv: any) => {
        setEnvironments(prev => [...prev, newEnv])
    }

    const handleEnvironmentUpdated = (updatedEnv: any) => {
        setEnvironments(prev => prev.map(env => env.id === updatedEnv.id ? updatedEnv : env))
    }

    const handleEnvironmentDeleted = (deletedId: string) => {
        setEnvironments(prev => prev.filter(env => env.id !== deletedId))
    }

    const selectedEnv = environments.find(e => e.id === selectedEnvId)

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">Caderno de Ambientes</h3>
                <Button onClick={() => setIsNewModalOpen(true)} size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Novo Ambiente
                </Button>
            </div>

            {environments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {environments.map(env => (
                        <EnvironmentCard
                            key={env.id}
                            environment={env}
                            onClick={() => setSelectedEnvId(env.id)}
                            onDelete={(id) => handleEnvironmentDeleted(id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed rounded-lg bg-muted/10">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Plus className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">Construa o projeto</h4>
                    <p className="text-muted-foreground text-center max-w-sm mb-6">
                        Adicione salas, quartos e outros ambientes para compor o DNA técnico deste projeto.
                    </p>
                    <Button onClick={() => setIsNewModalOpen(true)}>
                        Adicionar Primeiro Ambiente
                    </Button>
                </div>
            )}

            <NewEnvironmentModal
                isOpen={isNewModalOpen}
                onOpenChange={setIsNewModalOpen}
                projectId={projectId}
                onSuccess={handleEnvironmentAdded}
            />

            <DNAEditorSheet
                environment={selectedEnv}
                isOpen={!!selectedEnvId}
                onOpenChange={(open) => !open && setSelectedEnvId(null)}
                onSuccess={handleEnvironmentUpdated}
            />
        </div>
    )
}
