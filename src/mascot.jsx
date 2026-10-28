import { naira } from './money'

// Kobo, the app's mascot: a little POS machine whose screen is its face.
// Drawn as inline SVG so it costs nothing to download and works offline.
//
// moods: neutral, happy, wave, celebrate, worried, thinking, sleepy

const INK = '#15181d'
const BODY = '#fff1cc'
const BODY_SHADE = '#f1dca4'
const SCREEN = '#0f3d2e'
const GLOW = '#c9f158'

// Arms are drawn twice, thick ink under a thinner body colour, so they look outlined.
function Arm({ d }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={INK} strokeWidth="11" />
      <path d={d} stroke={BODY} strokeWidth="5.5" />
    </g>
  )
}

const ARMS = {
  neutral: { left: 'M18 90q-11 6-9 20', right: 'M102 90q11 6 9 20', hands: [[9, 112], [111, 112]] },
  wave: { left: 'M18 90q-11 6-9 20', right: 'M102 86q16-6 14-30', hands: [[9, 112], [116, 54]] },
  celebrate: { left: 'M18 86q-16-6-14-30', right: 'M102 86q16-6 14-30', hands: [[4, 54], [116, 54]] },
  worried: { left: 'M18 92q-10-6-6-26', right: 'M102 92q10-6 6-26', hands: [[13, 64], [107, 64]] },
}

