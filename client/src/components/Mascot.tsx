export function Mascot() {
  return (
    <div
      style={{
        width: 140,
        height: 140,
        margin: "0 auto 12px",
      }}
      aria-hidden
    >
      <svg viewBox="0 0 120 120" width="100%" height="100%">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e8eeff" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="72" rx="44" ry="38" fill="url(#g)" stroke="#dbe4ff" strokeWidth="2" />
        <ellipse cx="60" cy="48" rx="28" ry="30" fill="url(#g)" stroke="#dbe4ff" strokeWidth="2" />
        <ellipse cx="48" cy="44" rx="5" ry="7" fill="#1e293b" />
        <ellipse cx="72" cy="44" rx="5" ry="7" fill="#1e293b" />
        <rect x="34" y="36" width="22" height="8" rx="3" fill="none" stroke="#2e5bff" strokeWidth="2.5" />
        <rect x="64" y="36" width="22" height="8" rx="3" fill="none" stroke="#2e5bff" strokeWidth="2.5" />
        <path d="M52 58 Q60 64 68 58" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="42" cy="78" rx="10" ry="7" fill="#f8fafc" stroke="#e2e8f0" />
        <ellipse cx="78" cy="78" rx="10" ry="7" fill="#f8fafc" stroke="#e2e8f0" />
      </svg>
    </div>
  );
}
