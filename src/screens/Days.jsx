import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { naira } from '../money'
import { Header, Diff, go, formatDay, dayParts } from '../ui'
import { Mascot, MascotSays, closeMood, koboMessage } from '../mascot'
import { Icon } from '../icons'

export default function Days({ dayId }) {
  return dayId ? <DayReport id={dayId} /> : <DayList />
}

function DayList() {
  const days = useLiveQuery(() => db.days.where('status').equals('closed').reverse().sortBy('openedAt'))
  if (!days) return null
  const total = days.slice(0, 7).reduce((s, d) => s + (d.profit || 0), 0)

  return (
    <div className="page">
      <Header title="Past days" onBack={() => go('#/')} />
      {days.length > 0 && (
        <div className="hero">
          <Mascot mood={total > 0 ? 'happy' : total < 0 ? 'worried' : 'neutral'} size={66} className="hero-mascot" />
          <div className="hero-label">{days.length === 1 ? 'Last day' : `Last ${Math.min(days.length, 7)} days`}</div>
          <div className={`hero-figure ${total < 0 ? 'negative' : ''}`}>{naira(total)}</div>
          <div className="hero-stats">
            <span>
              <b>{days.slice(0, 7).filter((d) => dayParts(d).every((v) => v === 0)).length}</b> balanced
            </span>
            <span>
              <b>{days.slice(0, 7).filter((d) => d.totalDifference < 0).length}</b> short
            </span>
          </div>
        </div>
      )}
      {!days.length && <MascotSays mood="sleepy">No closed days yet. Close your first day and it will show here.</MascotSays>}
      <div className="list">
        {days.map((d) => (
          <button key={d.id} className="list-row" onClick={() => go(`#/days/${d.id}`)}>
            <Icon name="calendar" />
            <div className="list-main">
              <strong>{formatDay(d.date)}</strong>
              <div className="small">
                <Diff value={d.totalDifference} parts={dayParts(d)} />
              </div>
            </div>
            <span className={`row-amount ${d.profit < 0 ? 'bad' : ''}`}>{naira(d.profit)}</span>
            <Icon name="chevron" size={18} className="faint" />
          </button>
        ))}
      </div>
    </div>
  )
}

function DayReport({ id }) {
  const data = useLiveQuery(async () => ({ day: await db.days.get(id), machines: await db.machines.toArray() }), [id])
  if (!data) return null
  const { day, machines } = data
  if (!day) return <Header title="Day not found" />
  const name = (mid) => machines.find((m) => m.id === mid)?.name || 'Machine'
  const parts = dayParts(day)

  if (day.status !== 'closed') {
    return (
      <div className="page">
        <Header title={formatDay(day.date)} />
        <p>This day is still open.</p>
      </div>
    )
  }

  const line = (label, expected, counted, diff) => (
    <div className="card" key={label}>
      <div className="summary-line">
        <strong>{label}</strong>
        <Diff value={diff} />
      </div>
      <div className="summary-line muted small">
        <span>Expected {naira(expected)}</span>
        <span>Counted {naira(counted)}</span>
      </div>
    </div>
  )

  return (
    <div className="page">
      <Header title={formatDay(day.date)} onBack={() => go('#/days')} />
      <div className="card profit">
        <div className="muted">Profit</div>
        <div className={`profit-value ${day.profit < 0 ? 'negative' : ''}`}>{naira(day.profit)}</div>
        <div className="muted small">
          {day.count} transactions · charges {naira(day.charges)} · fees {naira(day.fees)}
          {day.expenses ? ` · expenses ${naira(day.expenses)}` : ''}
        </div>
      </div>

      <MascotSays mood={closeMood(day.totalDifference, parts)}>{koboMessage(day.totalDifference, parts)}</MascotSays>
      <h2>
        Overall: <Diff value={day.totalDifference} parts={parts} />
      </h2>
      {line('Cash in drawer', day.expectedCash, day.closingCash, day.cashDifference)}
      {Object.keys(day.expectedBalances || {}).map((mid) =>
        line(name(mid), day.expectedBalances[mid], day.closingBalances[mid], day.machineDifferences[mid]),
      )}

      <button className="btn secondary" onClick={() => go(`#/history/${day.id}`)}>
        See transactions
      </button>
      <button className="btn primary" onClick={() => go('#/')}>
        Done
      </button>
    </div>
  )
}
