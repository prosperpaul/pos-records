import { setSetting } from '../db'
import { go, InstallChip } from '../ui'
import { MascotSays } from '../mascot'

export default function Welcome() {
  return (
    <div className="page">
      <div className="first-top">
        <span className="first-brand">
          <img src="/icon.svg" alt="" width="28" height="28" />
          POS Records
        </span>
        <InstallChip />
      </div>
      <div className="welcome">
        <MascotSays mood="wave" size={92}>
          Hello! I'm Kobo. I'll help you count every naira.
        </MascotSays>
        <h1>
          Know your real profit.
          <br />
          <span>Catch every shortage.</span>
        </h1>
        <p>The notebook for your POS stand: cash, every machine, every naira.</p>
      </div>

      <button className="btn primary big" onClick={() => go('#/account/owner')}>
        I own the stand
        <div className="btn-sub">Create an account</div>
      </button>
      <button className="btn secondary big" onClick={() => go('#/account/join')}>
        I'm an attendant
        <div className="btn-sub">Join with the owner's code</div>
      </button>
      <button className="btn secondary" onClick={() => go('#/account/login')}>
        I already have an account
      </button>
      <button className="link center" onClick={() => setSetting('localOnly', true)}>
        Use without an account (records stay on this phone)
      </button>
    </div>
  )
}
