import { Link } from "react-router-dom";

export const Footer = () => (
  <footer className="border-t border-border bg-site-black text-site-white">
    <div className="px-6 md:px-10 py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 gap-8 mono text-xs uppercase tracking-widest">
      <div className="col-span-2 md:col-span-1">
        <div className="display text-3xl">SITE<span className="text-site-red">/</span>99</div>
        <p className="mt-4 normal-case tracking-normal text-muted-foreground font-sans">
          A creative residency. Narrative control as a service.
        </p>
      </div>
      <div>
        <div className="text-muted-foreground mb-3">Index</div>
        <ul className="space-y-2">
          <li><Link to="/archive" data-hover>The Archive</Link></li>
          <li><Link to="/residents" data-hover>The Residents</Link></li>
          <li><Link to="/philosophy" data-hover>The Philosophy</Link></li>
          <li><Link to="/access" data-hover>The Access</Link></li>
        </ul>
      </div>
      <div>
        <div className="text-muted-foreground mb-3">Coordinates</div>
        <ul className="space-y-2">
          <li>hello@site99.co</li>
          <li>+1 (000) 099 0099</li>
          <li>Worldwide / 24h</li>
        </ul>
      </div>
      <div>
        <div className="text-muted-foreground mb-3">Status</div>
        <ul className="space-y-2">
          <li className="flex items-center gap-2"><span className="w-2 h-2 bg-site-red animate-pulse rounded-full" /> Accepting Residents Q3</li>
          <li>v9.9.99</li>
        </ul>
      </div>
    </div>
    <div className="border-t border-border px-6 md:px-10 py-5 flex flex-col md:flex-row justify-between gap-2 mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
      <span>© SITE 99 — All Territory Reserved</span>
      <span>The Land Grab Is On.</span>
    </div>
  </footer>
);
