import type { ArtKind, ProductImage, ScentFamily } from "@/features/catalog/types";
import { cn } from "@/lib/cn";
import { GOLD_HEX, scentHex } from "./scent-colors";

// Drawn placeholder artwork shown until product photography is supplied.
// Each piece is an illustration, not a depiction of a real product.

type Props = {
  art: ArtKind;
  view?: ProductImage["view"];
  family?: ScentFamily;
  uid: string;
  className?: string;
  tagLabel?: string;
  label: string;
  style?: React.CSSProperties;
  // Override the framing, e.g. a tight crop for compositions.
  viewBox?: string;
  // The soft glow behind the object; off for tight crops, where it would clip.
  halo?: boolean;
};

const VIEWBOX: Record<NonNullable<Props["view"]>, string> = {
  front: "0 0 400 500",
  detail: "110 40 180 225",
  context: "-60 -40 520 620",
};

export function ProductArt({
  art,
  view = "front",
  family,
  uid,
  className,
  tagLabel,
  label,
  style,
  viewBox,
  halo = true,
}: Props) {
  const tint = family ? scentHex[family] : GOLD_HEX;
  const id = (name: string) => `${uid}-${name}`;

  return (
    <div className={cn("relative isolate overflow-hidden", className)} style={style}>
      <svg
        viewBox={viewBox ?? VIEWBOX[view]}
        // An empty label marks the art as decorative.
        role={label ? "img" : undefined}
        aria-label={label || undefined}
        aria-hidden={label ? undefined : true}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={id("gold")} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#7a5f33" />
            <stop offset="0.35" stopColor="#ecdcb8" />
            <stop offset="0.55" stopColor="#b69a65" />
            <stop offset="0.78" stopColor="#dcc8a0" />
            <stop offset="1" stopColor="#7a5f33" />
          </linearGradient>
          <linearGradient id={id("body")} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#1f1814" />
            <stop offset="0.42" stopColor="#5a4a40" />
            <stop offset="0.6" stopColor="#3b2f28" />
            <stop offset="1" stopColor="#171210" />
          </linearGradient>
          <linearGradient id={id("glass")} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={tint} stopOpacity="0.55" />
            <stop offset="0.4" stopColor={tint} stopOpacity="0.95" />
            <stop offset="0.62" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor={tint} stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id={id("halo")} cx="0.5" cy="0.42" r="0.6">
            <stop offset="0" stopColor={tint} stopOpacity="0.45" />
            <stop offset="0.6" stopColor={tint} stopOpacity="0.08" />
            <stop offset="1" stopColor={tint} stopOpacity="0" />
          </radialGradient>
          <filter id={id("mist")} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        {view === "context" && <Room />}
        {halo && <ellipse cx="200" cy="230" rx="190" ry="230" fill={`url(#${id("halo")})`} />}
        <ellipse cx="200" cy="452" rx="120" ry="12" fill="#352a24" opacity="0.28" filter={`url(#${id("mist")})`} />

        {art === "diffuser-tower" && <Tower id={id} />}
        {art === "diffuser-compact" && <Compact id={id} />}
        {art === "diffuser-car" && <Car id={id} />}
        {art === "cartridge" && <Cartridge id={id} x={200} scale={1} />}
        {art === "bundle" && (
          <>
            <g transform="translate(-70 30) scale(0.86)">
              <Tower id={id} />
            </g>
            <Cartridge id={id} x={268} scale={0.62} />
            <Cartridge id={id} x={328} scale={0.5} />
          </>
        )}
        {art === "accessory" && <Accessory id={id} />}
      </svg>

      {tagLabel && (
        <span className="pointer-events-none absolute bottom-3 start-3 rounded-full border border-ink/12 bg-canvas/85 px-2.5 py-1 text-[0.625rem] text-ink-soft backdrop-blur-sm">
          {tagLabel}
        </span>
      )}
    </div>
  );
}

type PartProps = { id: (name: string) => string };

