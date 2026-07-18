import { AppShell } from "@/components/layout/AppShell";
import { GlobalChatWidget } from "@/components/layout/GlobalChatWidget";
import { QueryProvider } from "@/components/providers/QueryProvider";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <QueryProvider>
            <AppShell>{children}</AppShell>
            <GlobalChatWidget />
        </QueryProvider>
    );
}
