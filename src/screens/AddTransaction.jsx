import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, saveTransaction, deleteTransaction } from '../db'
import { TYPES, QUICK_AMOUNTS, fromTiers, naira } from '../money'
import { Header, MoneyInput, Choice, back, go, useToast, useConfirm, formatTime } from '../ui'
import { TypeBadge } from '../icons'

function remembered(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage: the default machine just won't be remembered.
  }
}

export default function AddTransaction({ type: typeParam, editId, day }) {
  const data = useLiveQuery(async () => ({
    // In setup order, so the first machine you added is picked by default.
    machines: (await db.machines.toArray()).sort((x, y) => (x.order ?? 0) - (y.order ?? 0)),
    charges: await getSetting('charges', []),
    existing: editId ? await db.transactions.get(editId) : null,
    audit: editId ? await db.audit.where('txId').equals(editId).sortBy('at') : [],
  }), [editId])

  if (!data) return null
  if (editId && !data.existing) return <Header title="Not found" />
  return <Form key={editId || typeParam} {...data} type={data.existing?.type || typeParam} day={day} />
}

function Form({ machines, charges, existing, audit, type, day }) {
  const meta = TYPES[type]
  const active = machines.filter((m) => m.active || m.id === existing?.machineId || m.id === existing?.source)
  const lastKey = `lastMachine:${type}`
  const defaultMachine = existing?.machineId || (active.some((m) => m.id === remembered(lastKey)) ? remembered(lastKey) : active[0]?.id)

  const [amount, setAmount] = useState(existing?.amount || 0)
  const [charge, setCharge] = useState(existing?.charge ?? 0)
  const [fee, setFee] = useState(existing?.fee ?? 0)
  const [machineId, setMachineId] = useState(defaultMachine)
  const [source, setSource] = useState(existing?.source || (type === 'top_up' ? 'outside' : active[0]?.id))
  const [note, setNote] = useState(existing?.note || '')
  const [chargeEdited, setChargeEdited] = useState(!!existing)
  const [feeEdited, setFeeEdited] = useState(!!existing)
  const [error, setError] = useState('')
  const [toast, showToast] = useToast()
  const [sheet, ask] = useConfirm()
  const amountRef = useRef()

  const readOnly = existing && (existing.deleted || existing.dayId !== day?.id)
  const feeMachine = machines.find((m) => m.id === (type === 'cash_in' ? source : machineId))

  // Fill charge and fee from the tables until the agent types their own.
  useEffect(() => {
    if (!chargeEdited && meta?.charge && type !== 'airtime') setCharge(fromTiers(charges, amount))
    if (!feeEdited && meta?.fee && type !== 'cash_in') setFee(fromTiers(feeMachine?.fees, amount))
  }, [amount, machineId, source]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta) return <Header title="Unknown transaction" />

  async function save(another) {
    setError('')
    if (!amount) return setError('Enter the amount.')
    if (meta.machine && !machineId) return setError('Pick a machine.')
    if ((type === 'withdrawal' || type === 'transfer') && charge >= amount) return setError('Charge must be less than the amount.')

    const tx = {
      ...(existing ? { id: existing.id } : { dayId: day.id }),
      type,
      amount,
      charge: meta.charge ? charge : 0,
      fee: meta.fee && !(type === 'cash_in' && source === 'outside') ? fee : 0,
      machineId: meta.machine ? machineId : null,
      source: meta.source ? source : null,
      note: note.trim(),
    }
    await saveTransaction(tx)
    if (meta.machine) remember(lastKey, machineId)

    if (another) {
      showToast(`Saved ${naira(amount)} ${meta.short.toLowerCase()}`)
      setAmount(0)
      setChargeEdited(false)
      setFeeEdited(false)
      setNote('')
      amountRef.current?.querySelector('input')?.focus()
    } else if (existing) {
      back()
    } else {
      go('#/')
    }
  }

  async function remove() {
    const yes = await ask({
      title: 'Delete this transaction?',
      message: 'It will be crossed out in History, so the owner can still see it was deleted.',
      confirm: 'Delete',
      tone: 'danger',
      mood: 'worried',
    })
    if (!yes) return
    await deleteTransaction(existing.id)
    back()
  }

  const machineOptions = active.map((m) => ({ value: m.id, label: m.name }))
  const summary = {
    withdrawal: amount > charge && ['Give the customer', naira(amount - charge), 'in cash'],
    transfer: amount > charge && ['Send to the customer', naira(amount - charge), `you keep ${naira(charge)}`],
    airtime: amount > 0 && ['Collect from the customer', naira(amount + charge), 'in cash'],
  }[type]

  return (
    <div className="page has-bottom">
      <Header title={existing ? `Edit ${meta.short.toLowerCase()}` : meta.label} right={<TypeBadge type={type} size={40} />} />
      {readOnly && <div className="alert">{existing.deleted ? 'This transaction was deleted.' : 'This day is closed. You can only view it.'}</div>}

      <fieldset disabled={readOnly}>
        {meta.machine && (
          <div className="field">
            <span className="field-label">{type === 'top_up' ? 'Machine to top up' : 'Machine'}</span>
            <Choice options={machineOptions} value={machineId} onChange={setMachineId} />
          </div>
        )}

        {meta.source && (
          <div className="field">
            <span className="field-label">Money came from</span>
            <Choice
              options={
                type === 'cash_in'
                  ? [...machineOptions, { value: 'outside', label: 'Bank / outside' }]
                  : [{ value: 'cash', label: 'Cash drawer' }, { value: 'outside', label: 'Bank / outside' }]
              }
              value={source}
              onChange={setSource}
            />
          </div>
        )}

        <div ref={amountRef}>
          <MoneyInput variant="hero" label={type === 'airtime' ? 'Airtime / bill amount' : 'Amount'} value={amount} onChange={setAmount} autoFocus={!existing} />
        </div>
        <div className="quick">
          {QUICK_AMOUNTS.map((q) => (
            <button key={q} type="button" className={amount === q ? 'choice-on' : ''} onClick={() => setAmount(q)}>
              {q >= 1000 ? `${q / 1000}k` : q}
            </button>
          ))}
        </div>

        {(meta.charge || meta.fee) && (
          <div className="card rows">
            {meta.charge && (
              <MoneyInput
                variant="row"
                label="Your charge"
                value={charge}
                onChange={(v) => {
                  setCharge(v)
                  setChargeEdited(true)
                }}
              />
            )}
            {meta.fee && !(type === 'cash_in' && source === 'outside') && (
              <MoneyInput
                variant="row"
                label={type === 'cash_in' ? 'Fee taken' : `${feeMachine?.name || 'Machine'} fee`}
            value={fee}
                onChange={(v) => {
                  setFee(v)
                  setFeeEdited(true)
                }}
              />
            )}
          </div>
        )}

        {summary && (
          <div className={`callout t-${type}`}>
            <span>{summary[0]}</span>
            <strong>{summary[1]}</strong>
            <span>{summary[2]}</span>
          </div>
        )}

        {meta.note && (
          <label className="field">
            <span className="field-label">What for?</span>
            <input className="text-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. food, fuel, salary" />
          </label>
        )}
      </fieldset>

      {error && <p className="bad">{error}</p>}

      {existing && audit.length > 0 && (
        <div className="card">
          <h3>Changes</h3>
          {audit.map((a) => (
            <div key={a.id} className="muted small">
              {formatTime(a.at)} · {a.action === 'add' ? 'Added' : a.action === 'delete' ? 'Deleted' : 'Edited'}
              {a.action === 'edit' && a.before.amount !== a.after.amount && ` · ${naira(a.before.amount)} → ${naira(a.after.amount)}`}
              {a.action === 'edit' && a.before.charge !== a.after.charge && ` · charge ${naira(a.before.charge)} → ${naira(a.after.charge)}`}
            </div>
          ))}
        </div>
      )}

      {toast}
      {sheet}
      {!readOnly && (
        <div className="bottom-bar two">
          {existing ? (
            <button className="btn danger" onClick={remove}>
              Delete
            </button>
          ) : (
            <button className="btn ghost" onClick={() => save(true)}>
              Save + next
            </button>
          )}
          <button className="btn primary" onClick={() => save(false)}>
            Save
          </button>
        </div>
      )}
    </div>
  )
}
