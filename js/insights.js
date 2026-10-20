// Home-screen analysis. Plain maths over your own entries, all in base currency, nothing leaves the device.
import { monthParts, partsBetween, shiftMonth, thisMonth, nowStamp, daysInMonth, fmt, HOME } from './core.js';
import { quantile, trend as lineTrend } from './stats.js';

const sum = (a) => a.reduce((s, x) => s + x, 0);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// totals of one month by group for one kind
export function totals(db, ym, kind = 'expense') {
  const by = new Map(); let total = 0;
  for (const p of monthParts(db, ym)) {
    if (p.kind !== kind) continue;
    total += p.v; by.set(p.group, (by.get(p.group) || 0) + p.v);
  }
  return { total, by };
}

// up to n earlier months that actually have spending, newest first
export function baselineMonths(db, ym, n = 3) {
  const out = [];
  for (let i = 1; i <= 18 && out.length < n; i++) {
    const m = shiftMonth(ym, -i);
    if (totals(db, m).total > 0) out.push(m);
  }
  return out;
}

// how far into the month are we? (a past month counts as complete)
export function elapsed(ym) {
  const dim = daysInMonth(ym);
  if (ym === thisMonth()) return { day: Math.min(dim, +nowStamp().slice(8, 10)), dim, live: true };
  return { day: dim, dim, live: false };
}

// cumulative spending per day, for the pace chart
export function cumulative(db, ym) {
  const dim = daysInMonth(ym), day = new Array(dim).fill(0);
  for (const p of monthParts(db, ym)) if (p.kind === 'expense') day[+p.t.date.slice(8, 10) - 1] += p.v;
  let run = 0;
  return day.map((v) => (run += v));
}

export function pace(db, ym) {
  const e = elapsed(ym);
  const cur = cumulative(db, ym), prevYm = shiftMonth(ym, -1), prev = cumulative(db, prevYm);
  const spent = cur[e.day - 1] || 0;
  const base = baselineMonths(db, ym, 3);
  const usual = base.length ? sum(base.map((m) => totals(db, m).total)) / base.length : 0;
  const prevSame = prev.length ? (prev[Math.min(e.day, prev.length) - 1] || 0) : 0;
  const projected = e.live && e.day >= 3 ? (spent / e.day) * e.dim : spent;
  return { ...e, cur, prev, prevYm, spent, usual, prevSame, projected, dailyAvg: e.day ? spent / e.day : 0, baseCount: base.length };
}

// the last n months of spent and came-in, oldest first
export function trend(db, ym, n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = shiftMonth(ym, -i);
    out.push({ m, spent: totals(db, m).total, income: totals(db, m, 'income').total });
  }
  return out;
}

// sentences worth reading; each is computed from your numbers, nothing is guessed
export function insights(db, ym) {
  const out = [];
  const p = pace(db, ym);
  const money = (n) => fmt(n, HOME, { round: true });
  const pct = (a, b) => Math.round(Math.abs(a - b) / b * 100);
  if (p.usual > 0 && p.spent > 0) {
    if (p.live && p.day >= 5) {
      const diff = p.projected - p.usual;
      out.push({ tone: diff > 0 ? 'warn' : 'good', text: `At this pace you will spend about ${money(p.projected)} this month, ${pct(p.projected, p.usual)}% ${diff > 0 ? 'above' : 'below'} your usual ${money(p.usual)}.` });
    } else if (!p.live) {
      const diff = p.spent - p.usual;
      out.push({ tone: diff > 0 ? 'warn' : 'good', text: `You spent ${money(p.spent)}, ${pct(p.spent, p.usual)}% ${diff > 0 ? 'above' : 'below'} your usual ${money(p.usual)} (average of the ${p.baseCount} months before).` });
    }
  }
  // groups far from their own usual
  const now = totals(db, ym).by, base = baselineMonths(db, ym, 3);
  if (base.length) {
    const usual = new Map();
    for (const m of base) for (const [g, v] of totals(db, m).by) usual.set(g, (usual.get(g) || 0) + v / base.length);
    const moves = [];
    for (const g of new Set([...now.keys(), ...usual.keys()])) {
      const a = now.get(g) || 0, u = usual.get(g) || 0;
      if (p.live && a < u) continue; // a month in progress is naturally lower, so only flag overshoots
      moves.push({ g, a, u, d: a - u });
    }
    const up = moves.filter((x) => x.d > 500 && x.d > x.u * 0.3).sort((x, y) => y.d - x.d)[0];
    if (up) out.push({ tone: 'warn', text: `${up.g} is ${money(up.d)} above its usual (${money(up.u)} → ${money(up.a)}).` });
    const down = !p.live && moves.filter((x) => -x.d > 500 && -x.d > x.u * 0.3).sort((x, y) => x.d - y.d)[0];
    if (down) out.push({ tone: 'good', text: `${down.g} came in ${money(-down.d)} under its usual.` });
  }
  // single entries far above what that category usually costs
  const hist = new Map();
  for (let i = 1; i <= 6; i++) for (const q of monthParts(db, shiftMonth(ym, -i))) if (q.kind === 'expense' && q.cat) { if (!hist.has(q.cat)) hist.set(q.cat, []); hist.get(q.cat).push(q.v); }
  const odd = [];
  for (const q of monthParts(db, ym)) {
    if (q.kind !== 'expense' || q.split) continue;
    const h = hist.get(q.cat);
    if (!h || h.length < 5) continue;
    const med = median(h);
    if (q.v > 500 && q.v > med * 3) odd.push({ q, med });
  }
  odd.sort((x, y) => y.q.v - x.q.v);
  const seen = new Set();
  for (const o of odd.filter((x) => { const k = (x.q.label || '').toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 2)) out.push({ tone: 'warn', id: o.q.t.id, text: `${money(o.q.v)} for “${o.q.label || 'an entry'}” is about ${Math.round(o.q.v / o.med)}× a usual ${money(o.med)} in that category.` });
  // most visited place
  const visits = new Map();
  for (const q of monthParts(db, ym)) if (q.kind === 'expense' && !q.split && q.t.name) visits.set(q.t.name.trim(), (visits.get(q.t.name.trim()) || 0) + 1);
  const top = [...visits.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 4) out.push({ tone: 'note', text: `Most visits: “${top[0]}”, ${top[1]} times.` });
  // how much of income is kept
  const inc = totals(db, ym, 'income').total, sp = totals(db, ym).total;
  if (inc > 0 && (!p.live || p.day >= 10)) {
    const kept = Math.round((inc - sp) / inc * 100);
    out.push({ tone: kept >= 0 ? 'good' : 'warn', text: kept >= 0 ? `You kept ${kept}% of what came in.` : `You spent ${-kept}% more than came in.` });
  }
  return out.slice(0, 5);
}

// one group over time (for the detail sheet)
export function groupTrend(db, ym, group, kind, n = 6) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = shiftMonth(ym, -i);
    out.push({ m, v: sum(monthParts(db, m).filter((p) => p.kind === kind && p.group === group).map((p) => p.v)) });
  }
  return out;
}

