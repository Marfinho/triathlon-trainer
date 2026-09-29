#!/usr/bin/env python3
"""
Ergänzt Tailwind-Klassen um passende `dark:`-Varianten (einmaliger Codemod).

Für jede helle Farbklasse (optional mit Varianten-Präfix wie `hover:`) wird
direkt dahinter die dunkle Entsprechung eingefügt, z. B.
`bg-white` → `bg-white dark:bg-neutral-900`. Bereits vorhandene
`dark:`-Klassen werden nicht doppelt ergänzt. Das Skript ist idempotent.

Aufruf: python3 scripts/add-dark-variants.py [Dateien…]
"""
import re
import sys
from pathlib import Path

NEUTRAL = {
    "bg-white": "bg-neutral-900",
    "bg-white/80": "bg-neutral-900/80",
    "bg-neutral-50": "bg-neutral-800/60",
    "bg-neutral-50/50": "bg-neutral-800/30",
    "bg-neutral-50/60": "bg-neutral-800/40",
    "bg-neutral-100": "bg-neutral-800",
    "bg-neutral-200": "bg-neutral-700",
    "bg-neutral-200/70": "bg-neutral-700/70",
    "bg-neutral-300": "bg-neutral-600",
    "bg-gray-50": "bg-neutral-800/60",
    "text-neutral-900": "text-neutral-100",
    "text-gray-900": "text-neutral-100",
    "text-neutral-800": "text-neutral-200",
    "text-neutral-700": "text-neutral-300",
    "text-gray-700": "text-neutral-300",
    "text-neutral-600": "text-neutral-400",
    "text-gray-600": "text-neutral-400",
    "text-neutral-500": "text-neutral-400",
    "text-gray-500": "text-neutral-400",
    "border-neutral-100": "border-neutral-800",
    "border-gray-100": "border-neutral-800",
    "border-neutral-200": "border-neutral-800",
    "border-neutral-200/80": "border-neutral-800",
    "border-neutral-200/70": "border-neutral-800",
    "border-gray-200": "border-neutral-800",
    "border-neutral-300": "border-neutral-700",
    "border-neutral-400": "border-neutral-600",
    "border-white/80": "border-neutral-900/80",
    "divide-neutral-100": "divide-neutral-800",
    "ring-white": "ring-neutral-900",
}

HUES = ("blue red green emerald amber orange yellow rose sky indigo violet "
        "purple teal cyan lime pink fuchsia").split()
HUE_SHADES = {
    "bg": {"50": "950/40", "100": "900/40", "200": "800/60"},
    "from": {"50": "950/40"},
    "to": {"50": "950/40", "100": "900/40"},
    "border": {"100": "900/60", "200": "800", "300": "700"},
    "ring": {"100": "900/60", "200": "800"},
    "text": {"600": "400", "700": "300", "800": "200", "900": "100"},
}

TOKEN = re.compile(
    r"(?<![\w:/\[-])((?:[a-z0-9-]+:)*)"
    r"((?:bg|text|border|ring|divide|from|to)-[a-z]+(?:-\d+)?(?:/\d+)?)(?![\w/\]-])"
)


def dark_for(base: str) -> str | None:
    if base in NEUTRAL:
        return NEUTRAL[base]
    m = re.fullmatch(r"(bg|text|border|ring|from|to)-([a-z]+)-(\d+)(/\d+)?", base)
    if not m:
        return None
    kind, hue, shade, alpha = m.groups()
    if hue not in HUES:
        return None
    target = HUE_SHADES.get(kind, {}).get(shade)
    if not target:
        return None
    # Eigene Transparenz (z. B. /50) auf das dunkle Ziel übertragen.
    if alpha and "/" not in target:
        target += alpha
    return f"{kind}-{hue}-{target}"


def transform_string(s: str) -> str:
    existing = set(re.findall(r"dark:[\w:/.-]+", s))

    def repl(m: re.Match) -> str:
        prefix, base = m.group(1), m.group(2)
        if "dark:" in prefix:
            return m.group(0)
        d = dark_for(base)
        if not d:
            return m.group(0)
        add = f"dark:{prefix}{d}"
        if add in existing:
            return m.group(0)
        existing.add(add)
        return f"{m.group(0)} {add}"

    return TOKEN.sub(repl, s)


STRING = re.compile(r'"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\'|`(?:[^`\\]|\\.)*`')


def transform_file(text: str) -> str:
    return STRING.sub(lambda m: transform_string(m.group(0)), text)


def main() -> None:
    changed = 0
    for arg in sys.argv[1:]:
        p = Path(arg)
        src = p.read_text()
        out = transform_file(src)
        if out != src:
            p.write_text(out)
            changed += 1
    print(f"{changed} Dateien angepasst")


if __name__ == "__main__":
    main()
