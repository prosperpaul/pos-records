import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { TYPES, naira } from '../money'
import { Header, go, formatDay, formatTime } from '../ui'
import { Icon, TypeBadge } from '../icons'
import { MascotSays } from '../mascot'

export default function History({ dayId }) {
  const [showDeleted, setShowDeleted] = useState(false)
  const data = useLiveQuery(async () => {
    if (!dayId) return { day: null, rows: [], machines: [] }
    return {
      day: await db.days.get(dayId),
      rows: (await db.transactions.where('dayId').equals(dayId).sortBy('createdAt')).reverse(),
      machines: await db.machines.toArray(),
      members: await getSetting('members', []),
    }
  }, [dayId])

  if (!data) return null
  const { day, rows, machines, members = [] } = data
  // Show who entered each record once more than one person uses the stand.
  const who = (id) => (members.length > 1 ? members.find((m) => m.user_id === id)?.name : null)
  const name = (id) => (id === 'outside' ? 'Bank / outside' : id === 'cash' ? 'Cash drawer' : machines.find((m) => m.id === id)?.name)
  const deletedCount = rows.filter((r) => r.deleted).length
  const visible = showDeleted ? rows : rows.filter((r) => !r.deleted)

  return (
    <div className="page">
      <Header title={day ? `History · ${formatDay(day.date)}` : 'History'} />
      {!visible.length && <MascotSays mood="sleepy">Nothing here yet. Your transactions will show up here.</MascotSays>}

      <div className="list">
        {visible.map((tx) => {
          const edited = !tx.deleted && tx.updatedAt - tx.createdAt > 1000
          const where = tx.type === 'cash_in' ? `from ${name(tx.source)}` : tx.type === 'expense' ? tx.note : name(tx.machineId)
          return (
            <button key={tx.id} className={`list-row ${tx.deleted ? 'deleted' : ''}`} onClick={() => go(`#/edit/${tx.id}`)}>
              <TypeBadge type={tx.type} size={42} />
              <div className="list-main">
                <div>
                  <strong>{TYPES[tx.type]?.short}</strong> {naira(tx.amount)}
                  {tx.charge > 0 && <span className="muted"> · +{naira(tx.charge)}</span>}
                </div>
                <div className="muted small">
                  {formatTime(tx.createdAt)}
                  {where && ` · ${where}`}
                  {who(tx.createdBy) && ` · by ${who(tx.createdBy)}`}
                  {edited && <span className="badge">edited</span>}
                  {tx.deleted ? <span className="badge bad">deleted</span> : null}
                </div>
              </div>
              <Icon name="chevron" size={18} className="faint" />
            </button>
          )
        })}
      </div>

      {deletedCount > 0 && (
        <button className="link" onClick={() => setShowDeleted(!showDeleted)}>
          {showDeleted ? 'Hide' : 'Show'} {deletedCount} deleted
        </button>
      )}
    </div>
  )
}
