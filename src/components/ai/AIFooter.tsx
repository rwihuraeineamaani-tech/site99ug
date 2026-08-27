import { Link } from "react-router-dom";
import { WipeLink } from "@/components/ThemeWipe";
import { PoweredByLockup } from "./PoweredByLockup";

export const AIFooter = () => (
  <footer className="border-t border-white/10 px-4 py-16 sm:px-8 md:px-16 md:py-20">
    <div className="flex flex-col items-center gap-8">
      <PoweredByLockup className="h-20 md:h-28" />

      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        {[
          ["/ai-automations", "Overview"],
          ["/ai-automations/systems", "Systems"],
          ["/ai-automations/kazi", "Kazi"],
          ["/ai-automations/about", "About"],
          ["/ai-automations/contact", "Contact"],
        ].map(([to, label]) => (
          <Link
            key={to}
            to={to}
            className="tech text-[10px] uppercase tracking-[0.24em] text-white/45 transition-colors hover:text-white"
          >
            {label}
          </Link>
        ))}
      </nav>

      <a
        href="mailto:info@site99ug.com"
        className="text-sm text-white/70 underline underline-offset-4 hover:text-white"
      >
        info@site99ug.com
      </a>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <WipeLink to="/" className="tech text-[10px] uppercase tracking-[0.24em] text-white/35 hover:text-white">
          Site 99 home
        </WipeLink>
        <WipeLink to="/services" className="tech text-[10px] uppercase tracking-[0.24em] text-white/35 hover:text-white">
          Site 99 services
        </WipeLink>
        <span className="tech text-[10px] uppercase tracking-[0.24em] text-white/30">© Site 99 UG LTD</span>
      </div>
    </div>
  </footer>
);
