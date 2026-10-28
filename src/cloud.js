import { useEffect, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  initializeFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, writeBatch,
  query, where, orderBy, onSnapshot, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db, getSetting, SYNCED_TABLES } from './db'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Without these the app runs fully offline and hides accounts.
export const cloudEnabled = !!(config.apiKey && config.projectId)
const app = cloudEnabled ? initializeApp(config) : null
const auth = app ? getAuth(app) : null
const fs = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null

// ───────────── Accounts ─────────────
// Agents log in with phone number + 6-digit PIN. Firebase needs an email, so the phone
// number is turned into one that is never emailed.

export function normalisePhone(text) {
  let d = String(text).replace(/\D/g, '')
  if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1)
  return d
}

function phoneEmail(phone) {
  return `${normalisePhone(phone)}@phone.posrecords.app`
}

export function validPhone(text) {
  return /^234\d{10}$/.test(normalisePhone(text))
}

function friendly(error) {
  const code = error?.code || ''
  const m = error?.message || String(error)
  if (code === 'auth/email-already-in-use') return 'This phone number already has an account. Log in instead.'
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(code)) return 'Wrong phone number or PIN.'
  if (code === 'auth/too-many-requests') return 'Too many tries. Wait a few minutes and try again.'
  if (code === 'auth/network-request-failed' || code === 'unavailable' || /network|offline/i.test(m)) return 'No internet connection. Connect and try again.'
  if (code === 'auth/operation-not-allowed') return 'Setup problem: turn on Email/Password sign-in in Firebase.'
  if (code === 'permission-denied') return 'You no longer have access to this stand. Ask the owner.'
  if (m === 'TIMEOUT') return 'The internet is too slow right now. It will try again.'
  return m
}

async function signUpOrIn(phone, pin) {
  const email = phoneEmail(phone)
  try {
    return (await createUserWithEmailAndPassword(auth, email, pin)).user
  } catch (e) {
    if (e.code !== 'auth/email-already-in-use') throw e
    return (await signInWithEmailAndPassword(auth, email, pin)).user
  }
}

function randomCode() {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ23456789' // no 0/O/Q or 1/I mix-ups
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => letters[b % letters.length]).join('')
}

async function saveAccount(account) {
  await db.settings.put({ key: 'account', value: account })
}

// Owner: makes a new stand. Anything already recorded on this phone is uploaded into it.
export async function createOwnerAccount({ name, phone, pin }) {
  try {
    const user = await signUpOrIn(phone, pin)
    // Someone who already has a stand must log in, or they'd end up with a second, empty one.
    if ((await getDoc(doc(fs, 'users', user.uid))).exists()) {
      await signOut(auth)
      throw new Error('This phone number already has an account. Go back and tap "I already have an account".')
    }
    const outletRef = doc(collection(fs, 'outlets'))
    const joinCode = randomCode()
    // Separate writes, in this order: each access rule checks the one before it.
    await setDoc(outletRef, {
      name: await getSetting('standName', ''),
      charges: await getSetting('charges', []),
      ownerId: user.uid,
      joinCode,
      createdAt: serverTimestamp(),
    })
    await setDoc(doc(outletRef, 'members', user.uid), { uid: user.uid, role: 'owner', name, phone: normalisePhone(phone), active: true })
    await setDoc(doc(fs, 'joinCodes', joinCode), { outletId: outletRef.id })
    await setDoc(doc(fs, 'users', user.uid), { outletId: outletRef.id, role: 'owner' })
    await saveAccount({ userId: user.uid, outletId: outletRef.id, role: 'owner', name, phone: normalisePhone(phone) })
    await syncNow()
  } catch (e) {
    throw new Error(friendly(e))
  }
}

// Attendant: joins an owner's stand with the code from the owner's Team page.
export async function joinStand({ name, phone, pin, code }) {
  try {
    const user = await signUpOrIn(phone, pin)
    const joinCode = code.trim().toUpperCase()
    const codeDoc = await getDoc(doc(fs, 'joinCodes', joinCode))
    if (!codeDoc.exists()) throw new Error('That join code is wrong. Ask the owner for the code on their Team page.')
    const { outletId } = codeDoc.data()
    const memberRef = doc(fs, 'outlets', outletId, 'members', user.uid)
    const existing = await getDoc(memberRef)
    // Someone the owner removed can't join again by themselves; someone already in just continues.
    if (existing.exists() && !existing.data().active) throw new Error('The owner removed your access to this stand. Ask them to allow you again.')
    if (!existing.exists()) {
      await setDoc(memberRef, { uid: user.uid, role: 'attendant', name, phone: normalisePhone(phone), active: true, joinCode })
    }
    const role = existing.exists() ? existing.data().role : 'attendant'
    await setDoc(doc(fs, 'users', user.uid), { outletId, role })
    await saveAccount({ userId: user.uid, outletId, role, name, phone: normalisePhone(phone) })
    await pullOnce(outletId)
    await db.settings.put({ key: 'setupDone', value: true })
  } catch (e) {
    throw new Error(friendly(e))
  }
}

