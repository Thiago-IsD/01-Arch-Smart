export function getSystemAsset(filename: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    console.warn("NEXT_PUBLIC_SUPABASE_URL is not defined");
    return "";
  }

  // Ensure no double slashes if the env var ends with /
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  
  return `${baseUrl}/storage/v1/object/public/public-assets/system/${filename}`;
}
