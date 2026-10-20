// Item name -> category for scanned receipts. Your own history is asked first; otherwise plain keyword rules
// (Japanese and English) are matched to whatever your categories are called. Unknown items stay unassigned.
const RULES = [
  [/シャンプー|リンス|コンディショナー|石鹸|石けん|ボディ|洗顔|歯ブラシ|歯磨|ハミガキ|化粧|スキンケア|カミソリ|生理|shampoo|soap|toothpaste/i, ['Toiletries', 'Personal Care', 'Health']],
  [/レジ袋|袋|洗剤|柔軟剤|ティッシュ|トイレ|ごみ袋|ゴミ袋|スポンジ|ラップ|キッチン|電池|detergent|tissue/i, ['Household', 'Supplies', 'Laundry']],
  [/薬|ビタミン|サプリ|絆創膏|マスク|目薬|vitamin|medicine/i, ['Health', 'Medicine', 'Personal Care']],
  [/ビール|ハイボール|ワイン|チューハイ|サワー|日本酒|焼酎|ウイスキー|酒|beer|wine|whisky/i, ['Alcohol', 'Drinks', 'Beverages', 'Groceries']],
  [/ウォーター|ミネラル|ソーダ|水|お茶|茶|ジュース|コーヒー|珈琲|コーラ|サイダー|炭酸|ボス|牛乳|豆乳|飲料|ドリンク|water|juice|coffee|tea|cola|milk/i, ['Drinks', 'Beverages', 'Groceries', 'Coffee']],
  [/肉|豚|牛|鶏|チキン|ハム|ベーコン|ソーセージ|ウインナー|焼豚|ステーキ|ひき肉|ミンチ|beef|pork|chicken|bacon|sausage/i, ['Meat', 'Groceries', 'Food']],
  [/魚|鮭|サーモン|まぐろ|マグロ|刺身|えび|エビ|いか|イカ|貝|ツナ|fish|salmon|shrimp/i, ['Groceries', 'Food']],
  [/野菜|キャベツ|トマト|玉ねぎ|たまねぎ|人参|にんじん|じゃがいも|きのこ|レタス|果物|りんご|バナナ|みかん|いちご|vegetable|fruit|apple|banana/i, ['Groceries', 'Food']],
  [/ポテト|チョコ|クッキー|スナック|アイス|菓子|ガム|キャンディ|グミ|せんべい|snack|chocolate|candy|ice cream/i, ['Snacks', 'Groceries', 'Food']],
  [/弁当|惣菜|サラダ|おにぎり|サンド|パン|ラーメン|うどん|そば|カツ|フライ|コロッケ|メンチ|唐揚|から揚|寿司|餃子|カレー|bento|sandwich|noodle|fried/i, ['Groceries', 'Dining out', 'Food']],
  [/米|卵|たまご|豆腐|納豆|味噌|みそ|醤油|しょうゆ|砂糖|塩|油|小麦|麺|パスタ|調味料|ヨーグルト|チーズ|バター|rice|egg|tofu|cheese|butter/i, ['Groceries', 'Food']],
];
export function itemCategory(db, name, model, predict, amt) {
  const cats = db.categories.filter((c) => !c.deleted && c.kind === 'expense'), n = String(name || '').trim();
  if (!n) return { id: '', how: '' };
  if (model && predict) { const p = predict(model, n, amt || 0, {}); const top = (p.cats || []).find((x) => cats.some((c) => c.id === x.id)); if (top && (p.exact || top.p >= 0.6)) return { id: top.id, how: 'your history', conf: top.p }; }
  const rule = RULES.find(([re]) => re.test(n.normalize('NFKC')));
  if (rule) for (const want of rule[1]) { const w = want.toLowerCase(), hit = cats.find((c) => c.name.toLowerCase() === w) || cats.find((c) => c.name.toLowerCase().includes(w)); if (hit) return { id: hit.id, how: 'keywords', conf: 0.5 }; }
  return { id: '', how: '' };
}
