interface AvatarProps {
  login?: string;
  size?: number;
  className?: string;
}

export function Avatar({ login, size = 36, className }: AvatarProps) {
  const url = login ? `https://github.com/${encodeURIComponent(login)}.png?size=${size * 2}` : null;
  const initials = (login || "?").slice(0, 1).toUpperCase();
  return (
    <span
      className={`avatar${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
    </span>
  );
}
