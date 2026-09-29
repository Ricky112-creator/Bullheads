// Branch helpers shared by every /api endpoint and by _middleware.js.
// One codebase, one database: a "branch" is just a label on an order / staff login / alert phone / menu board.
//   ''    = not tied to one branch (the main site, or an owner who wants to see everything)
//   'one' = Bullhead One  (branch1.bullheadhotels.co.ke)
//   'two' = Bullhead Two  (branch2.bullheadhotels.co.ke)
// To add a third branch later: add it here, in js/branches.js, and add the domain in Cloudflare Pages.

export const BRANCH_KEYS = ['one', 'two'];
export const BRANCH_NAMES = { one: 'Bullhead One', two: 'Bullhead Two' };
export const BRANCH_HOSTS = { one: 'branch1.bullheadhotels.co.ke', two: 'branch2.bullheadhotels.co.ke' };

export const cleanBranch = (v) => (BRANCH_KEYS.includes(String(v || '')) ? String(v) : '');

// branch1.<domain> -> 'one', branch2.<domain> -> 'two', anything else -> ''
export function hostBranch(host) {
  const h = String(host || '').toLowerCase();
  if (h.startsWith('branch1.')) return 'one';
  if (h.startsWith('branch2.')) return 'two';
  return '';
}

// "Bullhead One" / "Bullhead Two" (the value of the counter picker) -> 'one' / 'two'
export function counterBranch(counter) {
  const c = String(counter || '');
  return /\bone\b/i.test(c) ? 'one' : /\btwo\b/i.test(c) ? 'two' : '';
}

// Which branch an order belongs to, from the stored order object (older orders only have the counter text).
export const branchOfOrder = (o) => cleanBranch(o && o.branch) || counterBranch(o && o.counter);

// Same thing as a SQL expression over the orders.body JSON, so scoping happens in the query
// (no schema change, and the 150-row dashboard list is never filled with the other branch's orders).
export const ORDER_BRANCH_SQL =
  "COALESCE(NULLIF(json_extract(body,'$.branch'),''), CASE json_extract(body,'$.counter') WHEN 'Bullhead One' THEN 'one' WHEN 'Bullhead Two' THEN 'two' END, '')";
