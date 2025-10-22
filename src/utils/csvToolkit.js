// csvToolkit.js
// Dépendance: papaparse
// - ESM: import Papa from 'papaparse'
// - CDN (navigateur): window.Papa est disponible

// Import ESM (React/Node bundler). Pour CDN, commentez la ligne ci-dessous.
// eslint-disable-next-line import/no-unresolved
import Papa from 'papaparse';
import { useEffect, useMemo, useState, useCallback } from 'react';

/**
 * Détection heuristique des headers à partir du texte CSV.
 * Critères:
 * - La première ligne est "textuelle" (peu de nombres purs)
 * - Les valeurs de la première ligne sont uniques
 */
function detectHasHeader(rows) {
  if (!rows || rows.length < 2) return false;
  const first = rows[0];
  const second = rows[1] || [];
  const isNumeric = (v) => v !== '' && !Number.isNaN(Number(String(v).replace(',', '.')));
  const firstNumRatio =
    first.filter((v) => isNumeric(v)).length / Math.max(1, first.length);
  const secondNumRatio =
    second.filter((v) => isNumeric(v)).length / Math.max(1, second.length);

  const uniqueCount = new Set(first.map((v) => String(v).trim().toLowerCase())).size;
  const uniquenessScore = uniqueCount / Math.max(1, first.length);

  // Heuristique: la première ligne a moins de numériques et forte unicité.
  return firstNumRatio < secondNumRatio && uniquenessScore > 0.8;
}

/**
 * Supprime colonnes vides (toutes valeurs vides/whitespace) et retourne mapping des colonnes conservées.
 */
function dropEmptyColumns(rows) {
  if (!rows || rows.length === 0) return { rows, keptIndexes: [] };

  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const nonEmptyCols = [];
  for (let c = 0; c < colCount; c++) {
    let hasNonEmpty = false;
    for (let r = 0; r < rows.length; r++) {
      const val = rows[r][c];
      if (val != null && String(val).trim() !== '') {
        hasNonEmpty = true;
        break;
      }
    }
    if (hasNonEmpty) nonEmptyCols.push(c);
  }
  const cleaned = rows.map((r) => nonEmptyCols.map((c) => r[c] ?? ''));
  return { rows: cleaned, keptIndexes: nonEmptyCols };
}

/**
 * Nettoyage:
 * - Trim sur cellules
 * - Suppression lignes vides (toutes cellules vides après trim)
 */
function cleanRows(rows) {
  const trimmed = rows.map((r) => r.map((v) => (v == null ? '' : String(v).trim())));
  const nonEmpty = trimmed.filter((r) => r.some((v) => v !== ''));
  return nonEmpty;
}

/**
 * Conversion de types automatique ou via schéma.
 * - Auto: détecte boolean (true/false/oui/non), number (respecte virgule), Date ISO/locale simple
 * - Schéma: { colName|index: 'string'|'number'|'boolean'|'date'|fn(value)=>any }
 */
