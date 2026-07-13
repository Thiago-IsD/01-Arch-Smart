import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (url.includes("your-project.supabase.co") || key === "dummy_anon_key") {
        console.log("🚀 MOCK SUPABASE CLIENT ACTIVATED");
        return {
            auth: {
                setSession: async (data: any) => {
                    localStorage.setItem('mock_session', JSON.stringify(data));
                    document.cookie = `sb-access-token=${data.access_token}; path=/`;
                    return { data: { session: data }, error: null };
                },
                getSession: async () => {
                    return { data: { session: { access_token: "mock" } }, error: null };
                },
                getUser: async () => {
                    return { data: { user: { id: "00000000-0000-0000-0000-000000000000", email: "email@email.com" } }, error: null };
                },
                onAuthStateChange: () => {
                    return { data: { subscription: { unsubscribe: () => {} } } };
                },
                signOut: async () => {
                    localStorage.removeItem('mock_session');
                    document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
                    return { error: null };
                }
            }
        } as any;
    }

    return createBrowserClient(
        url,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
