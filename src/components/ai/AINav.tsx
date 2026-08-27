import { NavLink, useLocation } from "react-router-dom";
import { WipeLink } from "@/components/ThemeWipe";

const links = [
  { to: "/ai-automations", label: "Overview", end: true },
  { to: "/ai-automations/systems", label: "Systems" },
  { to: "/ai-automations/kazi", label: "Kazi" },
  { to: "/ai-automations/about", label: "About" },
  { to: "/ai-automations/contact", label: "Contact" },
];

export const AINav = () => {
  const { pathname } = useLocation();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-md">
      <nav className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8 md:px-16">
        <WipeLink
          to="/"
          className="tech shrink-0 rounded-full border border-white/25 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/70 transition-colors hover:border-white hover:bg-white hover:text-black"
        >
          ← Main site
        </WipeLink>

        <ul className="flex items-center gap-4 overflow-x-auto sm:gap-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      </nav>
    </header>
  );
};