function convertTypes(rows, headers, options = {}) {
  const {
    schema = {}, // ex: { price: 'number', createdAt: 'date', active: 'boolean' }
    locale = 'fr-FR',
    dateParser, // fn(string)=>Date|any
  } = options;

  const toBoolean = (v) => {
    const s = String(v).trim().toLowerCase();
    if (['true', 'vrai', 'oui', '1', 'y', 'yes'].includes(s)) return true;
    if (['false', 'faux', 'non', '0', 'n', 'no'].includes(s)) return false;
    return v;
  };

  const toNumber = (v) => {
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    if (s === '') return v;
    const normalized = s.replace(/\s/g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isNaN(n) ? v : n;
  };

  const toDate = (v) => {
    if (!v || String(v).trim() === '') return v;
    if (dateParser) return dateParser(v);
    // Essais simples: ISO, dd/mm/yyyy, mm/dd/yyyy
    const s = String(v).trim();
    const iso = Date.parse(s);
    if (!Number.isNaN(iso)) return new Date(iso);
    const ddmmyyyy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (ddmmyyyy) {
      const d = Number(ddmmyyyy[1]);
      const m = Number(ddmmyyyy[2]) - 1;
      const y = Number(ddmmyyyy[3]);
      const dt = new Date(y, m, d);
      return Number.isNaN(dt.getTime()) ? v : dt;
    }
    const mmddyyyy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (mmddyyyy) {
      const m = Number(mmddyyyy[1]) - 1;
      const d = Number(mmddyyyy[2]);
      const y = Number(mmddyyyy[3]);
      const dt = new Date(y, m, d);
      return Number.isNaN(dt.getTime()) ? v : dt;
    }
    return v;
  };

  const applyRule = (val, rule) => {
    if (typeof rule === 'function') return rule(val);
    switch (rule) {
      case 'boolean':
        return toBoolean(val);
      case 'number':
        return toNumber(val);
      case 'date':
        return toDate(val);
      case 'string':
      default:
        return val == null ? '' : String(val);
    }
  };

  const autoConvert = (val) => {
    // ordre: boolean -> number -> date -> string (inchangé si échec)
    const b = toBoolean(val);
    if (b === true || b === false) return b;
    const n = toNumber(val);
    if (typeof n === 'number' && !Number.isNaN(n)) return n;
    const d = toDate(val);
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
    return val;
  };

  const result = rows.map((row) => {
    if (headers) {
      const obj = {};
      row.forEach((v, i) => {
        const key = headers[i] ?? `col_${i + 1}`;
        const rule = schema[key];
        obj[key] = rule ? applyRule(v, rule) : autoConvert(v);
      });
      return obj;
    } else {
      return row.map((v, i) => {
        const rule = schema[i];
        return rule ? applyRule(v, rule) : autoConvert(v);
      });
    }
  });

  return result;
}

/**
 * Transformations personnalisées:
 * - columnMap: { oldKey|index: newKey } (renomme)
 * - derive: (row)=>row étendu (ajoute/transforme)
 */
function transformData(data, options = {}) {
  const { columnMap = {}, derive } = options;

  const mapRow = (row) => {
    let r = row;
    // Renommage
    if (!Array.isArray(r)) {
      const out = {};
      Object.keys(r).forEach((k) => {
        const nk = columnMap[k] ?? k;
        out[nk] = r[k];
      });
      r = out;
    } else if (Object.keys(columnMap).length > 0) {
      // Si array + mapping fourni avec indices string/number
      const out = [];
      r.forEach((v, idx) => {
        const nk = columnMap[idx] ?? idx;
        out[nk] = v;
      });
      r = out;
    }
    // Dérivation
    if (typeof derive === 'function') {
      const derived = derive(r);
      return derived ?? r;
    }
    return r;
  };

  return data.map(mapRow);
}

/**
 * Filtrage avancé:
 * - predicate(row) => boolean
 * - DSL simple: { and: [...conditions] } | { or: [...conditions] } | condition
 *   condition: { field, op, value }
 *   op in ['==','!=','>','>=','<','<=','includes','startsWith','endsWith','matches']
 */
function filterData(data, filter) {
  if (!filter) return data;

  if (typeof filter === 'function') return data.filter(filter);

  const evalCond = (row, cond) => {
    const { field, op, value } = cond;
    const left = Array.isArray(row) ? row[field] : row[field];
    switch (op) {
      case '==':
        // si Date/Number, comparer par valeur
        return left instanceof Date && value instanceof Date
          ? left.getTime() === value.getTime()
          : left == value; // eslint-disable-line eqeqeq
      case '!=':
        return left instanceof Date && value instanceof Date
          ? left.getTime() !== value.getTime()
          : left != value; // eslint-disable-line eqeqeq
      case '>':
        return left > value;
      case '>=':
        return left >= value;
      case '<':
        return left < value;
      case '<=':
        return left <= value;
      case 'includes':
        return String(left).includes(String(value));
      case 'startsWith':
        return String(left).startsWith(String(value));
      case 'endsWith':
        return String(left).endsWith(String(value));
      case 'matches':
        return new RegExp(value).test(String(left));
      default:
        return false;
    }
  };

  const evalExpr = (row, expr) => {
    if (expr.and) return expr.and.every((e) => evalExpr(row, e));
    if (expr.or) return expr.or.some((e) => evalExpr(row, e));
    return evalCond(row, expr);
  };

  return data.filter((row) => evalExpr(row, filter));
}

/**
 * Résumé détaillé envoyé en console.
 */
function logSummary({ source, hasHeader, headers, rowsCount, droppedEmptyColumns, emptyRowsRemoved, sampleRows }) {
  // Limiter l'échantillon pour ne pas inonder la console
  const sample = (sampleRows || []).slice(0, 3);
  // eslint-disable-next-line no-console
  console.group('[CSV Summary]');
  // eslint-disable-next-line no-console
  console.log('Source:', source);
  // eslint-disable-next-line no-console
  console.log('Header détecté:', hasHeader);
  // eslint-disable-next-line no-console
  if (headers) console.log('Colonnes:', headers);
  // eslint-disable-next-line no-console
  console.log('Lignes (après nettoyage):', rowsCount);
  // eslint-disable-next-line no-console
  console.log('Colonnes vides supprimées:', droppedEmptyColumns);
  // eslint-disable-next-line no-console
  console.log('Lignes vides supprimées:', emptyRowsRemoved);
  // eslint-disable-next-line no-console
  console.log('Échantillon:', sample);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

/**
 * Lecture CSV depuis:
 * - URL: string commençant par http(s)
 * - Fichier local: File (navigateur), ou string/Buffer Node avec contenu CSV
 */
async function readCsvSource(source) {
  if (typeof window !== 'undefined' && typeof File !== 'undefined' && source instanceof File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(source);
    });
  }

  if (typeof source === 'string' && /^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Échec de la récupération: ${res.status} ${res.statusText}`);
    return await res.text();
  }

  // Si c'est déjà du texte CSV
  if (typeof source === 'string') {
    return source;
  }

  // Buffer ou autres
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(source)) {
    return source.toString('utf8');
  }

  throw new Error('Type de source non supporté. Utilisez URL, File (browser) ou texte CSV.');
}

/**
 * Parse CSV en utilisant PapaParse avec auto-détection header/colonnes vides.
 */
function parseCsvText(csvText, { delimiter, encoding, forceHeader } = {}) {
  // 1) Parse sans header pour analyse structurelle
  const base = Papa.parse(csvText, {
    delimiter, // peut être auto si undefined
    skipEmptyLines: false, // garder pour compter
    encoding,
  });

  if (base.errors?.length) {
    // eslint-disable-next-line no-console
    console.warn('PapaParse errors:', base.errors);
  }

  let rows = base.data || [];
  const originalRowCount = rows.length;

  // Trim + suppression lignes vides
  const rowsTrimmed = cleanRows(rows);
  const emptyRowsRemoved = originalRowCount - rowsTrimmed.length;

  // Suppression colonnes vides
  const { rows: rowsNoEmptyCols, keptIndexes } = dropEmptyColumns(rowsTrimmed);

  // Détecter header (ou forcer)
  const detectedHeader = detectHasHeader(rowsNoEmptyCols);
  const hasHeader = !!(forceHeader || detectedHeader);
  let headers = null;
  let bodyRows = rowsNoEmptyCols;
  if (hasHeader && rowsNoEmptyCols.length > 0) {
    headers = rowsNoEmptyCols[0].map((h, i) => {
      const name = String(h || `col_${i + 1}`).trim();
      return name || `col_${i + 1}`;
    });
    bodyRows = rowsNoEmptyCols.slice(1);
  }

  return {
    hasHeader,
    headers,
    rows: bodyRows,
    droppedEmptyColumns: keptIndexes.length ? 0 : 0 + 0, // compat, informationnel
    keptColumnIndexes: keptIndexes,
    emptyRowsRemoved,
    delimiterUsed: base.meta?.delimiter,
  };
}

/**
 * Pipeline complet:
 * 1. Lecture
 * 2. Parsing
 * 3. Conversion de types
 * 4. Transformation
 * 5. Filtrage
 * 6. Export optionnel
 */
export async function processCsv(source, options = {}) {
  const {
    parse = {}, // { delimiter, encoding }
    convert = {}, // { schema, locale, dateParser }
    transform = {}, // { columnMap, derive }
    filter, // fn(row)=>boolean ou DSL
    exportAs, // 'json' | 'text'
    log = true,
  } = options;

  const csvText = await readCsvSource(source);
  const { hasHeader, headers, rows, emptyRowsRemoved, keptColumnIndexes, delimiterUsed } = parseCsvText(
    csvText,
    parse
  );

  // Conversion de types
  const converted = convertTypes(rows, hasHeader ? headers : null, convert);

  // Transformations
  const transformed = transformData(converted, transform);

  // Filtrage
  const filtered = filterData(transformed, filter);

  // Résumé
  if (log) {
    logSummary({
      source: typeof source === 'string' ? source.slice(0, 120) : Object.prototype.toString.call(source),
      hasHeader,
      headers,
      rowsCount: filtered.length,
      droppedEmptyColumns: (headers ? 0 : 0) + (keptColumnIndexes ? 0 : 0),
      emptyRowsRemoved,
      sampleRows: filtered.slice(0, 3),
    });
    // Détails supplémentaires
    // eslint-disable-next-line no-console
    console.log('Délimiteur détecté:', delimiterUsed);
  }

  // Export
  let exported = null;
  if (exportAs === 'json') {
    exported = JSON.stringify(filtered, (_k, v) => (v instanceof Date ? v.toISOString() : v), 2);
  } else if (exportAs === 'text') {
    exported = filtered
      .map((row) => {
        if (typeof row === 'object' && !Array.isArray(row)) {
          return Object.entries(row)
            .map(([k, v]) => `${k}: ${v instanceof Date ? v.toISOString() : String(v)}`)
            .join(' | ');
        }
        return Array.isArray(row) ? row.join(' | ') : String(row);
      })
      .join('\n');
  }

  return {
    hasHeader,
    headers,
    data: filtered,
    exported,
    meta: {
      delimiterUsed,
      emptyRowsRemoved,
      keptColumnIndexes,
      rowCount: filtered.length,
    },
  };
}

/**
 * Exports utilitaires individuels si besoin.
 */
export const CsvUtils = {
  readCsvSource,
  parseCsvText,
  cleanRows,
  dropEmptyColumns,
  detectHasHeader,
  convertTypes,
  transformData,
  filterData,
};

/**
 * Hook React pour charger et traiter un CSV.
 * Usage:
 * const { data, headers, loading, error, reload, summary } = useCsvData(source, options)
 */
export function useCsvData(source, options = {}) {
  const [state, setState] = useState({
    data: [],
    headers: null,
    loading: false,
    error: null,
    summary: null,
    exported: null,
    meta: null,
  });

  const reload = useCallback(async () => {
    if (!source) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await processCsv(source, options);
      setState({
        data: result.data,
        headers: result.headers,
        loading: false,
        error: null,
        summary: {
          hasHeader: result.hasHeader,
          rowCount: result.meta?.rowCount,
          delimiterUsed: result.meta?.delimiterUsed,
        },
        exported: result.exported,
        meta: result.meta,
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }, [source, JSON.stringify(options)]); // options shallow-stable recommandé en prod

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const value = useMemo(() => ({ ...state, reload }), [state, reload]);
  return value;
}

/* -------------------------------------------------------
   EXEMPLES D'UTILISATION
----------------------------------------------------------

1) Node/Script (texte ou URL)
--------------------------------
// import { processCsv } from './csvToolkit.js';

// (async () => {
//   const { data, headers, exported } = await processCsv('https://example.com/data.csv', {
//     parse: { delimiter: undefined }, // auto
//     convert: {
//       schema: {
//         price: 'number',
//         createdAt: 'date',
//         active: 'boolean',
//       },
//     },
//     transform: {
//       columnMap: { 'old name': 'newName' },
//       derive: (row) => ({
//         ...row,
//         total: (row.qty ?? 0) * (row.price ?? 0),
//       }),
//     },
//     filter: {
//       and: [
//         { field: 'active', op: '==', value: true },
//         { field: 'price', op: '>=', value: 10 },
//       ],
//     },
//     exportAs: 'json',
//     log: true,
//   });

//   console.log('Rows traitées:', data.length);
//   console.log('Headers:', headers);
//   console.log('JSON exporté:', exported);
// })();

2) Navigateur + File input
---------------------------
// <input type="file" id="csvFile" />
// <script type="module">
//   import { processCsv } from './csvToolkit.js';
//   const input = document.getElementById('csvFile');
//   input.addEventListener('change', async (e) => {
//     const file = e.target.files[0];
//     const result = await processCsv(file, {
//       convert: { schema: { amount: 'number' } },
//       transform: { derive: (row) => ({ ...row, amountWithTax: (row.amount ?? 0) * 1.2 }) },
//     });
//     console.log(result);
//   });
// </script>

3) React Hook dans `src/App.js`
--------------------------------
// import React from 'react';
// import { useCsvData } from './utils/csvToolkit';

// export default function App() {
//   const { data, headers, loading, error, summary, reload } = useCsvData(
//     'https://example.com/data.csv',
//     {
//       convert: { schema: { price: 'number', active: 'boolean' } },
//       filter: (row) => row.active === true,
//     }
//   );

//   if (loading) return <div>Chargement…</div>;
//   if (error) return <div>Erreur: {error}</div>;

//   return (
//     <div>
//       <h1>CSV</h1>
//       <pre>{JSON.stringify(summary, null, 2)}</pre>
//       <button onClick={reload}>Recharger</button>
//       <table>
//         <thead>
//           <tr>
//             {(headers ?? Object.keys(data[0] ?? {})).map((h) => <th key={h}>{h}</th>)}
//           </tr>
//         </thead>
//         <tbody>
//           {data.slice(0, 50).map((row, idx) => (
//             <tr key={idx}>
//               {(headers ?? Object.keys(row)).map((h) => <td key={h}>{String(row[h])}</td>)}
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }

------------------------------------------------------- */
