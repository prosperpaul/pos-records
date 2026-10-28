// How each transaction moves money. All amounts are whole naira.
//
//   withdrawal  customer withdraws A on the machine, charge C is deducted from the cash given
//               cash −(A − C), machine +A − fee
//   transfer    customer hands over A in cash, charge C is deducted from the amount sent
//               cash +A, machine −(A − C) − fee
//   airtime     customer pays A + C in cash, A is sent from the machine
//               cash +(A + C), machine −A − fee
//   cash_in     more cash into the drawer, from a machine (bank/ATM withdrawal) or from outside
//   top_up      more money onto a machine, from the drawer or from outside (bank transfer)
//   expense     paid from the drawer

export const TYPES = {
  withdrawal: { label: 'Withdrawal', short: 'Withdraw', color: 'green', machine: true, charge: true, fee: true },
  transfer: { label: 'Transfer / Deposit', short: 'Transfer', color: 'blue', machine: true, charge: true, fee: true },
  airtime: { label: 'Airtime / Bills', short: 'Airtime', color: 'purple', machine: true, charge: true, fee: false },
  cash_in: { label: 'Add cash to drawer', short: 'Add cash', color: 'gray', source: true, fee: true },
  top_up: { label: 'Top up machine', short: 'Top up', color: 'gray', machine: true, source: true },
  expense: { label: 'Expense', short: 'Expense', color: 'red', note: true },
}

export const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000]

export function fromTiers(tiers, amount) {
  if (!amount || !tiers?.length) return 0
  const sorted = [...tiers].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity))
  const tier = sorted.find((t) => t.upTo == null || amount <= t.upTo)
  return tier ? tier.fee : 0
}

export function effects(tx) {
  const a = tx.amount || 0
  const c = tx.charge || 0
  const f = tx.fee || 0
  const machines = {}
  const move = (id, delta) => {
    if (id) machines[id] = (machines[id] || 0) + delta
  }
  let cash = 0
  let profit = 0

  switch (tx.type) {
    case 'withdrawal':
      cash = -(a - c)
      move(tx.machineId, a - f)
      profit = c - f
      break
    case 'transfer':
      cash = a
      move(tx.machineId, -(a - c) - f)
      profit = c - f
      break
    case 'airtime':
      cash = a + c
      move(tx.machineId, -a - f)
      profit = c - f
      break
    case 'cash_in':
      cash = a
      if (tx.source && tx.source !== 'outside') move(tx.source, -a - f)
      profit = -f
      break
    case 'top_up':
      move(tx.machineId, a)
      if (tx.source === 'cash') cash = -a
      break
    case 'expense':
      cash = -a
      profit = -a
      break
  }
  return { cash, machines, profit }
}

export function summarise(day, transactions) {
  const cash = day?.openingCash || 0
  const machines = { ...(day?.openingBalances || {}) }
  const totals = { cash, machines, profit: 0, charges: 0, fees: 0, expenses: 0, count: 0, cashOut: 0 }

  for (const tx of transactions) {
    if (tx.deleted) continue
    const e = effects(tx)
    totals.cash += e.cash
    for (const [id, delta] of Object.entries(e.machines)) machines[id] = (machines[id] || 0) + delta
    totals.profit += e.profit
    if (TYPES[tx.type]?.charge) totals.charges += tx.charge || 0
    totals.fees += tx.fee || 0
    if (tx.type === 'expense') totals.expenses += tx.amount || 0
    if (tx.type === 'withdrawal') totals.cashOut += tx.amount || 0
    if (tx.type !== 'cash_in' && tx.type !== 'top_up' && tx.type !== 'expense') totals.count += 1
  }
  return totals
}

// CBN limit on agent cash-out per day. Check the current circular before relying on it.
export const DAILY_CASH_OUT_LIMIT = 1200000

export function naira(n) {
  const v = Math.round(n || 0)
  const s = Math.abs(v).toLocaleString('en-NG')
  return `${v < 0 ? '−' : ''}₦${s}`
}

export function toNumber(text) {
  const n = parseInt(String(text).replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
