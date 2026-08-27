import lockup from "@/assets/site99-ai-lockup.png.asset.json";

export const PoweredByLockup = ({ className = "h-20" }: { className?: string }) => (
  <img
    src={lockup.url}
    alt="powered by Site 99 — AI & Automations"
    loading="lazy"
    className={`${className} w-auto select-none`}
  />
);
