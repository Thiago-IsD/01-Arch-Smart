"use client";

import { Construction } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
            <div className="rounded-2xl bg-white p-8 shadow-xl md:p-12">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                    <Construction className="h-10 w-10 text-blue-600" />
                </div>
                <h1 className="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
                    Dashboard em Construção
                </h1>
                <p className="mb-8 text-lg text-gray-600">
                    Estamos preparando algo incrível para você. <br />
                    Em breve, você terá acesso completo ao painel.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                    <Button asChild className="bg-[#008080] hover:bg-[#008080]/90">
                        <Link href="/">Voltar para Home</Link>
                    </Button>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        Recarregar
                    </Button>
                </div>
            </div>
        </div>
    );
}
