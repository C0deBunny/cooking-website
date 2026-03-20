// import components
import { Instagram, Facebook, Mail } from "lucide-react";

export default function Socials() {
  return (
    <div className="flex items-center gap-6">
      <a href="" className="hover:underline">
        {/* TODO: Add link to email */}
        <Mail className="h-4 w-4 inline-block mr-1" />
      </a>

      <a href="https://www.facebook.com/ChiquethaVolkerts" target="_blank" rel="noopener noreferrer" className="hover:underline">
        <Facebook className="h-4 w-4 inline-block mr-1" />
      </a>

      <a href="" className="hover:underline">
        {/* TODO: Add link to Instagram */}
        <Instagram className="h-4 w-4 inline-block mr-1" />
      </a>
    </div>
  );
}
