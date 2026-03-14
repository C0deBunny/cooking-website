// import Components
import Link from "next/link";
import Image from "next/image";
import { Instagram, Facebook, Mail } from "lucide-react";

type FooterProps = {
  isLoggedIn?: boolean;
};

export default function Footer({ isLoggedIn = false }: FooterProps) {
  return (
    <footer className="mt-20 mb-10 border-t">
      <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <Link href="/" className="mr-6 flex items-center gap-2">
            <Image src="/logo.png" alt="Chique's Swiet Mofo" width={128} height={128} className="h-10 w-auto mr-1" />
            <span className="text-lg font-semibold text-foreground leading-none">{`Chique's Swiet Mofo`}</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href="/" className="hover:underline">
              Home
            </Link>

            <Link href="/recipes" className="hover:underline">
              Recipes
            </Link>

            {isLoggedIn && (
              <Link href="/admin" className="hover:underline">
                Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-6">
            <Link href="" className="hover:underline">
              <Mail className="h-4 w-4 inline-block mr-1" />
            </Link>

            <Link href="https://www.facebook.com/ChiquethaVolkerts" target="_blank" rel="noopener noreferrer" className="hover:underline">
              <Facebook className="h-4 w-4 inline-block mr-1" />
            </Link>

            <Link href="" className="hover:underline">
              <Instagram className="h-4 w-4 inline-block mr-1" />
            </Link>
          </div>

          <div className="text-xs">
            © {new Date().getFullYear()} {`Chique's Swiet Mofo`}
          </div>
        </div>
      </div>
    </footer>
  );
}
