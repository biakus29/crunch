import React, { useMemo, useState } from 'react';
import { useCsvData, processCsv } from '../utils/csvToolkit';
import { db } from '../firebase';
import { collection, doc, writeBatch, setDoc, addDoc } from 'firebase/firestore';

const styles = {
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: 24,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { margin: 0, fontSize: 24 },
  subtitle: { color: '#666', marginTop: 4 },
  card: {
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    marginBottom: 16,
  },
  row: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  input: {
    height: 36,
    padding: '0 12px',
    border: '1px solid #ddd',
    borderRadius: 8,
    outline: 'none',
  },
  select: { height: 36, padding: '0 10px', border: '1px solid #ddd', borderRadius: 8 },
  btn: {
    height: 36,
    padding: '0 14px',
    background: '#1f8a70',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  btnGhost: {
    height: 36,
    padding: '0 14px',
    background: 'transparent',
    color: '#1f8a70',
    border: '1px solid #1f8a70',
    borderRadius: 8,
    cursor: 'pointer',
  },
  badge: {
    display: 'inline-block',
    background: '#f5f7ff',
    color: '#3451e0',
    border: '1px solid #e3e7ff',
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    marginRight: 8,
  },
  tableWrap: { overflow: 'auto', border: '1px solid #eee', borderRadius: 12 },
  table: { borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 700 },
  th: {
    position: 'sticky',
    top: 0,
    background: '#fafafa',
    textAlign: 'left',
    borderBottom: '1px solid #eee',
    padding: '10px 12px',
    fontWeight: 600,
  },
  td: { borderBottom: '1px solid #f3f3f3', padding: '10px 12px' },
};

export default function CsvDemo() {
  const [sourceType, setSourceType] = useState('url'); // 'url' | 'file'
  const [url, setUrl] = useState('/sample.csv');
  const [file, setFile] = useState(null);
  const [exportMode, setExportMode] = useState('none'); // 'none' | 'json' | 'text'
  const [customFilter, setCustomFilter] = useState('');
  const [dbMode, setDbMode] = useState('insert'); // 'insert' | 'upsert'
  const [upsertKey, setUpsertKey] = useState('id');
  const [batchSize, setBatchSize] = useState(500);
  const [dbStatus, setDbStatus] = useState(null); // { ok, inserted, updated, failed, message }
  const [collectionName, setCollectionName] = useState('csv_imports');

  const source = sourceType === 'url' ? url : file;

  const options = useMemo(() => ({
    convert: { schema: { price: 'number', qty: 'number', active: 'boolean', createdAt: 'date' } },
    transform: { derive: (row) => ({ ...row, total: (row.qty ?? 0) * (row.price ?? 0) }) },
    filter: undefined,
    exportAs: exportMode === 'none' ? undefined : exportMode,
    log: true,
  }), [exportMode]);

  const { data, headers, loading, error, summary, exported, reload } = useCsvData(source, options);

  const cols = headers ?? Object.keys(data?.[0] ?? {});

  async function handleQuickFilterActive() {
    if (!source) return;
    await processCsv(source, { ...options, filter: { field: 'active', op: '==', value: true }, log: true });
    reload();
  }

  async function sendToFirestore() {
    if (!db) {
      setDbStatus({ ok: false, message: 'Firestore non initialisé.' });
      return;
    }
    if (!data?.length) {
      setDbStatus({ ok: false, message: 'Aucune donnée à envoyer.' });
      return;
    }
    setDbStatus({ ok: null, message: 'Envoi Firestore en cours…' });

    try {
      const colRef = collection(db, collectionName || 'csv_imports');
      const size = Math.max(1, Number(batchSize) || 500);
      let inserted = 0, updated = 0, failed = 0;

      for (let i = 0; i < data.length; i += size) {
        const part = data.slice(i, i + size);
        const batch = writeBatch(db);
        for (const row of part) {
          try {
            const keyVal = row?.[upsertKey];
            if (dbMode === 'upsert' && keyVal != null && keyVal !== '') {
              const ref = doc(colRef, String(keyVal));
              batch.set(ref, row, { merge: true });
              updated += 1; // considéré comme upsert (créé ou mis à jour)
            } else if (dbMode === 'insert' && keyVal != null && keyVal !== '') {
              const ref = doc(colRef, String(keyVal));
              batch.set(ref, row, { merge: false });
              inserted += 1;
            } else {
              // pas de clé utilisable, addDoc hors batch (writeBatch ne supporte pas add)
              await addDoc(colRef, row);
              inserted += 1;
            }
          } catch (_e) {
            failed += 1;
          }
        }
        await batch.commit();
      }

      setDbStatus({ ok: true, inserted, updated, failed, message: 'Import Firestore terminé.' });
    } catch (e) {
      setDbStatus({ ok: false, message: e?.message || 'Erreur Firestore' });
    }
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    setFile(f || null);
  }

  function parseDsl(dsl) {
    const m = dsl.match(/^\s*(\S+)\s*(==|!=|>=|<=|>|<|includes|startsWith|endsWith|matches)\s*(.+)\s*$/);
    if (!m) return null;
    let value = m[3].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }
    const num = Number(value.replace(',', '.'));
    const v = Number.isNaN(num) ? value : num;
    return { field: m[1], op: m[2], value: v };
  }

  async function applyDslFilter() {
    const expr = parseDsl(customFilter);
    if (!expr || !source) return;
    await processCsv(source, { ...options, filter: expr, log: true });
    reload();
  }

  async function sendToDb() {
    if (!data?.length) {
      setDbStatus({ ok: false, message: 'Aucune donnée à envoyer.' });
      return;
    }
    setDbStatus({ ok: null, message: 'Envoi en cours…' });

    const size = Math.max(1, Number(batchSize) || 500);
    const chunks = [];
    for (let i = 0; i < data.length; i += size) chunks.push(data.slice(i, i + size));

    let inserted = 0, updated = 0, failed = 0;
    try {
      for (const part of chunks) {
        const res = await fetch('/api/import-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: part,
            mode: dbMode, // 'insert' ou 'upsert'
            upsertKey,
          }),
        });
        if (!res.ok) {
          failed += part.length;
          continue;
        }
        const payload = await res.json().catch(() => ({}));
        inserted += Number(payload.inserted || 0);
        updated += Number(payload.updated || 0);
        failed += Number(payload.failed || 0);
      }
      setDbStatus({ ok: true, inserted, updated, failed, message: 'Terminé.' });
    } catch (e) {
      setDbStatus({ ok: false, inserted, updated, failed, message: e?.message || 'Erreur inconnue' });
    }
  }

  function downloadExport() {
    if (!exported) return;
    const blob = new Blob([exported], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csv-export-${Date.now()}.${exportMode === 'json' ? 'json' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>CSV Demo</h1>
          <div style={styles.subtitle}>Import, transformation, filtrage et restitution</div>
        </div>
        <div>
          <button style={styles.btnGhost} onClick={reload} disabled={!source || loading}>
            {loading ? 'Chargement…' : 'Recharger'}
          </button>
        </div>
      </div>

      <section style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Source</h3>
        <div style={styles.row}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name="sourceType" value="url" checked={sourceType === 'url'} onChange={() => setSourceType('url')} />
            URL
          </label>
          <input
            style={{ ...styles.input, width: 420 }}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemple.com/data.csv ou /sample.csv"
            disabled={sourceType !== 'url'}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="radio" name="sourceType" value="file" checked={sourceType === 'file'} onChange={() => setSourceType('file')} />
            Fichier
          </label>
          <input style={styles.input} type="file" accept=".csv,text/csv" onChange={onFileChange} disabled={sourceType !== 'file'} />

          <button style={styles.btn} onClick={reload} disabled={!source || loading}>Charger</button>
        </div>
      </section>

      <section style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Options</h3>
        <div style={styles.row}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Export:
            <select style={styles.select} value={exportMode} onChange={(e) => setExportMode(e.target.value)}>
              <option value="none">Aucun</option>
              <option value="json">JSON</option>
              <option value="text">Texte</option>
            </select>
          </label>
          <button style={styles.btnGhost} onClick={handleQuickFilterActive} disabled={!source || loading}>Filtrer active == true</button>
          <div style={styles.row}>
            <span>DSL filtre</span>
            <input
              style={{ ...styles.input, width: 220 }}
              type="text"
              value={customFilter}
              onChange={(e) => setCustomFilter(e.target.value)}
              placeholder="ex: price >= 10"
            />
            <button style={styles.btnGhost} onClick={applyDslFilter} disabled={!source || loading || !customFilter}>Appliquer</button>
          </div>
        </div>
        {exported && (
          <div style={{ marginTop: 12 }}>
            <button style={styles.btn} onClick={downloadExport}>Télécharger l'export</button>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Base de données</h3>
        <div style={styles.row}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Mode:
            <select style={styles.select} value={dbMode} onChange={(e) => setDbMode(e.target.value)}>
              <option value="insert">Insert</option>
              <option value="upsert">Upsert</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Clé d'upsert:
            <input style={{ ...styles.input, width: 160 }} type="text" value={upsertKey} onChange={(e) => setUpsertKey(e.target.value)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Batch:
            <input style={{ ...styles.input, width: 100 }} type="number" min={1} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Collection:
            <input style={{ ...styles.input, width: 200 }} type="text" value={collectionName} onChange={(e) => setCollectionName(e.target.value)} />
          </label>
          <button style={styles.btn} onClick={sendToDb} disabled={!data?.length}>POST /api/import-csv</button>
          <button style={styles.btnGhost} onClick={sendToFirestore} disabled={!data?.length}>Envoyer vers Firestore</button>
        </div>
        {dbStatus && (
          <div style={{ marginTop: 10 }}>
            <span style={styles.badge}>{dbStatus.ok === null ? '...' : dbStatus.ok ? 'Succès' : 'Erreur'}</span>
            {typeof dbStatus.inserted === 'number' && <span style={styles.badge}>Insérés: {dbStatus.inserted}</span>}
            {typeof dbStatus.updated === 'number' && <span style={styles.badge}>MàJ: {dbStatus.updated}</span>}
            {typeof dbStatus.failed === 'number' && <span style={styles.badge}>Échecs: {dbStatus.failed}</span>}
            <div style={{ color: dbStatus.ok ? '#1f8a70' : '#c00', marginTop: 6 }}>{dbStatus.message}</div>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Résumé</h3>
        {error && <div style={{ color: '#c00', marginBottom: 8 }}>Erreur: {error}</div>}
        <div>
          <span style={styles.badge}>Header: {String(summary?.hasHeader ?? false)}</span>
          <span style={styles.badge}>Lignes: {summary?.rowCount ?? 0}</span>
          <span style={styles.badge}>Délimiteur: {summary?.delimiterUsed ?? 'auto'}</span>
        </div>
      </section>

      <section style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Données</h3>
        {data?.length ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {cols.map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 200).map((row, idx) => (
                  <tr key={idx} style={{ background: idx % 2 ? '#fff' : '#fcfcfc' }}>
                    {cols.map((h) => (
                      <td key={h} style={styles.td}>
                        {row[h] instanceof Date ? row[h].toISOString() : String(row[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: '#666' }}>Aucune donnée à afficher</div>
        )}
      </section>
    </div>
  );
}
