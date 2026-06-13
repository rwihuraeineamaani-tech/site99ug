import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";
import logo from "@/assets/site99-logo.png";

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.83a8.16 8.16 0 0 0 4.77 1.52V6.9a4.85 4.85 0 0 1-1.84-.21z"/>
  </svg>
);

export const Footer = () => (
  <footer className="border-t border-border bg-background text-foreground">
    <div className="px-8 md:px-16 py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 gap-8 label">
      <div className="col-span-2 md:col-span-1">
        <img src={logo} alt="Site 99" className="h-24 md:h-32 w-auto object-contain" />
        <p className="mt-4 normal-case tracking-normal text-muted-foreground font-sans text-sm">
          A creative residency. Narrative control as a service.
        </p>
      </div>
      <div>
        <div className="text-muted-foreground mb-3">Index</div>
        <ul className="space-y-2 normal-case tracking-normal text-sm font-medium">
          <li><Link to="/archive" data-hover>The Archive</Link></li>
          <li><Link to="/residents" data-hover>The Residents</Link></li>
          <li><Link to="/philosophy" data-hover>The Philosophy</Link></li>
          <li><Link to="/access" data-hover>The Access</Link></li>
        </ul>
      </div>
      <div>
        <div className="text-muted-foreground mb-3">Contacts</div>
        <ul className="space-y-2 normal-case tracking-normal text-sm font-medium">
          <li><a href="mailto:office@site99ug.com" data-hover>office@site99ug.com</a></li>
          <li><a href="mailto:info@site99ug.com" data-hover>info@site99ug.com</a></li>
          <li>Kampala, Uganda</li>
          <li className="flex items-center gap-3 pt-2">
            <a
              href="https://www.instagram.com/site99ug"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              data-hover
              className="hover:text-site-red transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://www.tiktok.com/@site99ug"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              data-hover
              className="hover:text-site-red transition-colors"
            >
              <TikTokIcon className="w-5 h-5" />
            </a>
          </li>
        </ul>
      </div>
      <div>
        <div className="text-muted-foreground mb-3">Status</div>
        <ul className="space-y-2 normal-case tracking-normal text-sm font-medium">
          <li className="flex items-center gap-2"><span className="w-2 h-2 bg-site-red animate-pulse rounded-full" /> Accepting Residents</li>
          <li><Link to="/residents/login" data-hover className="text-muted-foreground hover:text-site-red transition-colors">Resident Portal →</Link></li>
          <li><Link to="/admin/login" data-hover className="text-muted-foreground hover:text-site-red transition-colors">Admin Login →</Link></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-border px-8 md:px-16 py-5 flex flex-col md:flex-row justify-between gap-2 label text-[11px] text-muted-foreground">
      <span>© {new Date().getFullYear()} Site 99. All rights reserved.</span>
      <span>site99ug.com</span>
    </div>
  </footer>
);
