// What the bottom bar and the Home screen show, and in what order. Both are chosen in Settings, Tabs and Home layout.
export const ALL_TABS = {
  home: ['Home', 'home'], ledger: ['Entries', 'list'], calendar: ['Calendar', 'calendar'], accounts: ['Accounts', 'wallet'],
  analytics: ['Analytics', 'chart'], budget: ['Budget', 'chart'], cashflow: ['Cash flow', 'chart'], outlook: ['Outlook', 'chart'],
  review: ['Review', 'list'], reports: ['Reports', 'chart'], settings: ['Settings', 'gear'],
};
export const DEFAULT_TABS = ['home', 'ledger', 'calendar', 'accounts'];
export const tabList = (s) => { const t = ((s && s.tabs) || DEFAULT_TABS).filter((k) => ALL_TABS[k]); return (t.length >= 3 ? t : DEFAULT_TABS).slice(0, 5); };
export const HOME_PARTS = [['totals', 'Month totals'], ['spendable', 'Spendable now'], ['alerts', 'Reminders and checks'], ['insights', 'Worth knowing'], ['pace', 'Spending pace and daily average'],
  ['outlook', 'Next month outlook'], ['out', 'Where it went'], ['inc', 'Where it came from'], ['six', 'Last 6 months'], ['latest', 'Latest entries']];
export const homeFull = (s) => { const known = HOME_PARTS.map((p) => p[0]), saved = ((s && s.homeOrder) || []).filter((k) => known.includes(k)); return [...new Set([...saved, ...known])]; };
export const homeOrder = (s) => { const hide = new Set((s && s.homeHide) || []); return homeFull(s).filter((k) => !hide.has(k)); };
