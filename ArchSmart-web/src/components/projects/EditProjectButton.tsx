"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PenTool } from "lucide-react"
import { ProjectWizard } from "./ProjectWizard"

interface EditProjectButtonProps {
    projectData: any
}

export function EditProjectButton({ projectData }: EditProjectButtonProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
                <PenTool className="w-4 h-4 mr-2" /> Editar Dados
            </Button>
            <ProjectWizard
                isOpen={isOpen}
                onOpenChange={setIsOpen}
                mode="edit"
                initialData={projectData}
            />
        </>
    )
}
