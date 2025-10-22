import React, { useState, useMemo } from 'react';
import { useCsvData } from '../utils/csvToolkit';
import { db, rtdb, storage } from '../firebase';
import { collection, doc, writeBatch, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as rtdbRef, set as rtdbSet, push as rtdbPush, update as rtdbUpdate } from 'firebase/database';

const styles = {
  container: { maxWidth: 1400, margin: '0 auto', padding: 24 },
  header: { marginBottom: 24 },
  title: { margin: 0, fontSize: 28, color: '#1f8a70' },
  subtitle: { color: '#666', marginTop: 8, fontSize: 16 },
  card: {
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    marginBottom: 20,
  },
  row: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  input: { height: 36, padding: '0 12px', border: '1px solid #ddd', borderRadius: 8, outline: 'none' },
  select: { height: 36, padding: '0 10px', border: '1px solid #ddd', borderRadius: 8 },
  btn: {
    height: 36,
    padding: '0 16px',
    background: '#1f8a70',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 500,
  },
  btnDanger: {
    height: 36,
    padding: '0 16px',
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 500,
  },
  btnGhost: {
    height: 36,
    padding: '0 16px',
    background: 'transparent',
    color: '#1f8a70',
    border: '1px solid #1f8a70',
    borderRadius: 8,
    cursor: 'pointer',
  },
  badge: {
    display: 'inline-block',
    background: '#f0f9ff',
    color: '#0369a1',
    border: '1px solid #bae6fd',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  badgeSuccess: {
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  badgeError: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
  },
  tableWrap: { overflow: 'auto', border: '1px solid #eee', borderRadius: 12, maxHeight: 600 },
  table: { borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 800 },
  th: {
    position: 'sticky',
    top: 0,
    background: '#fafafa',
    textAlign: 'left',
    borderBottom: '1px solid #eee',
    padding: '12px',
    fontWeight: 600,
    fontSize: 14,
  },
  td: { borderBottom: '1px solid #f3f3f3', padding: '12px', fontSize: 14 },
  tdContent: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  mappingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
    marginTop: 16,
  },
  mappingCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 16,
    background: '#f9fafb',
  },
};

// Schéma des commandes attendu
const COMMANDES_SCHEMA = {
  id: { type: 'string', required: false, description: 'ID unique de la commande (auto si manquant)' },
  numeroCommande: { type: 'string', required: false, description: 'Numéro de commande affiché' },
  client: { type: 'string', required: false, description: 'Nom du client' },
  telephone: { type: 'string', required: false, description: 'Téléphone client' },
  email: { type: 'string', required: false, description: 'Email client' },
  adresse: { type: 'string', required: false, description: 'Adresse de livraison' },
  produits: { type: 'array', required: false, description: 'Liste des produits (JSON ou texte)' },
  total: { type: 'number', required: false, description: 'Montant total' },
  dateCommande: { type: 'date', required: false, description: 'Date de la commande' },
  statut: { type: 'string', required: false, description: 'Statut: en_attente, confirmee, livree, annulee' },
  restaurant: { type: 'string', required: false, description: 'Restaurant/établissement' },
  notes: { type: 'string', required: false, description: 'Notes particulières' },
};

