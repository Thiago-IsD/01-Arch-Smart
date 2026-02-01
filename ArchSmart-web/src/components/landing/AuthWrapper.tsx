import { BRAND_ASSETS } from "@/config/brand";
import Image from "next/image";
import Link from "next/link";

interface AuthLayoutProps {
  children: React.ReactNode;
  heading?: string;
  description?: string;
}

const AuthWrapper = ({
  children,
  heading,
  description,
}: AuthLayoutProps) => {
  return (
    <section className="bg-background min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] flex flex-col items-center gap-y-6">
        {/* Logo */}
        <Link href="/" className="mb-2">
          <Image
            src={BRAND_ASSETS.horizontal}
            alt="Arch Smart"
            width={180}
            height={50}
            className="h-10 w-auto object-contain dark:invert"
            unoptimized
          />
        </Link>
        <div className="border border-border bg-card w-full rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col items-center gap-y-2 mb-8 text-center">
            {heading && <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>}
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>

          {children}

        </div>
      </div>
    </section>
  );
};

export { AuthWrapper };