// Log in on a new phone (or again after logging out).
export async function logIn({ phone, pin }) {
  try {
    const { user } = await signInWithEmailAndPassword(auth, phoneEmail(phone), pin)
    const profile = await getDoc(doc(fs, 'users', user.uid))
    const outletId = profile.exists() ? profile.data().outletId : null
    const member = outletId ? await getDoc(doc(fs, 'outlets', outletId, 'members', user.uid)) : null
    if (!member?.exists() || !member.data().active) {
      await signOut(auth)
      throw new Error('This account is not part of any stand, or the owner removed your access.')
    }
    const m = member.data()
    await saveAccount({ userId: user.uid, outletId, role: m.role, name: m.name, phone: m.phone })
    await syncNow()
    await pullOnce(outletId)
    if (m.role === 'attendant' || (await db.machines.count()) > 0) await db.settings.put({ key: 'setupDone', value: true })
  } catch (e) {
    throw new Error(friendly(e))
  }
}

// ───────────── Owner: team ─────────────

export async function newJoinCode(outletId, oldCode) {
  const code = randomCode()
  const batch = writeBatch(fs)
  batch.set(doc(fs, 'joinCodes', code), { outletId })
  if (oldCode) batch.delete(doc(fs, 'joinCodes', oldCode))
  batch.update(doc(fs, 'outlets', outletId), { joinCode: code })
  await batch.commit()
}

export async function setMemberActive(outletId, uid, active) {
  await updateDoc(doc(fs, 'outlets', outletId, 'members', uid), { active })
}

export async function unsyncedCount() {
  let n = 0
  for (const t of SYNCED_TABLES) n += await db[t].where('synced').equals(0).count()
  return n
}

// Logging out wipes this phone so the next person can't see the records. The cloud copy stays.
export async function logOut() {
  stopListening()
  if (auth) await signOut(auth)
  await Promise.all(db.tables.map((t) => t.clear()))
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('lastMachine:')) localStorage.removeItem(k)
  } catch {
    // Nothing to clean if storage is blocked.
  }
  location.hash = '#/'
  location.reload()
}

// ───────────── Sync status ─────────────

const status = { state: 'idle', lastSync: null, error: null }
const listeners = new Set()
function setStatus(patch) {
  Object.assign(status, patch)
  listeners.forEach((fn) => fn({ ...status }))
}

export function useSyncStatus() {
  const [s, setS] = useState({ ...status })
  useEffect(() => {
    listeners.add(setS)
    return () => listeners.delete(setS)
  }, [])
  return s
}

// ───────────── Upload ─────────────
// Records are stored online at outlets/{stand}/{table}/{id}, with the same fields as on the
// phone. serverUpdatedAt is stamped by Firebase and is how other phones find what changed.

function toRemote(table, row, uid) {
  const { synced, ...data } = row // eslint-disable-line no-unused-vars
  data.serverUpdatedAt = serverTimestamp()
  if (table === 'transactions') {
    data.createdBy = data.createdBy || uid // records made before the account existed
    data.updatedBy = uid
  }
  if (table === 'audit') {
    data.by = data.by || uid
    data.before = strip(data.before)
    data.after = strip(data.after)
  }
  return data
}

function strip(row) {
  if (!row) return null
  const { synced, ...rest } = row // eslint-disable-line no-unused-vars
  return rest
}

function withTimeout(promise, ms = 20000) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))])
}

async function push(account) {
  const uid = auth.currentUser.uid
  for (const table of SYNCED_TABLES) {
    // Only the owner may change machines; an attendant's phone never uploads them.
    if (table === 'machines' && account.role !== 'owner') continue
    const rows = await db[table].where('synced').equals(0).toArray()
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400)
      const batch = writeBatch(fs)
      for (const r of chunk) {
        // Keep the uploader as `by` on this phone too, so a retry sends exactly the same record.
        if (table === 'audit' && !r.by) r.by = uid
        if (table === 'transactions' && !r.createdBy) r.createdBy = uid
        batch.set(doc(fs, 'outlets', account.outletId, table, r.id), toRemote(table, r, uid))
      }
      await withTimeout(batch.commit())
      // Mark as synced only if the record wasn't changed again while uploading.
      await db.transaction('rw', db[table], async () => {
        for (const sent of chunk) {
          const now = await db[table].get(sent.id)
          if (now && now.updatedAt === sent.updatedAt) {
            const patch = { synced: 1 }
            if (table === 'audit') patch.by = sent.by
            if (table === 'transactions') patch.createdBy = sent.createdBy
            await db[table].update(sent.id, patch)
          }
        }
      })
    }
  }

  if (account.role === 'owner' && (await getSetting('outletDirty', false))) {
    await withTimeout(updateDoc(doc(fs, 'outlets', account.outletId), {
      name: await getSetting('standName', ''),
      charges: await getSetting('charges', []),
    }))
    await db.settings.put({ key: 'outletDirty', value: false })
  }
}

