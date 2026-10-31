import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting } from './db'
import { useSyncStatus, syncNow, unsyncedCount } from './cloud'
import { naira, toNumber } from './money'
import { useInstall, installSteps } from './install'
import { Icon } from './icons'
import { Mascot } from './mascot'

export function go(path) {
  location.hash = path
}

export function back(fallback = '#/') {
  if (history.length > 1) history.back()
  else go(fallback)
}

export function Header({ title, onBack, right, tone }) {
  return (
    <header className={`header ${tone || ''}`}>
      {onBack !== false && (
        <button className="round-btn" onClick={onBack || (() => back())} aria-label="Back">
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      <div className="header-right">{right}</div>
    </header>
  )
}

export function RoundLink({ icon, label, to }) {
  return (
    <button className="round-btn" onClick={() => go(to)} aria-label={label}>
      <Icon name={icon} />
    </button>
  )
}

// A naira field that shows commas while typing and opens the number keypad.
// variant: undefined (boxed), "hero" (one big amount) or "row" (label left, small box right).
export function MoneyInput({ label, value, onChange, autoFocus, hint, variant }) {
  const input = (
    <div className="money-input">
      <span className="naira">₦</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value ? value.toLocaleString('en-NG') : ''}
        placeholder="0"
        onChange={(e) => onChange(toNumber(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
  if (variant === 'row') {
    return (
      <label className="field field-row">
        <span className="field-label">{label}</span>
        {input}
      </label>
    )
  }
  return (
    <label className={`field ${variant === 'hero' ? 'field-hero' : ''}`}>
      <span className="field-label">{label}</span>
      {input}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Choice({ options, value, onChange }) {
  return (
    <div className="choice">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? 'choice-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// `parts` (optional): the separate differences for cash and each machine. When they cancel
// out to zero overall, the day isn't really balanced, so say so.
export function Diff({ value, parts }) {
  if (value === 0 && parts?.some((v) => v)) return <span className="pill warn">Machines don't match</span>
  if (value === 0) return <span className="pill ok">Balanced</span>
  if (value < 0) return <span className="pill bad">Short {naira(-value)}</span>
  return <span className="pill warn">Excess {naira(value)}</span>
}

// Edits a fee or charge table: "up to ₦X → ₦Y", with a final "above" row.
export function TierEditor({ tiers, onChange }) {
  // Rows are not re-sorted while typing (the cursor would jump); fromTiers sorts when it reads them.
  const rows = tiers
  const update = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i) => onChange(rows.filter((_, j) => j !== i))
  const add = () => {
    const limited = rows.filter((r) => r.upTo != null)
    const top = Math.max(0, ...limited.map((r) => r.upTo))
    onChange([...limited, { upTo: top + 5000, fee: 0 }, ...rows.filter((r) => r.upTo == null)])
  }
  return (
    <div className="tiers">
      {rows.map((r, i) => (
        <div className="tier" key={i}>
          {r.upTo == null ? (
            <span className="tier-label">Above that</span>
          ) : (
            <span className="tier-label">
              Up to
              <input inputMode="numeric" value={r.upTo.toLocaleString('en-NG')} onChange={(e) => update(i, { upTo: toNumber(e.target.value) })} />
            </span>
          )}
          <span className="tier-label">
            ₦
            <input inputMode="numeric" value={r.fee.toLocaleString('en-NG')} onChange={(e) => update(i, { fee: toNumber(e.target.value) })} />
          </span>
          {r.upTo != null && (
            <button className="link danger" onClick={() => remove(i)} aria-label="Remove">
              ✕
            </button>
          )}
        </div>
      ))}
      <button className="link" onClick={add}>
        + Add a level
      </button>
    </div>
  )
}

// `always` shows instructions even when Chrome hasn't offered an install yet (used in Settings).
export function InstallBanner({ always }) {
  const { installed, canPrompt, secure, install } = useInstall()
  if (installed) return always ? <p className="muted small">The app is installed on this phone.</p> : null
  if (canPrompt) {
    return (
      <div className="install">
        <img src="/icon.svg" alt="" width="32" height="32" />
        <div>
          <strong>Install the app</strong>
          <div className="muted small">Works without data</div>
        </div>
        <button className="btn primary" onClick={install}>
          Install
        </button>
      </div>
    )
  }
  if (!always) return null
  if (!secure) return <p className="muted small">This link is not secure (http), so the app can't be installed from it. Open the https link instead.</p>
  const { title, steps } = installSteps()
  return (
    <div>
      <strong>{title}</strong>
      <ol className="steps">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  )
}

// A small Install button shown on the first screens and home until the app is installed. If the
// browser offers its own install pop-up we use it; otherwise we show the steps for this phone.
export function InstallChip() {
  const { installed, canPrompt, install } = useInstall()
  const [sheet, ask] = useConfirm()
  if (installed || !window.isSecureContext) return null
  const onInstall = () => {
    if (canPrompt) return install()
    const { title, steps } = installSteps()
    ask({ title, message: steps, confirm: 'Got it', cancel: false, mood: 'wave' })
  }
  return (
    <>
      <button className="install-chip" onClick={onInstall}>
        Install
      </button>
      {sheet}
    </>
  )
}

// One line under the header telling a logged-in user whether their records are backed up.
export function SyncBadge() {
  const status = useSyncStatus()
  const info = useLiveQuery(async () => ({ account: await getSetting('account', null), waiting: await unsyncedCount() }))
  if (!info?.account) return null
  const { waiting } = info
  let text
  let tone = 'quiet'
  if (status.state === 'syncing') text = 'Backing up…'
  else if (status.state === 'offline' || !navigator.onLine) text = waiting ? `Offline · ${waiting} waiting to back up` : 'Offline · everything is saved on this phone'
  else if (status.state === 'error') {
    text = `Backup failed: ${status.error}. Tap to try again.`
    tone = 'bad'
  } else if (waiting) text = `${waiting} waiting to back up`
  else if (status.lastSync) {
    text = `Backed up ${formatTime(status.lastSync)}`
    tone = 'good'
  }
  else text = 'Connecting…'
  return (
    <button className={`sync-badge ${tone}`} onClick={() => syncNow()}>
      <span className="sync-dot" />
      {text}
    </button>
  )
}

// The separate differences recorded when a day was closed.
export function dayParts(day) {
  return [day?.cashDifference || 0, ...Object.values(day?.machineDifferences || {})]
}

// An in-app "Are you sure?" sheet, used instead of the browser's plain confirm() pop-up.
//   const [sheet, ask] = useConfirm()
//   if (await ask({ title, message, confirm: 'Delete', tone: 'danger', mood: 'worried' })) …
//   …and render {sheet} somewhere in the screen. `cancel: false` shows only the main button.
//   `message` can be text or a list of steps (array).
export function useConfirm() {
  const [request, setRequest] = useState(null)
  const ask = (options) => new Promise((resolve) => setRequest({ ...options, resolve }))
  const answer = (yes) => {
    request.resolve(yes)
    setRequest(null)
  }
  const sheet = request && (
    <div className="sheet-backdrop" onClick={() => answer(false)}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <Mascot mood={request.mood || 'thinking'} size={58} />
          <div>
            <h2 id="sheet-title">{request.title}</h2>
            {Array.isArray(request.message) ? (
              <ol className="steps">
                {request.message.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : (
              request.message && <p className="muted">{request.message}</p>
            )}
          </div>
        </div>
        <div className="sheet-actions">
          {request.cancel !== false && (
            <button className="btn ghost" onClick={() => answer(false)}>
              {request.cancel || 'Cancel'}
            </button>
          )}
          <button className={`btn ${request.tone || 'primary'}`} onClick={() => answer(true)} autoFocus>
            {request.confirm || 'Yes'}
          </button>
        </div>
      </div>
    </div>
  )
  return [sheet, ask]
}

export function useToast() {
  const [msg, setMsg] = useState(null)
  const show = (text) => {
    setMsg(text)
    clearTimeout(show.t)
    show.t = setTimeout(() => setMsg(null), 2200)
  }
  return [msg && <div className="toast">{msg}</div>, show]
}

export function formatDay(id) {
  const [y, m, d] = id.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
}

// 2348031234567 → 0803 123 4567
export function formatPhone(digits) {
  const d = String(digits || '')
  if (!/^234\d{10}$/.test(d)) return d
  const local = '0' + d.slice(3)
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
}

export function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })
}
