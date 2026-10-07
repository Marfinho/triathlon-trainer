import type { WeatherKind } from "@/domain/training/weather";

const SUN = "#F59E0B";
const CLOUD = "#94A3B8";
const RAIN = "#3B82F6";

function Cloud({ x = 0, y = 0, fill = CLOUD }: { x?: number; y?: number; fill?: string }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M17 38a8 8 0 0 1 1-16 11 11 0 0 1 21 3 7 7 0 0 1-1 13z"
      fill={fill}
    />
  );
}

/** Einfaches SVG-Wettersymbol (Größe über `size`). */
export function WeatherIcon({ kind, size = 48 }: { kind: WeatherKind; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={kind}>
      {kind === "clear" && (
        <g>
          <circle cx="24" cy="24" r="9" fill={SUN} />
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1="24"
              y1="6"
              x2="24"
              y2="10"
              stroke={SUN}
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${i * 45} 24 24)`}
            />
          ))}
        </g>
      )}
      {kind === "partly" && (
        <g>
          <circle cx="18" cy="18" r="8" fill={SUN} />
          <Cloud y={2} />
        </g>
      )}
      {kind === "cloudy" && <Cloud y={2} />}
      {kind === "fog" && (
        <g stroke={CLOUD} strokeWidth="3" strokeLinecap="round">
          <line x1="8" y1="16" x2="40" y2="16" />
          <line x1="12" y1="24" x2="44" y2="24" />
          <line x1="8" y1="32" x2="40" y2="32" />
        </g>
      )}
      {(kind === "rain" || kind === "storm" || kind === "snow") && (
        <g>
          <Cloud y={-6} fill={kind === "storm" ? "#64748B" : CLOUD} />
          {kind === "rain" && (
            <g stroke={RAIN} strokeWidth="3" strokeLinecap="round">
              <line x1="16" y1="34" x2="13" y2="42" />
              <line x1="25" y1="34" x2="22" y2="42" />
              <line x1="34" y1="34" x2="31" y2="42" />
            </g>
          )}
          {kind === "storm" && <path d="M26 28l-7 10h5l-3 8 10-12h-6z" fill={SUN} />}
          {kind === "snow" && (
            <g fill="#60A5FA">
              <circle cx="16" cy="38" r="2.5" />
              <circle cx="25" cy="42" r="2.5" />
              <circle cx="34" cy="38" r="2.5" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
