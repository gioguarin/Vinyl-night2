/** The spinning record — Vinyl Night's signature element. */
export default function Vinyl({
  size = 160,
  spinning = true,
  label,
}: {
  size?: number;
  spinning?: boolean;
  label?: string | null;
}) {
  const labelSize = Math.round(size * 0.36);
  const holeSize = Math.max(6, Math.round(size * 0.05));
  return (
    <div
      className={`vinyl relative shrink-0 ${spinning ? "vinyl-spin" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="absolute rounded-full bg-labelred flex items-center justify-center overflow-hidden"
        style={{
          width: labelSize,
          height: labelSize,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {label ? (
          <span
            className="font-mono uppercase text-center leading-tight text-[color:var(--bg)]"
            style={{ fontSize: Math.max(7, Math.round(size * 0.045)) }}
          >
            {label.slice(0, 18)}
          </span>
        ) : null}
        <div
          className="absolute rounded-full bg-bg"
          style={{
            width: holeSize,
            height: holeSize,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>
    </div>
  );
}
