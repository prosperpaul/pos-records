import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, exportBackup, addMachine as createMachine, updateMachine, DEFAULT_FEES, PROVIDERS } from '../db'
import { Header, TierEditor, Choice, InstallBanner, SyncBadge, go, formatPhone, useConfirm } from '../ui'
import { cloudEnabled, logOut, unsyncedCount } from '../cloud'
import { Icon } from '../icons'

export default function Settings() {
  const data = useLiveQuery(async () => ({
    machines: await db.machines.orderBy('id').toArray(),
    standName: await getSetting('standName', ''),
    charges: await getSetting('charges', []),
    account: await getSetting('account', null),
  }))
  const [persisted, setPersisted] = useState(null)
  const [sheet, ask] = useConfirm()
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
  }, [])

  if (!data) return null
  const machines = [...data.machines].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const { account } = data
  const canEdit = !account || account.role === 'owner'

  async function signOut() {
    const waiting = await unsyncedCount()
    const yes = await ask(
      waiting
        ? {
            title: `${waiting} records aren't backed up yet`,
            message: 'If you log out now they will be LOST. Connect to the internet and wait for "Backed up" first.',
            confirm: 'Log out anyway',
            tone: 'danger',
            mood: 'worried',
          }
        : {
            title: 'Log out?',
            message: 'Records will be removed from this phone. They stay safe online, and come back when you log in.',
            confirm: 'Log out',
            tone: 'ink',
          },
    )
    if (yes) await logOut()
  }

  async function addMachine() {
    await createMachine({ name: 'New machine', provider: 'Other', fees: DEFAULT_FEES, active: 1, order: machines.length })
  }

  async function backup() {
    const json = JSON.stringify(await exportBackup(), null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `pos-records-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      {sheet}
      <Header title="Settings" onBack={() => go('#/')} />
      <SyncBadge />

      {account && (
        <div className="card account-card">
          <span className="avatar">{(account.name || '?').slice(0, 1).toUpperCase()}</span>
          <div className="account-main">
            <strong>{account.name}</strong>
            <div className="muted small">
              {account.role === 'owner' ? 'Owner' : 'Attendant'} · {formatPhone(account.phone)}
            </div>
          </div>
          <button className="link danger" onClick={signOut}>
            Log out
          </button>
        </div>
      )}
      {!account && cloudEnabled && (
        <div className="card">
          <div className="card-title">
            <Icon name="cloud" /> Back up online and add attendants
          </div>
          <p className="muted small">Create an owner account. Everything already on this phone is uploaded.</p>
          <button className="btn primary" onClick={() => go('#/account/owner')}>
            Create owner account
          </button>
          <button className="link" onClick={() => go('#/account/login')}>
            I already have an account
          </button>
        </div>
      )}

      <div className="card menu">
        <button className="menu-row" onClick={() => go('#/days')}>
          <Icon name="calendar" /> <span>Past days</span> <Icon name="chevron" size={18} className="faint" />
        </button>
        {account && (
          <button className="menu-row" onClick={() => go('#/team')}>
            <Icon name="team" /> <span>{account.role === 'owner' ? 'Team and join code' : 'Team'}</span>
            <Icon name="chevron" size={18} className="faint" />
          </button>
        )}
      </div>

      <fieldset disabled={!canEdit}>
        {!canEdit && <p className="alert">Only the owner can change the stand name, charges and machines.</p>}

        <h2>Your stand</h2>
        <div className="card">
          <label className="field flush">
            <span className="field-label">Stand name</span>
            <input className="text-input" defaultValue={data.standName} onBlur={(e) => setSetting('standName', e.target.value.trim())} />
          </label>
        </div>

        <h2>Your charges</h2>
        <div className="card">
          <p className="muted small flush-top">What you charge customers. It fills in automatically, and you can still change it on each transaction.</p>
          <TierEditor tiers={data.charges} onChange={(t) => setSetting('charges', t)} />
        </div>

        <h2>Machines</h2>
        {machines.map((m) => (
          <MachineCard key={m.id} machine={m} />
        ))}
        {canEdit && (
          <>
            <button className="btn ghost" onClick={addMachine}>
              + Add machine
            </button>
            <p className="muted small">Add machines before you start the day. One added mid-day starts that day at ₦0.</p>
          </>
        )}
      </fieldset>

      <h2>This phone</h2>
      <div className="card">
        <InstallBanner always />
        <p className="muted small">
          {account ? 'Your records are saved on this phone and backed up online.' : 'Your records are saved on this phone only.'}{' '}
          {persisted === false && 'Your browser may clear them if the phone runs out of space, so download a backup often.'}
        </p>
        <button className="btn ghost" onClick={backup}>
          Download backup
        </button>
      </div>
    </div>
  )
}

function MachineCard({ machine: m }) {
  const update = (patch) => updateMachine(m.id, patch)
  return (
    <div className={`card machine-card ${m.active ? '' : 'inactive'}`}>
      <label className="field flush">
        <span className="field-label">Machine name</span>
        <input className="text-input" defaultValue={m.name} onBlur={(e) => update({ name: e.target.value.trim() || m.provider })} />
      </label>
      <Choice options={PROVIDERS.map((p) => ({ value: p, label: p }))} value={m.provider} onChange={(provider) => update({ provider })} />
      <h3>Fees this machine deducts</h3>
      <TierEditor tiers={m.fees || []} onChange={(fees) => update({ fees })} />
      <button className={`link ${m.active ? 'danger' : ''}`} onClick={() => update({ active: m.active ? 0 : 1 })}>
        {m.active ? 'Stop using this machine' : 'Use this machine again'}
      </button>
    </div>
  )
}