function Plume({ id, x, y }: PartProps & { x: number; y: number }) {
  return (
    <g filter={`url(#${id("mist")})`} opacity="0.7">
      <path
        d={`M${x} ${y} C ${x - 24} ${y - 50}, ${x + 30} ${y - 80}, ${x - 6} ${y - 140} S ${x + 40} ${y - 200}, ${x + 10} ${y - 240}`}
        stroke={`url(#${id("glass")})`}
        strokeWidth="16"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M${x + 4} ${y} C ${x + 30} ${y - 40}, ${x - 20} ${y - 90}, ${x + 18} ${y - 150}`}
        stroke="#ecdcb8"
        strokeOpacity="0.35"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

function Tower({ id }: PartProps) {
  return (
    <g>
      <Plume id={id} x={200} y={92} />
      <rect x="150" y="96" width="100" height="330" rx="50" fill={`url(#${id("body")})`} />
      <rect x="150" y="96" width="100" height="330" rx="50" fill="none" stroke={`url(#${id("gold")})`} strokeOpacity="0.5" />
      <rect x="160" y="150" width="80" height="6" rx="3" fill={`url(#${id("gold")})`} />
      <circle cx="200" cy="112" r="9" fill="#1f1814" stroke={`url(#${id("gold")})`} strokeWidth="2" />
      <rect x="132" y="420" width="136" height="26" rx="8" fill={`url(#${id("gold")})`} />
      <rect x="176" y="250" width="48" height="110" rx="24" fill={`url(#${id("glass")})`} opacity="0.55" />
    </g>
  );
}

function Compact({ id }: PartProps) {
  return (
    <g>
      <Plume id={id} x={200} y={196} />
      <rect x="128" y="200" width="144" height="230" rx="72" fill={`url(#${id("body")})`} />
      <rect x="128" y="200" width="144" height="230" rx="72" fill="none" stroke={`url(#${id("gold")})`} strokeOpacity="0.55" />
      <ellipse cx="200" cy="214" rx="26" ry="8" fill="#1f1814" stroke={`url(#${id("gold")})`} strokeWidth="2" />
      <rect x="140" y="300" width="120" height="5" rx="2.5" fill={`url(#${id("gold")})`} />
      <rect x="150" y="424" width="100" height="18" rx="6" fill={`url(#${id("gold")})`} />
    </g>
  );
}

function Car({ id }: PartProps) {
  return (
    <g>
      <Plume id={id} x={200} y={232} />
      <rect x="160" y="236" width="80" height="150" rx="40" fill={`url(#${id("body")})`} />
      <rect x="160" y="236" width="80" height="150" rx="40" fill="none" stroke={`url(#${id("gold")})`} strokeOpacity="0.6" />
      <circle cx="200" cy="252" r="7" fill="#1f1814" stroke={`url(#${id("gold")})`} strokeWidth="2" />
      <rect x="160" y="330" width="80" height="12" fill={`url(#${id("gold")})`} />
      <path d="M186 386 h28 v40 a14 14 0 0 1 -28 0 z" fill={`url(#${id("gold")})`} opacity="0.85" />
    </g>
  );
}

function Cartridge({ id, x, scale }: PartProps & { x: number; scale: number }) {
  return (
    <g transform={`translate(${x} 440) scale(${scale}) translate(-200 -440)`}>
      <rect x="176" y="120" width="48" height="26" rx="6" fill={`url(#${id("gold")})`} />
      <rect x="156" y="144" width="88" height="296" rx="30" fill={`url(#${id("glass")})`} />
      <rect x="156" y="144" width="88" height="296" rx="30" fill="none" stroke="#ffffff" strokeOpacity="0.35" />
      <rect x="168" y="250" width="64" height="90" rx="4" fill="#1f1814" opacity="0.72" />
      <rect x="178" y="268" width="44" height="3" rx="1.5" fill={`url(#${id("gold")})`} />
      <rect x="184" y="280" width="32" height="2" rx="1" fill="#ecdcb8" opacity="0.6" />
      <rect x="166" y="156" width="10" height="260" rx="5" fill="#ffffff" opacity="0.28" />
    </g>
  );
}

function Accessory({ id }: PartProps) {
  return (
    <g>
      <rect x="110" y="220" width="180" height="150" rx="34" fill={`url(#${id("body")})`} />
      <rect x="110" y="220" width="180" height="150" rx="34" fill="none" stroke={`url(#${id("gold")})`} strokeOpacity="0.6" />
      <rect x="128" y="286" width="144" height="4" rx="2" fill={`url(#${id("gold")})`} />
      <circle cx="200" cy="250" r="8" fill={`url(#${id("gold")})`} />
    </g>
  );
}

// A majlis arch behind the object, for the "in a room" view.
function Room() {
  return (
    <g opacity="0.9">
      <rect x="-60" y="-40" width="520" height="620" fill="#eae0d2" />
      <path d="M70 470 V170 a130 130 0 0 1 260 0 V470" fill="#d8c7ae" stroke="#b69a65" strokeOpacity="0.45" />
      <rect x="-60" y="470" width="520" height="110" fill="#cdb99d" />
      <line x1="-60" x2="460" y1="470" y2="470" stroke="#b69a65" strokeOpacity="0.4" />
    </g>
  );
}
