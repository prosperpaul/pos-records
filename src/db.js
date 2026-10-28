import Dexie from 'dexie'

// Everything is saved on the phone first. `synced` is kept on every record so a
// later cloud sync can push only what the server has not confirmed yet.
export const db = new Dexie('pos-records')

db.version(1).stores({
  settings: 'key',
  machines: 'id, active',
  days: 'id, status, openedAt',
  transactions: 'id, dayId, createdAt, synced',
  audit: 'id, txId, at',
})

// Version 2 adds cloud sync: every table can be searched for records not yet on the server.
db.version(2)
  .stores({
    machines: 'id, active, synced',
    days: 'id, status, openedAt, synced',
    audit: 'id, txId, at, synced',
  })
  .upgrade(async (tx) => {
    const now = Date.now()
    for (const name of ['machines', 'days', 'transactions', 'audit']) {
      await tx.table(name).toCollection().modify((r) => {
        r.synced = 0
        if (name === 'machines' || name === 'days') r.updatedAt ??= now
      })
    }
  })

export const SYNCED_TABLES = ['machines', 'days', 'transactions', 'audit']

export function newId() {
  // crypto.randomUUID only exists on https/localhost; phones testing over the
  // local network use plain http, so fall back to getRandomValues.
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function todayId(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Agent's own charges. Each tier applies up to `upTo` naira; `upTo: null` is "anything above".
export const DEFAULT_CHARGES = [
  { upTo: 5000, fee: 100 },
  { upTo: 10000, fee: 200 },
  { upTo: 20000, fee: 300 },
  { upTo: null, fee: 500 },
]

// What the provider deducts from the machine. From agent interviews: about ₦20 on
// ₦1,000 and ₦50 on ₦5,000. Agents can correct this per machine in Settings.
export const DEFAULT_FEES = [
  { upTo: 1000, fee: 20 },
  { upTo: 5000, fee: 50 },
  { upTo: null, fee: 100 },
]

export const PROVIDERS = ['Moniepoint', 'OPay', 'PalmPay', 'Bank POS', 'Other']

export async function getSetting(key, fallback) {
  const row = await db.settings.get(key)
  return row ? row.value : fallback
}

// Stand name and charges live on the stand's cloud record, so changing them flags it for upload.
const OUTLET_SETTINGS = ['standName', 'charges']

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
  if (OUTLET_SETTINGS.includes(key)) await db.settings.put({ key: 'outletDirty', value: true })
}

export async function currentUserId() {
  return (await getSetting('account', null))?.userId || null
}

export async function addMachine(machine) {
  return db.machines.add({ ...machine, id: newId(), updatedAt: Date.now(), synced: 0 })
}

export function updateMachine(id, patch) {
  return db.machines.update(id, { ...patch, updatedAt: Date.now(), synced: 0 })
}

export async function getOpenDay() {
  return db.days.where('status').equals('open').first()
}

export async function saveTransaction(tx) {
  const now = Date.now()
  if (tx.id) {
    const before = await db.transactions.get(tx.id)
    const after = { ...before, ...tx, updatedAt: now, synced: 0 }
    await db.transaction('rw', db.transactions, db.audit, async () => {
      await db.transactions.put(after)
      await db.audit.add({ id: newId(), txId: tx.id, action: 'edit', before, after, at: now, synced: 0 })
    })
    return after
  }
  const row = { ...tx, id: newId(), createdAt: now, updatedAt: now, deleted: 0, synced: 0, createdBy: await currentUserId() }
  await db.transaction('rw', db.transactions, db.audit, async () => {
    await db.transactions.add(row)
    await db.audit.add({ id: newId(), txId: row.id, action: 'add', before: null, after: row, at: now, synced: 0 })
  })
  return row
}

// Records are never removed, only marked deleted, so the owner can always see what changed.
export async function deleteTransaction(id) {
  const now = Date.now()
  const before = await db.transactions.get(id)
  const after = { ...before, deleted: 1, updatedAt: now, synced: 0 }
  await db.transaction('rw', db.transactions, db.audit, async () => {
    await db.transactions.put(after)
    await db.audit.add({ id: newId(), txId: id, action: 'delete', before, after, at: now, synced: 0 })
  })
}

export async function exportBackup() {
  const data = {}
  for (const table of db.tables) data[table.name] = await table.toArray()
  return { app: 'pos-records', version: 1, exportedAt: new Date().toISOString(), data }
}
