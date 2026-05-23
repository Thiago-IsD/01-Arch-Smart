"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        // Redireciona a raiz do App para a nova dashboard criada
        router.replace("/dashboard");
    }, [router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Redirecionando...</p>
        </div>
    );
}
