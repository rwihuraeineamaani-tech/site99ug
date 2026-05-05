import { ReactNode } from "react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { Cursor } from "./Cursor";

export const Layout = ({ children, hideFooter }: { children: ReactNode; hideFooter?: boolean }) => (
  <div className="grain min-h-screen bg-background text-foreground">
    <Cursor />
    <Nav />
    <main>{children}</main>
    {!hideFooter && <Footer />}
  </div>
);