let running = null
let again = false

// Uploads everything this phone hasn't backed up yet. Downloads come in through the live
// listeners in startAutoSync, so they don't cost extra reads.
export function syncNow() {
  if (!cloudEnabled) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    await auth.authStateReady()
    do {
      again = false
      const account = await getSetting('account', null)
      if (!account || !auth.currentUser) break
      if (!navigator.onLine) {
        setStatus({ state: 'offline' })
        break
      }
      setStatus({ state: 'syncing' })
      try {
        await push(account)
        setStatus({ state: 'idle', lastSync: Date.now(), error: null })
      } catch (e) {
        setStatus({ state: 'error', error: friendly(e) })
        break
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

// ───────────── Download ─────────────

async function merge(table, snapshots) {
  let newest = 0
  await db.transaction('rw', db[table], async () => {
    for (const snap of snapshots) {
      if (snap.metadata.hasPendingWrites) continue // our own upload, not confirmed yet
      const { serverUpdatedAt, ...data } = snap.data()
      newest = Math.max(newest, serverUpdatedAt?.toMillis() || 0)
      const mine = await db[table].get(snap.id)
      if (mine && mine.synced === 0) continue // a change made on this phone wins until it is uploaded
      await db[table].put({ ...data, id: snap.id, synced: 1 })
    }
  })
  if (newest > (await getSetting(`cursor:${table}`, 0))) await db.settings.put({ key: `cursor:${table}`, value: newest })
}

async function changedSince(outletId, table) {
  // Look back a minute in case a slow write landed with an earlier time; re-reading is harmless.
  const since = Math.max(0, (await getSetting(`cursor:${table}`, 0)) - 60000)
  return query(collection(fs, 'outlets', outletId, table), where('serverUpdatedAt', '>=', Timestamp.fromMillis(since)), orderBy('serverUpdatedAt'))
}

async function saveOutlet(data) {
  if (!data) return
  if (!(await getSetting('outletDirty', false))) {
    await db.settings.put({ key: 'standName', value: data.name || '' })
    if (data.charges?.length) await db.settings.put({ key: 'charges', value: data.charges })
  }
  await db.settings.put({ key: 'joinCode', value: data.joinCode })
}

async function saveMembers(snapshots) {
  const members = snapshots.map((s) => {
    const m = s.data()
    return { user_id: m.uid, role: m.role, name: m.name, phone: m.phone, active: m.active }
  })
  await db.settings.put({ key: 'members', value: members })
}

// One full download, used right after logging in or joining so the screens have data at once.
async function pullOnce(outletId) {
  for (const table of SYNCED_TABLES) {
    const snap = await getDocs(await changedSince(outletId, table))
    await merge(table, snap.docs)
  }
  await saveOutlet((await getDoc(doc(fs, 'outlets', outletId))).data())
  await saveMembers((await getDocs(collection(fs, 'outlets', outletId, 'members'))).docs)
}

let unsubscribers = []
function stopListening() {
  unsubscribers.forEach((u) => u())
  unsubscribers = []
}

// Keeps a logged-in phone in step: Firebase pushes the team's changes as they happen, and
// this phone uploads when it comes back online or is reopened. (Changes made on this phone
// are picked up by <SyncManager>, which watches for unsynced records.)
export function startAutoSync(outletId) {
  if (!cloudEnabled) return () => {}
  let stopped = false
  const onError = (e) => setStatus({ state: 'error', error: friendly(e) })

  auth.authStateReady().then(async () => {
    if (stopped || !auth.currentUser) return
    for (const table of SYNCED_TABLES) {
      const q = await changedSince(outletId, table)
      if (stopped) return
      unsubscribers.push(onSnapshot(q, (snap) => merge(table, snap.docChanges().map((c) => c.doc)), onError))
    }
    unsubscribers.push(onSnapshot(doc(fs, 'outlets', outletId), (snap) => saveOutlet(snap.data()), onError))
    unsubscribers.push(onSnapshot(collection(fs, 'outlets', outletId, 'members'), (snap) => saveMembers(snap.docs), onError))
  })

  const onVisible = () => document.visibilityState === 'visible' && syncNow()
  const onOffline = () => setStatus({ state: 'offline' })
  window.addEventListener('online', syncNow)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  syncNow()

  return () => {
    stopped = true
    stopListening()
    window.removeEventListener('online', syncNow)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
