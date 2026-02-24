"use client"

import { useRouter } from "next/navigation"
import { ProjectWizard } from "@/components/projects/ProjectWizard"

export function ClientWizardDriver({ isOpen }: { isOpen: boolean }) {
    const router = useRouter()

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            router.push("/projects", { scroll: false })
        }
    }

    const handleSuccess = () => {
        router.refresh()
    }

    return (
        <ProjectWizard
            isOpen={isOpen}
            onOpenChange={handleOpenChange}
            onSuccess={handleSuccess}
        />
    )
}
