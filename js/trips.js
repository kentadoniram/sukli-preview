// Public-transport trips: optional From / To / mode on an expense, and suggestions from your own history.
// "Ayala One - San Pedro" and "San Pedro - Ayala One" are the same route in opposite directions: they are counted together
// as one route (routeKey) but kept as two directions, and the time of day and your home place pick the direction.
export const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export const TRANSIT = /\b(bus|mrt|lrt|jeep(?:ney)?|tricycle|trike|train|subway|metro|ferry|taxi|grab|angkas|uv express|commute|fare)\b|電車|バス|地下鉄|モノレール|新幹線|タクシー/i;
export const MODES = ['Bus', 'MRT/LRT', 'Train', 'Jeepney', 'Taxi', 'Tricycle', 'Other'];
export const isTransitName = (n) => TRANSIT.test(String(n || '').normalize('NFKC'));
export const isTransitCat = (db, id) => { const c = db.categories.find((x) => x.id === id); return !!c && /transport|commute|travel|交通/i.test(`${c.name} ${c.group || ''}`); };
export function modeOf(name) {
  const n = String(name || '').normalize('NFKC').toLowerCase();
  if (/\bbus\b|バス/.test(n)) return 'Bus'; if (/mrt|lrt|地下鉄|モノレール/.test(n)) return 'MRT/LRT'; if (/train|subway|metro|電車|新幹線/.test(n)) return 'Train';
  if (/jeep/.test(n)) return 'Jeepney'; if (/taxi|grab|angkas|タクシー/.test(n)) return 'Taxi'; if (/tricycle|trike/.test(n)) return 'Tricycle'; return '';
}
export const routeKey = (a, b) => [norm(a), norm(b)].sort().join('|');
const trips = (db) => db.txs.filter((t) => !t.deleted && t.route && (t.route.from || t.route.to));
const hourOf = (t) => +String(t.date).slice(11, 13) || 0;
// home: your own setting, else the place you most often leave in the morning and arrive at in the evening
export function guessHome(db, settings) {
  if (settings && settings.homePlace && settings.homePlace.trim()) return settings.homePlace.trim();
  const c = new Map();
  for (const t of trips(db)) { const h = hourOf(t); const p = h < 10 ? t.route.from : h >= 17 ? t.route.to : ''; if (!p) continue; const k = norm(p), e = c.get(k) || { p, n: 0 }; e.n++; c.set(k, e); }
  const best = [...c.values()].sort((a, b) => b.n - a.n)[0]; return best && best.n >= 3 ? best.p : '';
}
export function knownPlaces(db) { const m = new Map(); for (const t of trips(db)) for (const p of [t.route.from, t.route.to]) if (p) m.set(norm(p), p); return [...m.values()].sort(); }
export function suggestTrips(db, { hour = 12, from = '', mode = '', home = '' } = {}) {
  const all = trips(db); if (all.length < 2) return [];
  const near = all.filter((t) => { const d = Math.abs(hourOf(t) - hour); return Math.min(d, 24 - d) <= 3; }), pool = near.length >= 2 ? near : all, sc = new Map();
  for (const t of pool) {
    if (from && norm(t.route.from) !== norm(from)) continue;
    const k = `${norm(t.route.from)}>${norm(t.route.to)}>${t.route.mode || ''}`, e = sc.get(k) || { from: t.route.from, to: t.route.to, mode: t.route.mode || '', n: 0 };
    e.n += 1 + (mode && t.route.mode === mode ? 0.5 : 0); sc.set(k, e);          // a matching mode ranks higher, it never hides a route
  }
  let list = [...sc.values()].sort((a, b) => b.n - a.n);
  if (home && !from) { const h = norm(home), out = hour < 11, back = hour >= 16; const ok = list.filter((e) => (out ? norm(e.from) === h : back ? norm(e.to) === h : true)); if (ok.length) list = ok; }   // 6 am: you leave home, not arrive at it
  return list.slice(0, 3);
}
