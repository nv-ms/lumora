export function Poster({ title, hue, aspect = "poster", size = "md" }) {
  const bg = `oklch(0.32 0.06 ${hue})`;
  const fg = `oklch(0.82 0.08 ${hue})`;
  return (
    <div className={`relative w-full overflow-hidden ${aspect === "poster" ? "aspect-[2/3]" : "aspect-video"} rounded-md ring-1 ring-hairline`} style={{ backgroundColor: bg }}>
      <div className="absolute inset-0 flex items-end p-3">
        <div className={`${size === "lg" ? "text-2xl" : size === "sm" ? "text-xs" : "text-base"} font-semibold leading-tight`} style={{ color: fg }}>{title}</div>
      </div>
    </div>
  );
}