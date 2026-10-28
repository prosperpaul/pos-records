import { useState } from 'react'
import { createOwnerAccount, joinStand, logIn, validPhone } from '../cloud'
import { Header, go } from '../ui'
import { MascotSays } from '../mascot'

const TITLES = { owner: 'Create owner account', join: 'Join a stand', login: 'Log in' }

export default function Account({ mode }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!TITLES[mode]) return <Header title="Not found" />
  const needsName = mode !== 'login'

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (needsName && !name.trim()) return setError('Enter your name.')
    if (!validPhone(phone)) return setError('Enter your phone number, e.g. 08012345678.')
    if (!/^\d{6}$/.test(pin)) return setError('Your PIN must be 6 numbers.')
    if (mode === 'join' && code.trim().length < 6) return setError('Enter the 6-letter code from the owner.')
    setBusy(true)
    try {
      if (mode === 'owner') await createOwnerAccount({ name: name.trim(), phone, pin })
      if (mode === 'join') await joinStand({ name: name.trim(), phone, pin, code })
      if (mode === 'login') await logIn({ phone, pin })
      go('#/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page has-bottom">
      <Header title={TITLES[mode]} />
      <MascotSays mood={mode === 'login' ? 'happy' : 'wave'}>
        {mode === 'owner' && "Your records get backed up online, and you can see your attendants' work from your own phone."}
        {mode === 'join' && "Ask the owner for the 6-letter join code. It's on the Team page of their app."}
        {mode === 'login' && 'Welcome back! Log in with your phone number and PIN.'}
      </MascotSays>

      <form onSubmit={submit} id="account-form">
        {needsName && (
          <label className="field">
            <span className="field-label">Your name</span>
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span className="field-label">Phone number</span>
          <input className="text-input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" autoComplete="tel" />
        </label>
        <label className="field">
          <span className="field-label">{mode === 'login' ? 'PIN' : 'Choose a 6-number PIN'}</span>
          <input
            className="text-input pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode !== 'login' && <span className="muted small">You'll use your phone number and this PIN to log in on any phone. Don't share it.</span>}
        </label>
        {mode === 'join' && (
          <label className="field">
            <span className="field-label">Join code</span>
            <input className="text-input code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" />
          </label>
        )}
      </form>

      {error && <p className="bad">{error}</p>}
      <div className="bottom-bar">
        <button className="btn primary" type="submit" form="account-form" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'join' ? 'Join stand' : 'Create account'}
        </button>
      </div>
    </div>
  )
}
