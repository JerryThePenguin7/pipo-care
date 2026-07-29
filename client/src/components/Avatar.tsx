import { initialsOf } from "../lib/avatar";

type Props = {
  src?: string;
  name: string;
  size?: number;
  /** Ring colour, e.g. when used as a button in the header. */
  ring?: boolean;
};

/** Profile picture with an initials fallback (Google photos can 404 or be absent). */
export function Avatar({ src, name, size = 40, ring = false }: Props) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    objectFit: "cover",
    background: "linear-gradient(135deg, var(--primary), var(--primary-soft))",
    border: ring ? "2px solid var(--border)" : "none",
  };

  if (src) {
    return <img src={src} alt="" style={style} referrerPolicy="no-referrer" />;
  }

  return (
    <div
      style={{
        ...style,
        display: "grid",
        placeItems: "center",
        color: "white",
        fontWeight: 700,
        fontSize: Math.round(size * 0.38),
      }}
      aria-hidden
    >
      {initialsOf(name)}
    </div>
  );
}
