import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Pop-Farbe des Icon-Punkts (Tailwind-Klasse). */
  dot?: string;
};

/** Icons füllen ihren Container – die Größe bestimmt der Aufrufer. */
const iconProps = {
  className: "h-full w-full",
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Heute",
    dot: "bg-coral",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    href: "/week",
    label: "Woche",
    dot: "bg-sky-pop",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4.5" width="18" height="16" rx="4" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        <path d="M8 14h2M14 14h2M8 17h2" />
      </svg>
    ),
  },
  {
    href: "/race",
    label: "Wettkampf",
    dot: "bg-sun",
    icon: (
      <svg {...iconProps}>
        <path d="M5 21V4M5 4c3-2 6 2 9 0s4-1 5 0v9c-1-1-2-2-5 0s-6-2-9 0" />
      </svg>
    ),
  },
  {
    href: "/coach",
    label: "Coach",
    dot: "bg-brand",
    icon: (
      <svg {...iconProps}>
        <path d="M20 12a8 8 0 0 1-11.6 7.15L4 20l.85-4.4A8 8 0 1 1 20 12Z" />
        <path d="M9 11h.01M12 11h.01M15 11h.01" />
      </svg>
    ),
  },
  {
    href: "/trainer",
    label: "Trainer",
    dot: "bg-lime-pop",
    icon: (
      <svg {...iconProps}>
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="M6 17l4-7h4l4 7M10 10l2-3h3" />
      </svg>
    ),
  },
  {
    href: "/body",
    label: "Körper",
    dot: "bg-bubblegum",
    icon: (
      <svg {...iconProps}>
        <path d="M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 7.5 6.3Z" />
        <path d="M7 12h2.5l1.5-2.5 2 5 1.5-2.5H17" />
      </svg>
    ),
  },
  {
    href: "/more",
    label: "Extras",
    dot: "bg-neutral-400",
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2.2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2.2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2.2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2.2" />
      </svg>
    ),
  },
];

export const ADMIN_ICON = (
  <svg {...iconProps}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const MENU_ICON = (
  <svg {...iconProps}>
    <circle cx="5" cy="12" r="1.3" />
    <circle cx="12" cy="12" r="1.3" />
    <circle cx="19" cy="12" r="1.3" />
  </svg>
);

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function initialsOf(name?: string | null, email?: string | null): string {
  return (name || email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Runder Avatar mit Verlauf und Initialen. */
export function Avatar({ initials, size = "h-9 w-9 text-xs" }: { initials: string; size?: string }) {
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-coral via-bubblegum to-brand font-bold text-white ${size}`}
    >
      {initials}
    </div>
  );
}

/** Wortmarke mit farbigem „Blob"-Logo. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex h-7 w-7 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rotate-12 rounded-[10px] bg-brand" />
        <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-lime-pop ring-2 ring-[var(--background)]" />
        <span className="relative text-[13px] font-extrabold leading-none text-white">B</span>
      </span>
      <span className="font-[family-name:var(--font-display-sans)] text-lg font-bold tracking-tight text-neutral-900">
        Brick
      </span>
    </span>
  );
}
