// Shared source for every generated app icon (icon.tsx, apple-icon.tsx) so
// the different sizes iOS/Android/desktop each ask for stay visually
// identical. iOS applies its own corner-rounding to apple-touch-icon, so
// this stays a plain full-bleed square — no border-radius here.
export function appIconElement(size: number) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0071e3 0%, #2997ff 100%)",
      }}
    >
      <span
        style={{
          fontSize: size * 0.58,
          fontWeight: 700,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        s
      </span>
    </div>
  );
}