// ---------- rolling daily average ----------
const addD = (d, n) => { const [y, m, dd] = d.split('-').map(Number), x = new Date(y, m - 1, dd + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
// spending per calendar day; days with nothing are simply absent (read as zero)
function dailyMap(db, from, to) { const m = new Map(); for (const p of partsBetween(db, from, to)) if (p.kind === 'expense') { const d = p.t.date.slice(0, 10); m.set(d, (m.get(d) || 0) + p.v); } return m; }
// For every day: the total of the 7 consecutive calendar days ending that day, divided by 7. Zero-spend days count as zero.
// It does not matter which weekday the window starts on, so Mon-Sun, Tue-Mon and Wed-Tue are all just successive windows.
export function rollingAverages(db, end, days = 365, win = 7) {
  const n = days + win - 1, map = dailyMap(db, addD(end, -(n - 1)), end), vals = [];
  for (let i = n - 1; i >= 0; i--) vals.push(map.get(addD(end, -i)) || 0);
  const out = []; let s = 0;
  for (let i = 0; i < n; i++) { s += vals[i]; if (i >= win) s -= vals[i - win]; if (i >= win - 1) out.push({ date: addD(end, -(n - 1 - i)), avg: s / win, total: s }); }
  return out;
}
// Today is not finished, so the window ends yesterday. Windows that start before your first expense are left out.
export function rollingSummary(db, now = nowStamp().slice(0, 10)) {
  const end = addD(now, -1), all = rollingAverages(db, end, 365, 7);
  let first = null; for (const t of db.txs) if (!t.deleted && t.kind === 'expense' && (!first || t.date < first)) first = t.date;
  const f = first ? first.slice(0, 10) : end, series = all.filter((x) => addD(x.date, -6) >= f);
  if (series.length < 14) return { end, series, enough: false, current: series.length ? series[series.length - 1] : null };
  const vals = series.map((x) => x.avg), by = new Map();
  for (const x of series) { const m = x.date.slice(0, 7), e = by.get(m) || { m, sum: 0, n: 0 }; e.sum += x.avg; e.n++; by.set(m, e); }
  const months = [...by.values()].map((e) => ({ m: e.m, avg: e.sum / e.n, n: e.n })), mv = months.filter((e) => e.n >= 20).map((e) => e.avg);
  const recent = mv.slice(-3), earlier = mv.slice(0, -3);
  const dm = dailyMap(db, addD(end, -29), end), daily = Array.from({ length: 30 }, (_, i) => { const d = addD(end, -(29 - i)); return { date: d, v: dm.get(d) || 0 }; });
  return { end, series, daily, enough: true, current: series[series.length - 1], typical: median(vals), lo: quantile(vals, 0.25), hi: quantile(vals, 0.75), months,
    recent: recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null, earlier: earlier.length ? earlier.reduce((a, b) => a + b, 0) / earlier.length : null, trend: lineTrend(mv) };
}
