import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting } from '../db'
import { newJoinCode, setMemberActive } from '../cloud'
import { Header, SyncBadge, go, formatPhone } from '../ui'
import { MascotSays } from '../mascot'

export default function Team() {
  const data = useLiveQuery(async () => ({
    account: await getSetting('account', null),
    code: await getSetting('joinCode', ''),
    members: await getSetting('members', []),
    standName: await getSetting('standName', ''),
  }))
  const [error, setError] = useState('')

  if (!data) return null
  const { account, code, members, standName } = data
  if (!account) return <Header title="Team" />
  const isOwner = account.role === 'owner'

  async function run(action) {
    setError('')
    if (!navigator.onLine) return setError('You need internet for this.')
    try {
      await action()
    } catch (e) {
      setError(e.message)
    }
  }

  const newCode = () => {
    if (!confirm('Make a new code? The old code will stop working for new attendants.')) return
    run(() => newJoinCode(account.outletId, code))
  }

  const setActive = (m, active) => {
    if (!active && !confirm(`Remove ${m.name || 'this attendant'}? They won't be able to see or add records for your stand.`)) return
    run(() => setMemberActive(account.outletId, m.user_id, active))
  }

  const share = `Join ${standName || 'my POS stand'} on POS Records.\n1. Open ${location.origin}\n2. Tap "I'm an attendant"\n3. Enter this code: ${code}`

  return (
    <div className="page">
      <Header title="Team" onBack={() => go('#/settings')} />
      <SyncBadge />

      {isOwner && (
        <>
          <MascotSays mood="wave">Send this code to your attendant. They tap "I'm an attendant" and type it in.</MascotSays>
          <div className="ticket">
            <div className="ticket-label">Join code</div>
            <div className="join-code">{code || '……'}</div>
          </div>
          <a className="btn lime" href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer">
            Send code on WhatsApp
          </a>
          <button className="link center" onClick={newCode}>
            Make a new code
          </button>
        </>
      )}

      <h2>People</h2>
      {members.map((m) => (
        <div key={m.user_id} className={`card member ${m.active ? '' : 'inactive'}`}>
          <span className="avatar">{(m.name || '?').slice(0, 1).toUpperCase()}</span>
          <div className="account-main">
            <strong>{m.name || 'No name'}</strong>
            {m.user_id === account.userId && <span className="badge">you</span>}
            <div className="muted small">
              {m.role === 'owner' ? 'Owner' : 'Attendant'} · {formatPhone(m.phone)}
              {!m.active && ' · removed'}
            </div>
          </div>
          {isOwner && m.role === 'attendant' && (
            <button className={`link ${m.active ? 'danger' : ''}`} onClick={() => setActive(m, !m.active)}>
              {m.active ? 'Remove' : 'Allow again'}
            </button>
          )}
        </div>
      ))}
      {error && <p className="bad">{error}</p>}
    </div>
  )
}