function Face({ mood }) {
  const g = { stroke: GLOW, strokeWidth: 3.6, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
  const openEyes = (
    <>
      <ellipse cx="48" cy="55" rx="4.6" ry="5.8" fill={GLOW} stroke="none" />
      <ellipse cx="72" cy="55" rx="4.6" ry="5.8" fill={GLOW} stroke="none" />
      <circle cx="49.6" cy="53" r="1.5" fill={SCREEN} stroke="none" />
      <circle cx="73.6" cy="53" r="1.5" fill={SCREEN} stroke="none" />
    </>
  )
  switch (mood) {
    case 'happy':
    case 'wave':
    case 'celebrate':
      return (
        <g {...g}>
          <path d="M43 57q5-8 10 0M67 57q5-8 10 0" />
          <path d="M51 64q9 9 18 0z" fill={GLOW} />
        </g>
      )
    case 'worried':
      return (
        <g {...g}>
          {openEyes}
          <path d="M42 47l9-3.5M78 47l-9-3.5" />
          <path d="M52 70q8-6 16 0" />
        </g>
      )
    case 'thinking':
      return (
        <g {...g}>
          {openEyes}
          <path d="M67 44q5-4 10 0" />
          <path d="M53 68h12" />
        </g>
      )
    case 'sleepy':
      return (
        <g {...g}>
          <path d="M43 57q5 4 10 0M67 57q5 4 10 0" />
          <ellipse cx="60" cy="67" rx="3" ry="3.6" />
        </g>
      )
    default:
      return (
        <g {...g}>
          {openEyes}
          <path d="M53 66q7 5 14 0" />
        </g>
      )
  }
}

export function Mascot({ mood = 'neutral', size = 96, className = '', ground = false }) {
  const arms = ARMS[mood] || ARMS.neutral
  return (
    <svg
      className={`mascot mood-${mood} ${className}`}
      width={size}
      height={(size * 162) / 132}
      viewBox="-6 -10 132 162"
      aria-hidden="true"
    >
      {ground && <ellipse cx="60" cy="146" rx="40" ry="5" fill={INK} opacity="0.12" />}

      {/* receipt sliding out of the top */}
      <g transform="rotate(-4 60 14)">
        <path d="M40 24V0l5 3 5-3 5 3 5-3 5 3 5-3 5 3 5-3v24z" fill="#fffdf8" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M47 11h26M47 17h16" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      </g>

      {/* shoes */}
      <rect x="30" y="130" width="24" height="12" rx="6" fill={INK} />
      <rect x="66" y="130" width="24" height="12" rx="6" fill={INK} />

      <Arm d={arms.left} />
      <Arm d={arms.right} />

      {/* body */}
      <rect x="16" y="20" width="88" height="116" rx="26" fill={BODY} stroke={INK} strokeWidth="4" />
      <path d="M30 27h60" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M26 122q34 12 68 0" fill="none" stroke={BODY_SHADE} strokeWidth="5" strokeLinecap="round" />

      {/* screen face */}
      <rect x="25" y="35" width="70" height="48" rx="13" fill={SCREEN} stroke={INK} strokeWidth="3.5" />
      <path d="M31 44q2-5 8-5" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" fill="none" />
      <Face mood={mood} />
      {mood !== 'sleepy' && (
        <>
          <ellipse cx="35" cy="68" rx="5" ry="3" fill="#ff8f80" opacity="0.75" />
          <ellipse cx="85" cy="68" rx="5" ry="3" fill="#ff8f80" opacity="0.75" />
        </>
      )}

      {/* keypad: two rows of keys, then cancel / clear / enter like a real terminal */}
      <g stroke={INK} strokeWidth="2.4">
        {[90, 103].map((y) =>
          [0, 1, 2].map((c) => <rect key={`${y}${c}`} x={30 + c * 22} y={y} width="16" height="9" rx="4" fill="#fffdf8" />),
        )}
        <rect x="30" y="116" width="16" height="9" rx="4" fill="#ff7a6b" />
        <rect x="52" y="116" width="16" height="9" rx="4" fill="#f8c94a" />
        <rect x="74" y="116" width="16" height="9" rx="4" fill="#5cc977" />
      </g>

      {arms.hands.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill={BODY} stroke={INK} strokeWidth="3.2" />
      ))}

      {mood === 'worried' && <path d="M108 26q-6 9 0 13q6-4 0-13z" fill="#7cc4ff" stroke={INK} strokeWidth="2.4" />}
      {mood === 'sleepy' && (
        <g fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M100 8h9l-9 10h9" />
          <path d="M113 -6h6l-6 7h6" />
        </g>
      )}
      {mood === 'celebrate' && (
        <g stroke={INK} strokeWidth="2.2">
          <rect x="-4" y="22" width="8" height="8" fill="#ff8f80" transform="rotate(20 0 26)" />
          <rect x="114" y="20" width="8" height="8" fill="#7cc4ff" transform="rotate(-15 118 24)" />
          <circle cx="102" cy="2" r="4" fill="#f8c94a" />
          <circle cx="14" cy="4" r="3.5" fill={GLOW} />
        </g>
      )}
      {mood === 'thinking' && (
        <text x="104" y="22" fontFamily="Bricolage Grotesque Variable, sans-serif" fontWeight="800" fontSize="26" fill={INK}>
          ?
        </text>
      )}
    </svg>
  )
}

// Kobo with a comic speech bubble.
export function MascotSays({ mood, children, size = 84 }) {
  return (
    <div className="mascot-says">
      <Mascot mood={mood} size={size} ground />
      <div className="bubble">{children}</div>
    </div>
  )
}

// What Kobo says after the day is counted. `parts` are the differences for cash and each
// machine: they can cancel out (one machine over, another short), which still needs checking.
export function koboMessage(difference, parts = []) {
  const mismatched = parts.filter((v) => v !== 0).length
  if (difference === 0 && mismatched === 0) return 'Balanced! Every naira is where it should be.'
  if (difference === 0) return "The total adds up, but some machines don't match. A transaction may be on the wrong machine."
  if (difference < 0) return `You're short ${naira(-difference)}. Check History for a missing or wrong entry.`
  return `You have ${naira(difference)} extra. Maybe a transaction wasn't recorded.`
}

// How Kobo looks after the day is counted.
export function closeMood(difference, parts = []) {
  if (difference === 0 && parts.every((v) => v === 0)) return 'celebrate'
  if (difference < 0) return 'worried'
  return 'thinking'
}
