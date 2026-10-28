import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getOpenDay, getSetting } from './db'
import { cloudEnabled, startAutoSync, syncNow, unsyncedCount } from './cloud'
import Welcome from './screens/Welcome'
import Account from './screens/Account'
import Team from './screens/Team'
import Setup from './screens/Setup'
import Home from './screens/Home'
import StartDay from './screens/StartDay'
import AddTransaction from './screens/AddTransaction'
import History from './screens/History'
import CloseDay from './screens/CloseDay'
import Days from './screens/Days'
import Settings from './screens/Settings'

function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

// Uploads changes made on this phone shortly after they happen, and keeps pulling the team's.
function SyncManager({ outletId }) {
  const waiting = useLiveQuery(unsyncedCount)
  useEffect(() => startAutoSync(outletId), [outletId])
  useEffect(() => {
    if (!waiting) return
    const t = setTimeout(syncNow, 1500)
    return () => clearTimeout(t)
  }, [waiting])
  return null
}

export default function App() {
  const state = useLiveQuery(async () => ({
    account: await getSetting('account', null),
    localOnly: await getSetting('localOnly', false),
  }))
  return (
    <>
      {state?.account && <SyncManager outletId={state.account.outletId} />}
      {state && <Screens account={state.account} localOnly={state.localOnly} />}
    </>
  )
}

function Screens({ account, localOnly }) {
  const [page, param] = useRoute()
  const state = useLiveQuery(async () => ({
    setupDone: await getSetting('setupDone', false),
    openDay: (await getOpenDay()) ?? null,
  }))

  if (!state) return null
  // keyed by mode so switching between sign-up and log-in starts with a clean form
  if (page === 'account') return <Account key={param} mode={param} />
  if (!state.setupDone) {
    if (cloudEnabled && !account && !localOnly) return <Welcome />
    return <Setup />
  }

  const { openDay } = state
  switch (page) {
    case 'start':
      return openDay ? <Home openDay={openDay} /> : <StartDay />
    case 'add':
      return openDay ? <AddTransaction type={param} day={openDay} /> : <Home />
    case 'edit':
      return <AddTransaction editId={param} day={openDay} />
    case 'history':
      return <History dayId={param || openDay?.id} />
    case 'close':
      return openDay ? <CloseDay day={openDay} /> : <Home />
    case 'days':
      return <Days dayId={param} />
    case 'settings':
      return <Settings />
    case 'team':
      return <Team />
    default:
      return <Home openDay={openDay} />
  }
}
