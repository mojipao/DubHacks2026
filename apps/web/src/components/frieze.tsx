/**
 * The white gypsum trim of Old Sana'a's tower houses: a hairline zigzag with a dot in each
 * peak, drawn in cream on the brown band. The room's one Yemeni motif.
 */
export function Frieze() {
  return (
    <svg aria-hidden className="block h-[9px] w-full bg-shell" preserveAspectRatio="none">
      <defs>
        <pattern id="sanaa-frieze" width="16" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 8 L4 2 L8 8 L12 2 L16 8" fill="none" stroke="var(--shell-fg)" strokeOpacity="0.4" strokeWidth="1" />
          <circle cx="4" cy="6.2" r="0.9" fill="var(--qishr)" fillOpacity="0.85" />
          <circle cx="12" cy="6.2" r="0.9" fill="var(--qishr)" fillOpacity="0.85" />
        </pattern>
      </defs>
      <rect width="100%" height="9" fill="url(#sanaa-frieze)" />
    </svg>
  );
}
