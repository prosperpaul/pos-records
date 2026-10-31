import { useState } from 'react'
import { db, addMachine, setSetting, DEFAULT_CHARGES, DEFAULT_FEES, PROVIDERS } from '../db'
import { go, InstallChip } from '../ui'
import { MascotSays } from '../mascot'

export default function Setup() {
  const [standName, setStandName] = useState('')
  const [machines, setMachines] = useState([{ name: '', provider: 'Moniepoint' }])
  const [error, setError] = useState('')

  const update = (i, patch) => setMachines(machines.map((m, j) => (j === i ? { ...m, ...patch } : m)))

  async function finish() {
    const list = machines.filter((m) => m.provider)
    if (!list.length) return setError('Add at least one POS machine.')
    await db.transaction('rw', db.machines, db.settings, async () => {
      for (const [i, m] of list.entries()) {
        const sameProvider = list.filter((x) => x.provider === m.provider).length > 1
        await addMachine({
          name: m.name.trim() || (sameProvider ? `${m.provider} ${i + 1}` : m.provider),
          provider: m.provider,
          fees: DEFAULT_FEES,
          active: 1,
          order: i,
        })
      }
      await setSetting('standName', standName.trim())
      await setSetting('charges', DEFAULT_CHARGES)
      await setSetting('setupDone', true)
    })
    go('#/start')
  }

  return (
    <div className="page has-bottom">
      <div className="first-top">
        <span className="first-brand">
          <img src="/icon.svg" alt="" width="28" height="28" />
          POS Records
        </span>
        <InstallChip />
      </div>
      <div className="welcome compact">
        <MascotSays mood="wave" size={80}>
          Hello! I'm Kobo. Tell me which POS machines you use.
        </MascotSays>
        <h1>Set up your stand</h1>
      </div>

      <label className="field">
        <span className="field-label">Name of your stand (optional)</span>
        <input className="text-input" value={standName} onChange={(e) => setStandName(e.target.value)} placeholder="e.g. Mama Ade POS, Ikeja" />
      </label>

      <h2>Your POS machines</h2>
      {machines.map((m, i) => (
        <div className="card machine-setup" key={i}>
          <div className="choice wrap">
            {PROVIDERS.map((p) => (
              <button key={p} type="button" className={m.provider === p ? 'choice-on' : ''} onClick={() => update(i, { provider: p })}>
                {p}
              </button>
            ))}
          </div>
          <input
            className="text-input"
            value={m.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder={`Name (optional), e.g. ${m.provider === 'Bank POS' ? 'Access POS' : m.provider}`}
          />
          {machines.length > 1 && (
            <button className="link danger" onClick={() => setMachines(machines.filter((_, j) => j !== i))}>
              Remove
            </button>
          )}
        </div>
      ))}
      <button className="btn secondary" onClick={() => setMachines([...machines, { name: '', provider: 'OPay' }])}>
        + Add another machine
      </button>

      {error && <p className="bad">{error}</p>}
      <div className="bottom-bar">
        <button className="btn primary" onClick={finish}>
          Continue
        </button>
      </div>
    </div>
  )
}
