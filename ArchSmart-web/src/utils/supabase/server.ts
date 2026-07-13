import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
    const cookieStore = await cookies();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (url.includes("your-project.supabase.co") || key === "dummy_anon_key") {
        return {
            auth: {
                getSession: async () => {
                    return { data: { session: { access_token: "mock" } }, error: null };
                },
                getUser: async () => {
                    return { data: { user: { id: "00000000-0000-0000-0000-000000000000", email: "email@email.com" } }, error: null };
                }
            }
        } as any;
    }

    return createServerClient(
        url,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                    }
                },
            },
        }
    );
}
