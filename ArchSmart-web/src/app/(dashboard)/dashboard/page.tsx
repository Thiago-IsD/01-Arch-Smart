export default function DashboardPage() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
            <p className="text-muted-foreground mb-8">
                Visão geral do sistema e resumo das atividades.
            </p>

            {/* Placeholder for dashboard widgets */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 rounded-lg border border-border bg-card">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Projetos Ativos
                    </h3>
                    <p className="text-3xl font-bold text-foreground">0</p>
                </div>

                <div className="p-6 rounded-lg border border-border bg-card">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Produtos na Biblioteca
                    </h3>
                    <p className="text-3xl font-bold text-foreground">0</p>
                </div>

                <div className="p-6 rounded-lg border border-border bg-card">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Apresentações
                    </h3>
                    <p className="text-3xl font-bold text-foreground">0</p>
                </div>

                <div className="p-6 rounded-lg border border-border bg-card">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Compromissos Hoje
                    </h3>
                    <p className="text-3xl font-bold text-foreground">0</p>
                </div>
            </div>
        </div>
    );
}
