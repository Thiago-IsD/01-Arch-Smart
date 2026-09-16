"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Ambiente } from "@/features/projects/types"

import { DNAEditorSheet } from "./DNAEditorSheet"
import { EnvironmentCard } from "./EnvironmentCard"
import { NewEnvironmentModal } from "./NewEnvironmentModal"

interface EnvironmentsWorkspaceProps {
    projectId: string
    ambientes: Ambiente[]
}

export function EnvironmentsWorkspace({ projectId, ambientes }: EnvironmentsWorkspaceProps) {
    const [isNewModalOpen, setIsNewModalOpen] = useState(false)
    const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null)

    const selectedEnv = ambientes.find((e) => e.id === selectedEnvId)

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">Caderno de Ambientes</h3>
                <Button onClick={() => setIsNewModalOpen(true)} size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Novo Ambiente
                </Button>
            </div>

            {ambientes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {ambientes.map(env => (
                        <EnvironmentCard
                            key={env.id}
                            environment={env}
                            onClick={() => setSelectedEnvId(env.id)}
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
            />

            <DNAEditorSheet
                environment={selectedEnv}
                isOpen={!!selectedEnvId}
                onOpenChange={(open) => !open && setSelectedEnvId(null)}
            />
        </div>
    )
}
