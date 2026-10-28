import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { summarise, naira } from '../money'
import { Header, MoneyInput, Diff, go } from '../ui'
import { MascotSays, closeMood, koboMessage } from '../mascot'

export default function CloseDay({ day }) {
  const data = useLiveQuery(async () => ({
    machines: await db.machines.toArray(),
    transactions: await db.transactions.where('dayId').equals(day.id).toArray(),
  }), [day.id])
  const [cash, setCash] = useState(null)
  const [balances, setBalances] = useState({})

  if (!data) return null
  const t = summarise(day, data.transactions)
  const machineIds = [
    ...new Set([
      ...Object.keys(day.openingBalances || {}),
      ...Object.keys(t.machines),
      ...data.machines.filter((m) => m.active).map((m) => m.id),
    ]),
  ]
  const name = (id) => data.machines.find((m) => m.id === id)?.name || 'Machine'
  const counted = (id) => balances[id] ?? null
  const allEntered = cash != null && machineIds.every((id) => counted(id) != null)

  const cashDiff = (cash ?? 0) - t.cash
  const machineDiffs = Object.fromEntries(machineIds.map((id) => [id, (counted(id) ?? 0) - (t.machines[id] || 0)]))
  const totalDifference = cashDiff + Object.values(machineDiffs).reduce((s, v) => s + v, 0)

  async function close() {
    if (!allEntered) return
    if (!confirm('Close the day? You won\'t be able to add or change transactions for this day.')) return
    await db.days.update(day.id, {
      status: 'closed',
      closedAt: Date.now(),
      updatedAt: Date.now(),
      closingCash: cash,
      closingBalances: Object.fromEntries(machineIds.map((id) => [id, counted(id)])),
      expectedCash: t.cash,
      expectedBalances: Object.fromEntries(machineIds.map((id) => [id, t.machines[id] || 0])),
      cashDifference: cashDiff,
      machineDifferences: machineDiffs,
      totalDifference,
      profit: t.profit,
      charges: t.charges,
      fees: t.fees,
      expenses: t.expenses,
      count: t.count,
      synced: 0,
    })
    go(`#/days/${day.id}`)
  }

  const row = (label, expected, value, onChange) => (
    <div className="card close-row">
      <MoneyInput label={`${label}: count it`} value={value ?? 0} onChange={onChange} />
      <div className="close-figures">
        <span className="muted">Expected {naira(expected)}</span>
        {value != null && <Diff value={value - expected} />}
      </div>
    </div>
  )

  return (
    <div className="page has-bottom">
      <Header title="Close day" />
      <p className="muted">Count your cash and check each machine's balance on the machine.</p>

      {row('Cash in drawer', t.cash, cash, setCash)}
      {machineIds.map((id) => row(name(id), t.machines[id] || 0, counted(id), (v) => setBalances({ ...balances, [id]: v })))}

      {allEntered ? (
        <MascotSays mood={closeMood(totalDifference, [cashDiff, ...Object.values(machineDiffs)])}>
          {koboMessage(totalDifference, [cashDiff, ...Object.values(machineDiffs)])}
        </MascotSays>
      ) : (
        <MascotSays mood="thinking">Count everything and I'll tell you if it adds up.</MascotSays>
      )}

      <div className="card">
        <div className="summary-line">
          <span>Charges</span>
          <span>{naira(t.charges)}</span>
        </div>
        <div className="summary-line">
          <span>Provider fees</span>
          <span>−{naira(t.fees)}</span>
        </div>
        {t.expenses > 0 && (
          <div className="summary-line">
            <span>Expenses</span>
            <span>−{naira(t.expenses)}</span>
          </div>
        )}
        <div className="summary-line total">
          <span>Profit</span>
          <span>{naira(t.profit)}</span>
        </div>
        {allEntered && (
          <div className="summary-line total">
            <span>Overall</span>
            <Diff value={totalDifference} parts={[cashDiff, ...Object.values(machineDiffs)]} />
          </div>
        )}
      </div>

      <div className="bottom-bar">
        <button className="btn dark" disabled={!allEntered} onClick={close}>
          {allEntered ? 'Close day' : 'Enter all the figures to close'}
        </button>
      </div>
    </div>
  )
}
