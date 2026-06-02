import { ReactNode } from "react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { Cursor } from "./Cursor";
import { useIsMobile } from "@/hooks/use-mobile";

export const Layout = ({ children, hideFooter }: { children: ReactNode; hideFooter?: boolean }) => {
  const isMobile = useIsMobile();
  return (
    <div className="grain min-h-screen bg-background text-foreground">
      {!isMobile && <Cursor />}
      <Nav />
      <main>{children}</main>
      {!hideFooter && <Footer />}
    </div>
  );
};
