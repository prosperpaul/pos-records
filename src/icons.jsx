// Small line icons, drawn inline so they work offline and take no extra downloads.
const PATHS = {
  back: <path d="M15 5l-7 7 7 7" />,
  gear: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </>
  ),
  withdrawal: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 1.5v3M10.3 3.2L12 4.9l1.7-1.7" />
    </>
  ),
  transfer: (
    <>
      <path d="M4 8h14M14 4l4 4-4 4" />
      <path d="M20 16H6M10 12l-4 4 4 4" />
    </>
  ),
  airtime: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18h3" />
    </>
  ),
  cash_in: (
    <>
      <rect x="2" y="5.5" width="13" height="9" rx="2" />
      <circle cx="8.5" cy="10" r="1.8" />
      <path d="M19 12.5v8M15 16.5h8" />
    </>
  ),
  top_up: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="2.5" />
      <path d="M12 2.5v9M8.5 6L12 2.5 15.5 6" />
    </>
  ),
  expense: (
    <>
      <path d="M6 2.5h12v19l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 018 0v2.5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cloud: <path d="M7 18.5h10.5a4 4 0 00.6-7.95A6 6 0 006.4 9.6 4.5 4.5 0 007 18.5z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0M16 5.2a3.5 3.5 0 010 6.6M18 14.2a6.5 6.5 0 013.5 5.8" />
    </>
  ),
  chevron: <path d="M9 5l7 7-7 7" />,
}

export function Icon({ name, size = 24, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

// A transaction type's icon on its own coloured disc.
export function TypeBadge({ type, size = 44 }) {
  return (
    <span className={`type-badge t-${type}`} style={{ width: size, height: size }}>
      <Icon name={type} size={Math.round(size * 0.52)} />
    </span>
  )
}
