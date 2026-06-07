import { Link } from "react-router-dom";
import logo from "@/assets/site99-logo.png";

export const Footer = () => (
  <footer className="border-t border-border bg-background text-foreground">
    <div className="px-5 md:px-8 py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 gap-8 label">
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
          <li>Kampala, Uganda</li>
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
    <div className="border-t border-border px-5 md:px-8 py-5 flex flex-col md:flex-row justify-between gap-2 label text-[11px] text-muted-foreground">
      <span>© {new Date().getFullYear()} Site 99. All rights reserved.</span>
      <span>site99ug.com</span>
    </div>
  </footer>
);
