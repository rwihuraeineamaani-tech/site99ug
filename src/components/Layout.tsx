import { ReactNode } from "react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";

export const Layout = ({ children, hideFooter }: { children: ReactNode; hideFooter?: boolean }) => {
  return (
    <div className="grain min-h-screen bg-background text-foreground">
      <Nav />
      <main>{children}</main>
      {!hideFooter && <Footer />}
    </div>
  );
};

