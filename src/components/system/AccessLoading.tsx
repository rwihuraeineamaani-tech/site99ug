import logoAsset from "@/assets/site99-logo-red.png.asset.json";

export default function AccessLoading() {
  return (
    <div
      className="deck fixed inset-0 z-[300] grid min-h-svh place-items-center bg-paper text-ink"
      role="status"
      aria-label="Opening Site 99"
    >
      <img
        src={logoAsset.url}
        alt="Site 99"
        className="access-logo-float h-40 w-40 object-contain sm:h-48 sm:w-48"
      />
    </div>
  );
}