import { useEffect, useState } from "react";
import { ArrowLeft, Menu, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { WipeLink } from "@/components/ThemeWipe";
import { Button } from "@/components/ui/button";
import sectorLogo from "@/assets/site99-ai-white-v2.png.asset.json";

const links = [
  { to: "/ai-automations", label: "Overview", end: true },
  { to: "/ai-automations/systems", label: "Systems" },
  { to: "/ai-automations/kazi", label: "Kazi" },
  { to: "/ai-automations/about", label: "About" },
  { to: "/ai-automations/contact", label: "Contact" },
];

export const AINav = () => {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-md">
      <nav className="relative flex h-16 items-center justify-between gap-3 px-4 sm:px-8 md:h-auto md:py-3 md:px-16">
        <WipeLink to="/ai-automations" className="group flex min-w-0 items-center">
          <img
            src={sectorLogo.url}
            alt="Site 99 AI & Automations"
            className="h-7 max-w-[185px] select-none object-contain object-left transition-transform duration-300 group-hover:scale-[1.04] md:h-9 md:max-w-none"
          />
        </WipeLink>

        <ul className="hidden flex-1 items-center justify-center gap-7 md:flex">
          {links.map((l) => {
            const active = l.end ? pathname === l.to : pathname.startsWith(l.to);
            return (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={`tech relative block whitespace-nowrap py-1 text-[10px] font-bold uppercase tracking-[0.24em] transition-colors ${
                    active ? "text-white" : "text-white/45 hover:text-white"
                  }`}
                >
                  {l.label}
                  {active && <span className="absolute inset-x-0 -bottom-px h-px bg-white" />}
                </NavLink>
              </li>
            );
          })}
        </ul>

        <WipeLink
          to="/"
          className="tech hidden shrink-0 rounded-full border border-white/25 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70 transition-colors hover:border-white hover:bg-white hover:text-black md:block"
        >
          ← Main site
        </WipeLink>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={menuOpen ? "Close AI navigation" : "Open AI navigation"}
          aria-expanded={menuOpen}
          aria-controls="ai-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="h-10 w-10 shrink-0 border border-white/20 bg-black/40 text-white hover:bg-white hover:text-black md:hidden"
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>

        <div
          id="ai-mobile-menu"
          className={`absolute inset-x-0 top-full border-b border-white/10 bg-black/95 px-4 pb-5 pt-2 backdrop-blur-xl transition-all duration-300 md:hidden ${
            menuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
          }`}
        >
          <ul className="divide-y divide-white/10 border-t border-white/10">
            {links.map((link) => {
              const active = link.end ? pathname === link.to : pathname.startsWith(link.to);
              return (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={`tech flex min-h-12 items-center justify-between py-3 text-xs font-bold uppercase tracking-[0.2em] ${
                      active ? "text-white" : "text-white/55"
                    }`}
                  >
                    {link.label}
                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-white/20"}`} />
                  </NavLink>
                </li>
              );
            })}
          </ul>
          <WipeLink
            to="/"
            className="tech mt-4 flex min-h-11 items-center justify-center gap-2 border border-white/25 text-[10px] font-bold uppercase tracking-[0.2em] text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Main site
          </WipeLink>
        </div>
      </nav>
    </header>
  );
};
