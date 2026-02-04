"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, CreditCard, FileText, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { apiUrl } from "@/lib/api-url"

interface BillingData {
    plan_name: string | null
    status: string
    renewal_date: string
}

export default function BillingPage() {
    const { toast } = useToast()
    const [isLoading, setIsLoading] = useState(true)
    const [billingData, setBillingData] = useState<BillingData>({
        plan_name: null,
        status: "BETA",
        renewal_date: "Vitalício durante Beta"
    })

    // Mock invoice data
    const invoices = [
        {
            id: 1,
            date: "01/06/2025",
            description: "Acesso Antecipado",
            amount: "R$ 0,00",
            status: "Pago"
        }
    ]

    useEffect(() => {
        fetchBillingData()
    }, [])

    async function fetchBillingData() {
        try {
            const { createClient } = await import("@/utils/supabase/client")
            const supabase = createClient()
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError || !session) {
                throw new Error("Sessão expirada")
            }

            const response = await fetch(apiUrl("/api/users/me"), {
                headers: {
                    "Authorization": `Bearer ${session.access_token}`
                }
            })

            if (!response.ok) {
                throw new Error("Erro ao carregar dados de billing")
            }

            const data = await response.json()

            setBillingData({
                plan_name: data.account?.plan_name || "Beta Pro",
                status: data.account?.subscription_status || "BETA",
                renewal_date: "Vitalício durante Beta"
            })

        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
            "BETA": { variant: "default", label: "Ativo (Beta)" },
            "active": { variant: "default", label: "Ativo" },
            "inactive": { variant: "secondary", label: "Inativo" },
            "cancelled": { variant: "destructive", label: "Cancelado" }
        }

        const config = statusMap[status] || statusMap["BETA"]
        return <Badge variant={config.variant}>{config.label}</Badge>
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-10 space-y-8 max-w-5xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Planos e Pagamentos</h1>
                <p className="text-muted-foreground">
                    Gerencie seu plano e visualize o histórico de faturas.
                </p>
            </div>

            {/* Plan Status Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Plano Atual</CardTitle>
                            <CardDescription>
                                Informações sobre sua assinatura
                            </CardDescription>
                        </div>
                        {getStatusBadge(billingData.status)}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Plano</p>
                            <p className="text-2xl font-bold">{billingData.plan_name || "Beta Pro"}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Valor</p>
                            <p className="text-2xl font-bold">R$ 0,00</p>
                            <p className="text-xs text-muted-foreground">Durante o período Beta</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Renovação</p>
                            <p className="text-lg font-semibold">{billingData.renewal_date}</p>
                        </div>
                    </div>

                    {/* Beta Notice */}
                    <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-4">
                        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                Acesso Beta Gratuito
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                Você tem acesso completo e gratuito durante o período Beta.
                                Agradecemos por fazer parte da nossa jornada! 🚀
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-block">
                                        <Button variant="outline" disabled className="gap-2">
                                            <CreditCard className="h-4 w-4" />
                                            Alterar Plano
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Gerenciado externamente durante o Beta</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-block">
                                        <Button variant="outline" disabled className="gap-2">
                                            <FileText className="h-4 w-4" />
                                            Dados de Pagamento
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Gerenciado externamente durante o Beta</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </CardContent>
            </Card>

            {/* Invoice History */}
            <Card>
                <CardHeader>
                    <CardTitle>Histórico de Faturas</CardTitle>
                    <CardDescription>
                        Visualize todas as suas transações
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell className="font-medium">{invoice.date}</TableCell>
                                    <TableCell>{invoice.description}</TableCell>
                                    <TableCell>{invoice.amount}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900">
                                            {invoice.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
