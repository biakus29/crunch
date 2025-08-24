// Shared extras schema and helpers
// Aims to standardize extras across Admin and Front

// Canonical Extra shape
// {
//   id: string,
//   name: string,
//   price: number|string,
//   groupId?: string,            // to group extras (e.g., Sauces, Drinks)
//   required?: boolean,          // if at least one from group is required
//   maxSelectable?: number|null, // constraint per group
// }

export const toNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === 'string') return parseFloat(value.replace(/\./g, '')) || 0;
  return Number(value) || 0;
};

export function normalizeExtras(extras = []) {
  return extras
    .filter(Boolean)
    .map((e) => ({
      id: String(e.id ?? e._id ?? e.key ?? ''),
      name: String(e.name ?? e.label ?? ''),
      price: toNumber(e.price ?? 0),
      groupId: e.groupId ?? e.group ?? null,
      required: Boolean(e.required),
      maxSelectable: e.maxSelectable ?? e.max ?? null,
      raw: e,
    }));
}

export function groupExtrasByGroupId(extras = []) {
  const norm = normalizeExtras(extras);
  return norm.reduce((acc, ex) => {
    const g = ex.groupId || '__ungrouped__';
    if (!acc[g]) acc[g] = [];
    acc[g].push(ex);
    return acc;
  }, {});
}

export function validateRequiredGroups({ groups, selectedById }) {
  // Ensure required groups have at least one selected
  const errors = [];
  for (const [groupId, list] of Object.entries(groups)) {
    const required = list.some((ex) => ex.required);
    if (!required) continue;
    const ok = list.some((ex) => selectedById[ex.id]);
    if (!ok) {
      errors.push({ groupId, code: 'required_group_missing' });
    }
  }
  return { valid: errors.length === 0, errors };
}

export function clampGroupSelections({ groups, selectedIds }) {
  // Enforce maxSelectable per group
  const result = new Set(selectedIds);
  for (const [groupId, list] of Object.entries(groups)) {
    const max = list.reduce((m, ex) => (ex.maxSelectable ? Math.min(m ?? ex.maxSelectable, ex.maxSelectable) : m), null);
    if (!max) continue;
    const ids = list.map((x) => x.id);
    const selectedInGroup = ids.filter((id) => result.has(id));
    if (selectedInGroup.length > max) {
      // drop extras beyond max (FIFO)
      selectedInGroup.slice(max).forEach((id) => result.delete(id));
    }
  }
  return Array.from(result);
}

export function computeExtrasTotal(extras = []) {
  return normalizeExtras(extras).reduce((sum, ex) => sum + toNumber(ex.price), 0);
}

export default {
  toNumber,
  normalizeExtras,
  groupExtrasByGroupId,
  validateRequiredGroups,
  clampGroupSelections,
  computeExtrasTotal,
};
