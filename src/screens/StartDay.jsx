import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, todayId } from '../db'
import { Header, MoneyInput, go } from '../ui'
import { MascotSays } from '../mascot'

export default function StartDay() {
  const machines = useLiveQuery(() => db.machines.filter((m) => m.active).sortBy('order'))
  const [cash, setCash] = useState(0)
  const [balances, setBalances] = useState({})
  const [prefilled, setPrefilled] = useState(false)

  // Start from what was counted at the last close, so the agent only fixes what changed overnight.
  useEffect(() => {
    db.days
      .where('status')
      .equals('closed')
      .reverse()
      .sortBy('openedAt')
      .then(([last]) => {
        if (!last) return
        setCash(last.closingCash || 0)
        setBalances(last.closingBalances || {})
        setPrefilled(true)
      })
  }, [])

  async function start() {
    const now = Date.now()
    const openingBalances = Object.fromEntries((machines || []).map((m) => [m.id, balances[m.id] || 0]))
    // Each day gets a random id so days started on different phones of the same stand never clash.
    await db.days.add({
      id: newId(),
      date: todayId(),
      status: 'open',
      openedAt: now,
      updatedAt: now,
      openingCash: cash,
      openingBalances,
      synced: 0,
    })
    go('#/')
  }

  if (!machines) return null
  return (
    <div className="page has-bottom">
      <Header title="Start day" onBack={() => go('#/')} />
      <MascotSays mood="happy">
        {prefilled
          ? "Good morning! I've put in what you counted last night. Just fix anything that changed."
          : "Good morning! Count the cash in your drawer and check each machine's balance."}
      </MascotSays>
      <MoneyInput label="Cash in drawer" value={cash} onChange={setCash} />
      {machines.map((m) => (
        <MoneyInput
          key={m.id}
          label={`${m.name} balance`}
          value={balances[m.id] || 0}
          onChange={(v) => setBalances({ ...balances, [m.id]: v })}
        />
      ))}
      <div className="bottom-bar">
        <button className="btn primary" onClick={start}>
          Start day
        </button>
      </div>
    </div>
  )
}
