// src/features/cart/utils/validators.js
// Redirect legacy validation to the shared extras module to keep a single source of truth.

import { groupExtrasByGroupId, validateRequiredGroups } from '../../../shared/extras';

// Backward-compatible wrapper: accepts groups [{id,name,required,min,max}] and selectedByGroup {id: indexes[]}
export function validateRequiredExtras(groups = [], selectedByGroup = {}) {
  // Build a synthetic list of extras to reuse the shared validator
  const allExtras = [];
  groups.forEach((g) => {
    const maxSelectable = Number.isFinite(g.max) ? g.max : (g.max === 1 ? 1 : null);
    // Create one placeholder extra per potential selection (indexes are opaque here)
    // We only need group required info; ids will be `${groupId}:${index}` for present selections
    const selected = selectedByGroup[g.id] || [];
    // Put at least one entry so the group exists
    const placeholders = Math.max(1, selected.length);
    for (let i = 0; i < placeholders; i++) {
      allExtras.push({ id: `${g.id}:${i}`, name: 'extra', price: 0, groupId: g.id, required: !!g.required, maxSelectable });
    }
  });
  const groupsMap = groupExtrasByGroupId(allExtras);
  const selectedById = {};
  Object.entries(selectedByGroup).forEach(([gid, idxs = []]) => {
    idxs.forEach((i) => { selectedById[`${gid}:${i}`] = true; });
  });
  const res = validateRequiredGroups({ groups: groupsMap, selectedById });
  return { valid: res.valid, errors: res.valid ? [] : res.errors.map(e => `Sélection invalide pour ${e.groupId}`) };
}

export default { validateRequiredExtras };
