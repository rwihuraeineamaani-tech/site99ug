import { ReactNode } from "react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";

export const Layout = ({ children, hideFooter }: { children: ReactNode; hideFooter?: boolean }) => {
  return (
    <div className="public-shell grain min-h-screen overflow-x-clip bg-background text-foreground">
      <Nav />
      <main>{children}</main>
      {!hideFooter && <Footer />}
    </div>
  );
};

