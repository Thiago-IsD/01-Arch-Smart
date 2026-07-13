export function getSystemAsset(filename: string): string {
  // No ambiente de desenvolvimento, sempre use os assets locais
  if (process.env.NODE_ENV === "development") {
    return `/assets/brand/${filename}`;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    console.warn("NEXT_PUBLIC_SUPABASE_URL is not defined, using local fallback");
    return `/assets/brand/${filename}`;
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  return `${baseUrl}/storage/v1/object/public/public-assets/system/${filename}`;
}
