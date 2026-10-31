import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayId } from '../db'
import { TYPES, summarise, naira, DAILY_CASH_OUT_LIMIT } from '../money'
import { Diff, InstallBanner, InstallChip, SyncBadge, RoundLink, go, formatDay, dayParts } from '../ui'
import { Icon, TypeBadge } from '../icons'
import { Mascot } from '../mascot'

const SUBTITLES = {
  withdrawal: 'Customer takes cash',
  transfer: 'Customer sends money',
  airtime: 'Airtime & bills',
  cash_in: 'Add cash',
  top_up: 'Top up',
  expense: 'Expense',
}

function TopBar({ standName }) {
  return (
    <div className="topbar">
      <div className="brand">
        <img src="/icon.svg" alt="" width="34" height="34" />
        <div>
          <div className="brand-name">{standName || 'POS Records'}</div>
          <div className="brand-date">{new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </div>
      <div className="topbar-actions">
        <InstallChip />
        <RoundLink icon="gear" label="Settings" to="#/settings" />
      </div>
    </div>
  )
}

export default function Home({ openDay }) {
  const data = useLiveQuery(async () => {
    const machines = await db.machines.toArray()
    const standName = (await db.settings.get('standName'))?.value
    const transactions = openDay ? await db.transactions.where('dayId').equals(openDay.id).toArray() : []
    const lastClosed = openDay ? null : (await db.days.where('status').equals('closed').reverse().sortBy('openedAt'))[0]
    return { machines, standName, transactions, lastClosed }
  }, [openDay?.id])

  if (!data) return null
  const { machines, standName, transactions, lastClosed } = data
  const machine = (id) => machines.find((m) => m.id === id)

  if (!openDay) {
    return (
      <div className="page">
        <TopBar standName={standName} />
        <SyncBadge />
        <InstallBanner />

        <div className="hero hero-start">
          <Mascot mood="sleepy" size={78} className="hero-mascot" />
          <div className="hero-label">Ready when you are</div>
          <h2 className="hero-title">Count your cash and start the day.</h2>
          <button className="btn lime big" onClick={() => go('#/start')}>
            Start day
          </button>
        </div>

        {lastClosed && (
          <button className="card row-link" onClick={() => go(`#/days/${lastClosed.id}`)}>
            <Icon name="calendar" />
            <div>
              <div className="muted small">Last closed · {formatDay(lastClosed.date)}</div>
              <div className="row-figure">
                {naira(lastClosed.profit)} <Diff value={lastClosed.totalDifference} parts={dayParts(lastClosed)} />
              </div>
            </div>
            <Icon name="chevron" size={20} />
          </button>
        )}
        <button className="btn ghost" onClick={() => go('#/days')}>
          All past days
        </button>
      </div>
    )
  }

  const t = summarise(openDay, transactions)
  const machineIds = [...new Set([...Object.keys(openDay.openingBalances || {}), ...Object.keys(t.machines)])]
  const notToday = openDay.date !== todayId()
  const limitUsed = t.cashOut / DAILY_CASH_OUT_LIMIT
  const live = transactions.filter((x) => !x.deleted).length

  return (
    <div className="page has-bottom">
      <TopBar standName={standName} />
      <SyncBadge />

      {notToday && <div className="alert">This day was started on {formatDay(openDay.date)}. Close it before starting a new day.</div>}
      {limitUsed >= 0.8 && (
        <div className="alert">
          Withdrawals today: {naira(t.cashOut)}. That's {Math.round(limitUsed * 100)}% of the CBN daily limit of {naira(DAILY_CASH_OUT_LIMIT)}.
        </div>
      )}

      <div className="hero">
        <Mascot mood={t.profit > 0 ? 'happy' : t.profit < 0 ? 'worried' : 'neutral'} size={66} className="hero-mascot" />
        <div className="hero-label">Profit today</div>
        <div className={`hero-figure ${t.profit < 0 ? 'negative' : ''}`}>{naira(t.profit)}</div>
        <div className="hero-stats">
          <span>
            <b>{naira(t.charges)}</b> charges
          </span>
          <span>
            <b>{naira(t.fees)}</b> fees
          </span>
          {t.expenses > 0 && (
            <span>
              <b>{naira(t.expenses)}</b> spent
            </span>
          )}
        </div>
      </div>

      <div className="pockets">
        <div className="pocket cash">
          <span className="pocket-name">
            <i />
            Cash in drawer
          </span>
          <span className="pocket-figure">{naira(t.cash)}</span>
        </div>
        {machineIds.map((id, i) => (
          <div className={`pocket m${i % 4}`} key={id}>
            <span className="pocket-name">
              <i />
              {machine(id)?.name || 'Machine'}
            </span>
            <span className="pocket-figure">{naira(t.machines[id])}</span>
          </div>
        ))}
      </div>

      <div className="section-label">New transaction</div>
      <div className="tiles-main">
        {['withdrawal', 'transfer'].map((type) => (
          <button key={type} className={`tile t-${type}`} onClick={() => go(`#/add/${type}`)}>
            <TypeBadge type={type} size={44} />
            <span className="tile-title">{TYPES[type].short}</span>
            <span className="tile-sub">{SUBTITLES[type]}</span>
          </button>
        ))}
      </div>
      <div className="tiles-small">
        {['airtime', 'cash_in', 'top_up', 'expense'].map((type) => (
          <button key={type} className={`tile-sm t-${type}`} onClick={() => go(`#/add/${type}`)}>
            <TypeBadge type={type} size={36} />
            <span>{SUBTITLES[type]}</span>
          </button>
        ))}
      </div>

      <div className="bottom-bar two">
        <button className="btn ghost" onClick={() => go('#/history')}>
          <Icon name="history" size={20} /> History {live > 0 && <span className="count">{live}</span>}
        </button>
        <button className="btn ink" onClick={() => go('#/close')}>
          <Icon name="lock" size={20} /> Close day
        </button>
      </div>
    </div>
  )
}
