import { cn } from "../lib/utils";

export function Poster({ title, hue, aspect = "poster", className, size = "md" }) {
  const initials = title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  const bg = `oklch(0.32 0.06 ${hue})`;
  const fg = `oklch(0.82 0.08 ${hue})`;
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        aspect === "poster" ? "aspect-[2/3]" : "aspect-video",
        "rounded-md ring-1 ring-hairline",
        className,
      )}
      style={{ backgroundColor: bg }}
    >
      <div className="absolute inset-0 flex items-end p-3">
        <div>
          <div
            className={cn(
              "font-semibold leading-tight",
              size === "lg" ? "text-2xl" : size === "sm" ? "text-xs" : "text-base",
            )}
            style={{ color: fg }}
          >
            {title}
          </div>
        </div>
      </div>
      <div
        className="absolute right-3 top-3 text-[10px] font-mono uppercase tracking-widest"
        style={{ color: fg, opacity: 0.55 }}
      >
        {initials}
      </div>
    </div>
  );
}