// Mapping automatique intelligent basé sur les noms de colonnes
const autoMapColumns = (headers) => {
  const mapping = {};
  
  headers.forEach(header => {
    const normalized = header.toLowerCase().trim();
    
    // Mapping pour ID
    if (['id', 'order_id', 'orderid', 'commande_id', 'numero', 'n°'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'id';
    }
    // Mapping pour client
    else if (['client', 'customer', 'nom', 'name', 'utilisateur', 'user'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'client';
    }
    // Mapping pour téléphone
    else if (['tel', 'phone', 'telephone', 'mobile', 'numero'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'telephone';
    }
    // Mapping pour email
    else if (['email', 'mail', 'e-mail', '@'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'email';
    }
    // Mapping pour adresse
    else if (['adresse', 'address', 'livraison', 'delivery'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'adresse';
    }
    // Mapping pour produits
    else if (['produit', 'product', 'item', 'article', 'commande', 'order'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'produits';
    }
    // Mapping pour total
    else if (['total', 'montant', 'prix', 'price', 'amount', 'cout', 'cost', '€', '$'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'total';
    }
    // Mapping pour date
    else if (['date', 'time', 'created', 'timestamp', 'heure'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'dateCommande';
    }
    // Mapping pour statut
    else if (['statut', 'status', 'etat', 'state', 'progress'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'statut';
    }
    // Mapping pour restaurant
    else if (['restaurant', 'resto', 'etablissement', 'shop', 'store'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'restaurant';
    }
    // Mapping pour notes
    else if (['note', 'comment', 'remarque', 'observation', 'info'].some(pattern => 
        normalized.includes(pattern))) {
      mapping[header] = 'notes';
    }
  });
  
  return mapping;
};

export default function HistoriqueCommandes() {
  const [csvFile, setCsvFile] = useState(null);
  const [csvUrl, setCsvUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [columnMapping, setColumnMapping] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [previewMode, setPreviewMode] = useState(true);
  const [existingCount, setExistingCount] = useState(0);
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [excludedRows, setExcludedRows] = useState(new Set());
  const [limitPreview, setLimitPreview] = useState(true);
  const [freeMode, setFreeMode] = useState(true); // Mode sans mapping: colonnes CSV telles quelles
  const [migrationKey, setMigrationKey] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [preparedStats, setPreparedStats] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState({ uploaded: false, batchesDone: 0, totalBatches: 0 });

  // Configuration CSV spécialisée pour les commandes
  const csvOptions = useMemo(() => ({
    parse: { forceHeader: true },
    convert: {
      schema: {
        total: 'number',
        dateCommande: 'date',
        date: 'date',
        prix: 'number',
        montant: 'number',
      }
    },
    transform: {
      ...(freeMode ? {} : { columnMap: columnMapping }),
      derive: (row) => {
        // Traitement spécial pour les produits (peut être du JSON ou du texte)
        if (row.produits && typeof row.produits === 'string') {
          try {
            row.produits = JSON.parse(row.produits);
          } catch {
            // Si ce n'est pas du JSON, on garde le texte
            row.produits = row.produits.split(',').map(p => p.trim()).filter(Boolean);
          }
        }
        
        // Normalisation du statut
        if (row.statut) {
          const statut = String(row.statut).toLowerCase().trim();
          if (['pending', 'en attente', 'attente'].includes(statut)) row.statut = 'en_attente';
          else if (['confirmed', 'confirmé', 'confirmee'].includes(statut)) row.statut = 'confirmee';
          else if (['delivered', 'livré', 'livree'].includes(statut)) row.statut = 'livree';
          else if (['cancelled', 'annulé', 'annulee'].includes(statut)) row.statut = 'annulee';
        }

        // Générer un id si manquant (priorité: numeroCommande → composite → random)
        if (!row.id || String(row.id).trim() === '') {
          const base = row.numeroCommande || `${(row.client || 'client').toString().slice(0,8)}-${Date.now()}`;
          row.id = String(base).replace(/\s+/g, '-').toLowerCase();
        }

        // Ajout timestamp de migration
        row.migratedAt = new Date();
        row.source = 'csv_migration';
        if (csvUrl) row.sourceUrl = csvUrl;

        return row;
      }
    },
    log: true,
  }), [columnMapping, freeMode, csvUrl]);

  const normalizedUrl = useMemo(() => {
    if (!urlInput) return "";
    try {
      const u = new URL(urlInput);
      // Google Sheets: convertir en export CSV si nécessaire
      // Formats pris en charge: /spreadsheets/d/{id}/edit#gid=123 → export?format=csv&gid=123
      if (u.hostname.includes('docs.google.com') && u.pathname.includes('/spreadsheets/')) {
        const idMatch = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
        const id = idMatch?.[1];
        const gidMatch = u.hash.match(/gid=(\d+)/);
        const gid = gidMatch?.[1];
        if (id) {
          const params = new URLSearchParams({ format: 'csv' });
          if (gid) params.set('gid', gid);
          return `https://docs.google.com/spreadsheets/d/${id}/export?${params.toString()}`;
        }
      }
      return urlInput; // URL générique CSV
    } catch {
      return urlInput;
    }
  }, [urlInput]);

  const { data, headers, loading, error, summary } = useCsvData(csvFile || csvUrl, csvOptions);

  // Chargement du nombre de commandes existantes
  React.useEffect(() => {
    if (!db) return;
    const fetchExistingCount = async () => {
      try {
        const q = query(collection(db, 'commandes'), limit(1));
        const snapshot = await getDocs(q);
        setExistingCount(snapshot.size > 0 ? '?' : 0); // Approximation
      } catch (e) {
        console.warn('Impossible de compter les commandes existantes:', e);
      }
    };
    fetchExistingCount();
  }, [db]);

  const toggleHiddenCol = (col) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  };

  const clearHiddenCols = () => setHiddenCols(new Set());

  const toggleRowExcluded = (rowIndex) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex); else next.add(rowIndex);
      return next;
    });
  };

  const removeSelectedRows = () => {
    if (excludedRows.size === 0) return;
    setImportStatus({ success: null, message: `${excludedRows.size} ligne(s) exclue(s) de l'import` });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setCsvFile(file || null);
    if (file) {
      setImportStatus(null);
      setPreviewMode(true);
      // Reset mapping pour permettre l'auto-mapping
      setColumnMapping({});
      setHiddenCols(new Set());
      setExcludedRows(new Set());
      setLimitPreview(true);
      setFreeMode(true);
      setCsvUrl("");
      setUrlInput("");
      setMigrationKey(null);
      setStorageInfo(null);
      setPreparedStats(null);
    }
  };

  const handleLoadUrl = () => {
    if (!normalizedUrl) return;
    setImportStatus(null);
    setPreviewMode(true);
    setCsvFile(null);
    setCsvUrl(normalizedUrl);
    setColumnMapping({});
    setHiddenCols(new Set());
    setExcludedRows(new Set());
    setLimitPreview(true);
    setFreeMode(true);
    setMigrationKey(null);
    setStorageInfo(null);
    setPreparedStats(null);
  };

  const prepareMigration = async () => {
    try {
      setPreparing(true);
      setPrepareProgress({ uploaded: false, batchesDone: 0, totalBatches: 0 });
      setImportStatus({ success: null, message: 'Préparation en cours (stockage + log)...' });
      // Créer enregistrement et upload CSV + rows filtrées
      if (!rtdb) throw new Error('Realtime Database indisponible');
      const mref = rtdbPush(rtdbRef(rtdb, 'csv_migrations'));
      const key = mref.key;

      // Upload CSV si possible
      let sInfo = null;
      if (storage && (csvFile || csvUrl)) {
        try {
          let blob = null;
          let fileName = 'from_url.csv';
          if (csvFile) {
            blob = csvFile;
            fileName = csvFile.name || 'upload.csv';
          } else if (csvUrl) {
            try {
              const resp = await fetch(csvUrl);
              const fetchedBlob = await resp.blob();
              blob = new File([fetchedBlob], fileName, { type: fetchedBlob.type || 'text/csv' });
            } catch (err) {
              // logs masqués
            }
          }
          if (blob) {
            const path = `csv_migrations/${Date.now()}_${fileName}`;
            const sref = storageRef(storage, path);
            const arrayBuffer = await blob.arrayBuffer();
            await uploadBytes(sref, new Uint8Array(arrayBuffer), { contentType: blob.type || 'text/csv' });
            const url = await getDownloadURL(sref);
            sInfo = { path, url, name: fileName, size: blob.size };
            setPrepareProgress((p) => ({ ...p, uploaded: true }));
          }
        } catch (e) {
          // logs masqués
        }
      }

      const colsAll = headers || Object.keys(data?.[0] || {});
      const colsFiltered = colsAll.filter(c => !hiddenCols.has(c));
      const prepared = data
        .map((row, idx) => ({ row, idx }))
        .filter(({ idx }) => !excludedRows.has(idx))
        .map(({ row }) => {
          const cleaned = {};
          colsFiltered.forEach((c) => { cleaned[c] = row[c]; });
          return cleaned;
        });

      await rtdbSet(rtdbRef(rtdb, `csv_migrations/${key}/meta`), {
        createdAt: Date.now(),
        sourceUrl: csvUrl || null,
        file: sInfo || null,
        headers: colsFiltered,
        counts: { total: data.length, excluded: excludedRows.size, prepared: prepared.length },
      });

      const batchSize = 200;
      const totalBatches = Math.ceil(prepared.length / batchSize);
      setPrepareProgress((p) => ({ ...p, totalBatches }));
      for (let i = 0; i < prepared.length; i += batchSize) {
        const slice = prepared.slice(i, i + batchSize);
        const payload = {};
        slice.forEach((row, idx) => { payload[String(i + idx)] = row; });
        await rtdbUpdate(rtdbRef(rtdb, `csv_migrations/${key}/rows`), payload);
        setPrepareProgress((p) => ({ ...p, batchesDone: Math.min(p.batchesDone + 1, totalBatches) }));
        // Yield to UI thread for very large imports
        await new Promise((res) => setTimeout(res, 0));
      }

      setMigrationKey(key);
      setStorageInfo(sInfo);
      setPreparedStats({ total: data.length, excluded: excludedRows.size, prepared: prepared.length });
      setImportStatus({ success: true, message: 'Préparation terminée. Vous pouvez confirmer la migration vers Firestore.' });
      setPreparing(false);
    } catch (e) {
      setImportStatus({ success: false, message: 'Préparation échouée: ' + (e.message || 'Inconnue') });
      setPreparing(false);
    }
  };

  // Auto-mapping désactivé en mode libre; activé sinon
  React.useEffect(() => {
    if (freeMode) return;
    if (headers && headers.length > 0 && Object.keys(columnMapping).length === 0) {
      const autoMapping = autoMapColumns(headers);
      setColumnMapping(autoMapping);
      // logs masqués
    }
  }, [headers, columnMapping, freeMode]);

  const updateColumnMapping = (csvColumn, targetField) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvColumn]: targetField || undefined
    }));
  };

  const validateData = () => {
    if (!data?.length) return { valid: true };
    // Conserver l'analyse de couverture si besoin futur, mais ne pas émettre d'avertissements
    const coverage = {};
    const fields = Object.keys(COMMANDES_SCHEMA);
    fields.forEach((f) => {
      const count = data.reduce((acc, r) => acc + (r[f] != null && r[f] !== '' ? 1 : 0), 0);
      coverage[f] = { present: count, ratio: count / data.length };
    });
    return { valid: true, coverage };
  };

  const importToFirestore = async () => {
    if (!db || !data?.length) return;

    const validation = validateData();
    if (!validation.valid) {
      setImportStatus({
        success: false,
        message: 'Validation échouée: ' + validation.errors.join(', ')
      });
      return;
    }

    setImportStatus({ success: null, message: 'Import en cours...' });

    try {
      // 1) Si aucune préparation faite, on prépare d'abord pour garantir stockage + log
      if (rtdb && !migrationKey) {
        const mref = rtdbPush(rtdbRef(rtdb, 'csv_migrations'));
        const key = mref.key;

        // Uploader le CSV source dans Storage si possible
        try {
          if (storage && (csvFile || csvUrl)) {
            let blob = null;
            let fileName = 'from_url.csv';
            if (csvFile) {
              blob = csvFile;
              fileName = csvFile.name || 'upload.csv';
            } else if (csvUrl) {
              const resp = await fetch(csvUrl);
              const fetchedBlob = await resp.blob();
              blob = new File([fetchedBlob], fileName, { type: fetchedBlob.type || 'text/csv' });
            }
            if (blob) {
              const path = `csv_migrations/${Date.now()}_${fileName}`;
              const sref = storageRef(storage, path);
              const arrayBuffer = await blob.arrayBuffer();
              await uploadBytes(sref, new Uint8Array(arrayBuffer), { contentType: blob.type || 'text/csv' });
              const url = await getDownloadURL(sref);
              const sInfo = { path, url, name: fileName, size: blob.size };
              setStorageInfo(sInfo);
            }
          }
        } catch (e) {
          console.warn('Upload Storage échoué (non bloquant):', e);
        }

        // Préparer les données filtrées (colonnes visibles et lignes non exclues)
        const colsAll = headers || Object.keys(data?.[0] || {});
        const colsFiltered = colsAll.filter(c => !hiddenCols.has(c));
        const prepared = data
          .map((row, idx) => ({ row, idx }))
          .filter(({ idx }) => !excludedRows.has(idx))
          .map(({ row }) => {
            const cleaned = {};
            colsFiltered.forEach((c) => { cleaned[c] = row[c]; });
            return cleaned;
          });

        // Enregistrer l'entête et un résumé + pousser les lignes par lots pour éviter des payloads massifs
        await rtdbSet(rtdbRef(rtdb, `csv_migrations/${key}/meta`), {
          createdAt: Date.now(),
          sourceUrl: csvUrl || null,
          file: storageInfo || null,
          headers: colsFiltered,
          counts: { total: data.length, excluded: excludedRows.size, prepared: prepared.length },
        });

        const batchSize = 200;
        for (let i = 0; i < prepared.length; i += batchSize) {
          const slice = prepared.slice(i, i + batchSize);
          const payload = {};
          slice.forEach((row, idx) => {
            payload[String(i + idx)] = row;
          });
          await rtdbUpdate(rtdbRef(rtdb, `csv_migrations/${key}/rows`), payload);
        }
        setMigrationKey(key);
      }

      const commandesRef = collection(db, 'commandes');
      let imported = 0, failed = 0;

      // Appliquer filtres (colonnes masquées et lignes exclues)
      const cols = headers || Object.keys(data?.[0] || {});
      const colsFiltered = cols.filter(c => !hiddenCols.has(c));
      const prepared = data
        .map((row, idx) => ({ row, idx }))
        .filter(({ idx }) => !excludedRows.has(idx))
        .map(({ row }) => {
          const cleaned = {};
          colsFiltered.forEach((c) => { cleaned[c] = row[c]; });
          if (migrationKey) cleaned._migrationId = migrationKey;
          return cleaned;
        });

      // Import par lots de 500 (limite Firestore)
      for (let i = 0; i < prepared.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = prepared.slice(i, i + 500);

        for (const row of chunk) {
          try {
            // Utiliser l'ID de la commande si disponible, sinon générer
            if (row.id && String(row.id).trim()) {
              const docRef = doc(commandesRef, String(row.id).trim());
              batch.set(docRef, row, { merge: false }); // Pas de merge pour éviter les doublons
            } else {
              // Pour les docs sans ID, on utilise addDoc (hors batch)
              await addDoc(commandesRef, row);
            }
            imported++;
          } catch (e) {
            console.error('Erreur ligne:', row, e);
            failed++;
          }
        }

        if (chunk.some(row => row.id && String(row.id).trim())) {
          await batch.commit();
        }
      }

      setImportStatus({
        success: true,
        message: `Import terminé: ${imported} commandes importées, ${failed} échecs (après filtres)` + (storageInfo ? ` • Fichier: ${storageInfo.name}` : ''),
        imported,
        failed
      });

    } catch (error) {
      setImportStatus({
        success: false,
        message: 'Erreur Firestore: ' + (error.message || 'Inconnue')
      });
    }
  };

  const cols = headers || Object.keys(data?.[0] || {});
  const colsFiltered = cols.filter(c => !hiddenCols.has(c));
  const visibleRowCount = (data?.length || 0) - excludedRows.size;
  const schemaFields = Object.keys(COMMANDES_SCHEMA);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Migration Historique Commandes</h1>
        <p style={styles.subtitle}>
          Import CSV depuis Google Sheets vers Firestore • Collection: <strong>commandes</strong>
        </p>
      </div>

      {/* Section Import */}
      <section style={styles.card}>
        <h3 style={{ marginTop: 0 }}>1. Import CSV</h3>
        <div style={styles.row}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            style={styles.input}
          />
          {csvFile && (
            <span style={styles.badge}>
              {csvFile.name} ({Math.round(csvFile.size / 1024)} Ko)
            </span>
          )}
        </div>
        <div style={{ ...styles.row, marginTop: 8 }}>
          <input
            type="url"
            placeholder="Coller un lien CSV ou Google Sheets (lecture publique)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            style={{ ...styles.input, minWidth: 420 }}
          />
          <button style={styles.btn} onClick={handleLoadUrl} disabled={!urlInput}>Charger par lien</button>
          {normalizedUrl && (
            <span style={styles.badge}>Lien préparé: {normalizedUrl.slice(0, 80)}{normalizedUrl.length > 80 ? '…' : ''}</span>
          )}
          {csvUrl && (
            <span style={styles.badge}>Source: URL</span>
          )}
        </div>
        {loading && <div>Analyse du fichier...</div>}
        {/* Erreurs masquées à la demande */}
      </section>

      {/* Section Mapping */}
      {!freeMode && headers && (
        <section style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>2. Mapping automatique des colonnes</h3>
            <div>
              <span style={styles.badgeSuccess}>
                🤖 {Object.keys(columnMapping).filter(k => columnMapping[k]).length} colonnes mappées
              </span>
              <button
                style={styles.btnGhost}
                onClick={() => {
                  const autoMapping = autoMapColumns(headers);
                  setColumnMapping(autoMapping);
                }}
              >
                Re-mapper automatiquement
              </button>
            </div>
          </div>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Mapping intelligent basé sur les noms de colonnes. Modifiez si nécessaire:
          </p>
          <div style={styles.mappingGrid}>
            {headers.map(csvCol => {
              const mappedField = columnMapping[csvCol];
              const isAutoMapped = mappedField && mappedField !== '';
              return (
                <div key={csvCol} style={{
                  ...styles.mappingCard,
                  borderColor: isAutoMapped ? '#10b981' : '#e5e7eb',
                  background: isAutoMapped ? '#f0fdf4' : '#f9fafb'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    CSV: <code>{csvCol}</code>
                    {isAutoMapped && <span style={{ color: '#10b981', marginLeft: 8 }}>✓</span>}
                  </div>
                  <select
                    style={{
                      ...styles.select,
                      borderColor: isAutoMapped ? '#10b981' : '#ddd'
                    }}
                    value={mappedField || ''}
                    onChange={(e) => updateColumnMapping(csvCol, e.target.value)}
                  >
                    <option value="">-- Ignorer --</option>
                    {schemaFields.map(field => (
                      <option key={field} value={field}>
                        {field} {COMMANDES_SCHEMA[field].required ? '*' : ''}
                      </option>
                    ))}
                  </select>
                  {mappedField && (
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      {COMMANDES_SCHEMA[mappedField]?.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Section Aperçu */}
      {data?.length > 0 && (
        <section style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>3. Aperçu des données</h3>
            <div>
              <span style={styles.badge}>
                {data.length} lignes totales
              </span>
              <span style={styles.badge}>
                Exclues: {excludedRows.size}
              </span>
              <span style={styles.badge}>
                Colonnes visibles: {colsFiltered.length}/{cols.length}
              </span>
            </div>
          </div>

          {/* Mode d’import */}
          <div style={{ ...styles.row, marginBottom: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={freeMode} onChange={(e) => setFreeMode(e.target.checked)} />
              Mode sans mapping (toutes les colonnes CSV importées telles quelles)
            </label>
          </div>

          {/* Outils d'aperçu */}
          <div style={{ ...styles.row, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={limitPreview} onChange={(e) => setLimitPreview(e.target.checked)} />
              Limiter l'aperçu (20 lignes / 8 colonnes)
            </label>
            <button style={styles.btnGhost} onClick={removeSelectedRows}>
              Supprimer lignes sélectionnées ({excludedRows.size})
            </button>
          </div>

          {/* Gestion des colonnes */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Colonnes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {cols.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleHiddenCol(c)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: `1px solid ${hiddenCols.has(c) ? '#e5e7eb' : '#10b981'}`,
                    background: hiddenCols.has(c) ? '#f9fafb' : '#f0fdf4',
                    color: hiddenCols.has(c) ? '#6b7280' : '#065f46',
                    cursor: 'pointer',
                  }}
                  title={hiddenCols.has(c) ? 'Afficher' : 'Masquer'}
                >
                  {hiddenCols.has(c) ? '🙈 ' : '👁️ '} {c}
                </button>
              ))}
              {hiddenCols.size > 0 && (
                <button onClick={clearHiddenCols} style={styles.btnGhost}>Réinitialiser colonnes</button>
              )}
            </div>
          </div>

          {/* Validation */}
          {(() => (
            <div style={{ marginBottom: 16 }}>
              <span style={{
                ...styles.badge,
                ...styles.badgeSuccess
              }}>
                Analyse effectuée ✓
              </span>
            </div>
          ))()}

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>
                    Sél.
                  </th>
                  {(limitPreview ? colsFiltered.slice(0, 8) : colsFiltered).map(col => (
                    <th key={col} style={styles.th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(limitPreview ? data.slice(0, 20) : data).map((row, idx) => (
                  <tr key={idx} style={{ background: idx % 2 ? '#fff' : '#fcfcfc' }}>
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={excludedRows.has(idx)}
                        onChange={() => toggleRowExcluded(idx)}
                      />
                    </td>
                    {(limitPreview ? colsFiltered.slice(0, 8) : colsFiltered).map(col => (
                      <td key={col} style={styles.td}>
                        <div style={styles.tdContent}>
                          {row[col] instanceof Date 
                            ? row[col].toLocaleDateString('fr-FR')
                            : Array.isArray(row[col])
                            ? JSON.stringify(row[col])
                            : String(row[col] ?? '')
                          }
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section Import */}
      {data?.length > 0 && (
        <section style={styles.card}>
          <h3 style={{ marginTop: 0 }}>4. Migration</h3>
          <div style={styles.row}>
            <button
              style={styles.btnGhost}
              onClick={prepareMigration}
              disabled={loading || preparing || !data?.length}
              title="Étape 1: Stocker le CSV et journaliser l'aperçu dans Realtime"
            >
              {preparing ? 'Préparation…' : '1) Préparer migration (Storage + Realtime)'}
            </button>
            <button
              style={styles.btn}
              onClick={importToFirestore}
              disabled={loading || preparing || !data?.length || !migrationKey}
              title={!migrationKey ? 'Préparez d\'abord la migration' : undefined}
            >
              2) Confirmer vers Firestore ({visibleRowCount})
            </button>
            <button
              style={styles.btnGhost}
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? 'Mode réel' : 'Mode aperçu'}
            </button>
          </div>

          {/* Infos migration */}
          {(migrationKey || storageInfo || preparing) && (
            <div style={{ marginTop: 8 }}>
              {migrationKey && (
                <span style={styles.badge}>Migration ID: <code>{migrationKey}</code></span>
              )}
              {storageInfo?.url && (
                <a href={storageInfo.url} target="_blank" rel="noreferrer noopener" style={{ ...styles.badge, textDecoration: 'none' }}>
                  CSV stocké: {storageInfo.name} ({Math.round((storageInfo.size || 0) / 1024)} Ko)
                </a>
              )}
              {preparedStats && (
                <span style={styles.badge}>Préparé: {preparedStats.prepared} / Total: {preparedStats.total} (Exclues: {preparedStats.excluded})</span>
              )}
              {preparing && (
                <span style={styles.badge}>Progression: {prepareProgress.batchesDone}/{prepareProgress.totalBatches} lot(s){prepareProgress.uploaded ? ' • CSV uploadé' : ''}</span>
              )}
            </div>
          )}

          {/* Zone de statut masquée à la demande */}
        </section>
      )}
    </div>
  );
}
