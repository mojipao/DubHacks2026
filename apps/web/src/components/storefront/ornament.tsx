/**
 * The drawn parts of a Sana'a tower house: the qamariya fanlight, the white gypsum friezes that
 * frame each floor, and the stepped parapet on the roof. All authored SVG, drawn in the wall's
 * own gypsum white so they read as plaster, not decoration laid on top.
 */

const GLASS = ["#8e2328", "#c9971f", "#3f6b45"];

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (Math.PI * deg) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
}

/** One pane of a ring between two radii and two angles (degrees, 0 = right, 180 = left). */
function pane(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r1, a0);
  const [x1, y1] = polar(cx, cy, r1, a1);
  const [x2, y2] = polar(cx, cy, r0, a1);
  const [x3, y3] = polar(cx, cy, r0, a0);
  return `M${x0} ${y0} A${r1} ${r1} 0 0 0 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 0 1 ${x3} ${y3}Z`;
}

/**
 * The stained-glass half-moon over a Sana'a window. Rings of red, gold, and green glass held in
 * white gypsum tracery; on load the glass warms up once, as if the sun just reached it.
 */
export function Qamariya({ size = "lg", className }: { size?: "lg" | "sm"; className?: string }) {
  const W = 240;
  const cx = 120;
  const cy = 124;
  const rings = size === "lg" ? [0, 34, 74, 112] : [0, 50, 112];
  const counts = size === "lg" ? [1, 6, 10] : [1, 5];
  let n = 0;
  const panes: { d: string; fill: string; i: number }[] = [];
  counts.forEach((count, ring) => {
    for (let k = 0; k < count; k++) {
      const a0 = (180 / count) * k;
      const a1 = (180 / count) * (k + 1);
      panes.push({ d: pane(cx, cy, rings[ring], rings[ring + 1], a0, a1), fill: GLASS[(k + ring) % 3], i: n++ });
    }
  });
  return (
    <svg viewBox={`0 0 ${W} 132`} className={className} aria-hidden>
      <path d={`M${cx - 118} ${cy} A118 118 0 0 1 ${cx + 118} ${cy}Z`} fill="#2b1a10" />
      {panes.map((p) => (
        <path key={p.i} d={p.d} fill={p.fill} className="qamariya-glass" style={{ animationDelay: `${180 + p.i * 70}ms` }} />
      ))}
      {/* Tracery: the gypsum that holds the glass. */}
      <g fill="none" stroke="#fffcf7" strokeLinejoin="round">
        {panes.map((p) => (
          <path key={p.i} d={p.d} strokeWidth={size === "lg" ? 3.2 : 4} />
        ))}
        <path d={`M${cx - 118} ${cy} A118 118 0 0 1 ${cx + 118} ${cy}`} strokeWidth={size === "lg" ? 7 : 9} />
        <path d={`M${cx - 122} ${cy + 2}H${cx + 122}`} strokeWidth={size === "lg" ? 5 : 7} />
      </g>
      {size === "lg" &&
        Array.from({ length: counts[counts.length - 1] }, (_, k) => {
          const step = 180 / counts[counts.length - 1];
          const [x, y] = polar(cx, cy, (rings[rings.length - 2] + rings[rings.length - 1]) / 2, step * (k + 0.5));
          return (
            <g key={`r${k}`}>
              <circle cx={x} cy={y} r={7.5} fill="#fffcf7" />
              <circle cx={x} cy={y} r={4.2} fill={GLASS[(k + 1) % 3]} className="qamariya-glass" style={{ animationDelay: `${300 + k * 70}ms` }} />
            </g>
          );
        })}
      {size === "lg" &&
        Array.from({ length: 15 }, (_, k) => {
          const [x, y] = polar(cx, cy, 126, 6 + k * 12);
          return <circle key={k} cx={x} cy={y} r={2.4} fill="#fffcf7" />;
        })}
    </svg>
  );
}

/** A course of raised brick laid on the diagonal, the way Sana'a masons decorate each floor. */
export function BrickBand({ className }: { className?: string }) {
  return (
    <svg className={`block shrink-0 ${className ?? ""}`} height="16" width="100%" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="brick-band" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M8 2 L14 8 L8 14 L2 8Z" fill="#8a4f2b" />
          <path d="M8 5.5 L10.5 8 L8 10.5 L5.5 8Z" fill="#5a3016" />
        </pattern>
      </defs>
      <rect width="100%" height="16" fill="url(#brick-band)" />
    </svg>
  );
}

/** The plaster band between floors: two rules with a row of triangles and dots between them. */
export function GypsumFrieze({ className, tone = "#fffcf7" }: { className?: string; tone?: string }) {
  const id = `gypsum-frieze-${tone.slice(1)}`;
  return (
    <svg className={className} height="26" width="100%" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id={id} width="24" height="26" patternUnits="userSpaceOnUse">
          <path d="M0 9 L6 17 L12 9 L18 17 L24 9" fill="none" stroke={tone} strokeWidth="2" />
          <circle cx="6" cy="10.5" r="1.6" fill={tone} />
          <circle cx="18" cy="10.5" r="1.6" fill={tone} />
        </pattern>
      </defs>
      <rect y="0" width="100%" height="3" fill={tone} />
      <rect y="4" width="100%" height="18" fill={`url(#${id})`} />
      <rect y="23" width="100%" height="3" fill={tone} />
    </svg>
  );
}

/** The roofline: a white parapet with small stepped merlons, the way Sana'a houses finish. */
export function Parapet({ className }: { className?: string }) {
  return (
    <svg className={className} height="30" width="100%" preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id="parapet" width="34" height="30" patternUnits="userSpaceOnUse">
          <path d="M3 22 V14 H9 V7 H13 V2 H21 V7 H25 V14 H31 V22Z" fill="#fffcf7" />
        </pattern>
      </defs>
      <rect width="100%" height="22" fill="url(#parapet)" />
      <rect y="21" width="100%" height="9" fill="#fffcf7" />
    </svg>
  );
}
