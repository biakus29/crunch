import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, writeBatch, doc } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { calculateOrderTotals, formatPrice } from '../../utils/adminUtils';
import { useCsvData } from '../../utils/csvToolkit';

const getOrderDate = (order) => {
  const ts = order?.timestamp || order?.createdAt || order?.updatedAt;
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') return ts.toDate();
  try { return new Date(ts); } catch { return null; }
};

const sumQuantity = (items = []) =>
  items.reduce((acc, it) => acc + Number(it?.quantity || 0), 0);

const listItemsNames = (items = []) =>
  items.map(it => it?.dishName || it?.name || it?.title || '—').filter(Boolean).join(', ');

const uniqueMenus = (items = []) => {
  const names = new Set();
  for (const it of items) {
    const name = it?.menuName || it?.categoryName || it?.menu || it?.category;
    if (name) names.add(name);
  }
  return Array.from(names).join(', ');
};

const extractComplements = (order, extraLists = []) => {
  const res = [];
  if (!order?.items) return '';
  for (const it of order.items) {
    if (!it?.selectedExtras) continue;
    for (const [extraListId, indexes] of Object.entries(it.selectedExtras)) {
      const list = extraLists.find(el => el.id === extraListId)?.extraListElements || [];
      for (const idx of indexes || []) {
        const el = list[idx];
        res.push(el?.name || el?.label || `${extraListId}#${idx}`);
      }
    }
  }
  return Array.from(new Set(res)).join(', ');
};

const paymentBreakdown = (order, total) => {
  const p = order?.payment || order?.payments || {};
  const fromBreakdown = {
    cash: Number(p.cash || p.CASH || 0),
    om: Number(p.om || p.orange || p.OM || 0),
    momo: Number(p.momo || p.MoMo || p.MOMO || 0),
  };
  const hasAny = Object.values(fromBreakdown).some(v => Number(v) > 0);
  if (hasAny) return fromBreakdown;

  const method = (order?.paymentMethod || order?.paymentType || '').toString().toLowerCase();
  if (method.includes('cash') || method.includes('esp')) return { cash: total, om: 0, momo: 0 };
  if (method.includes('orange') || method === 'om' || method.includes('omoney')) return { cash: 0, om: total, momo: 0 };
  if (method.includes('momo') || method.includes('mobile money')) return { cash: 0, om: 0, momo: total };
  return { cash: 0, om: 0, momo: 0 };
};

const getDeliverer = (order) =>
  order?.delivererName || order?.deliverer || order?.deliveryPerson || '';

const getContact = (order) => {
  const c = order?.phone || order?.telephone || order?.customerPhone || order?.contact || '';
  if (c && typeof c === 'object') {
    return c.phone || c.number || c.msisdn || c.value || '';
  }
  return c;
};

const getLieu = (order) => {
  const a = order?.address || order?.deliveryAddress || {};
  return a?.completeAddress || a?.addressLine || a?.quartier || a?.district || a?.city || '';
};

// Schéma pour le mapping CSV
const ORDERS_SCHEMA = {
  date: { type: 'date', required: false, description: 'Date de la commande' },
  service: { type: 'string', required: false, description: 'Service/Menu' },
  commande: { type: 'string', required: false, description: 'Nom des plats' },
  quantite: { type: 'number', required: false, description: 'Quantité totale' },
  complements: { type: 'string', required: false, description: 'Compléments sélectionnés' },
  cash: { type: 'number', required: false, description: 'Montant en espèces' },
  om: { type: 'number', required: false, description: 'Montant Orange Money' },
  momo: { type: 'number', required: false, description: 'Montant Mobile Money' },
  nbrBox: { type: 'number', required: false, description: 'Nombre de box' },
  fraisLivraison: { type: 'number', required: false, description: 'Frais de livraison' },
  solde: { type: 'number', required: false, description: 'Montant total' },
  contact: { type: 'string', required: false, description: 'Téléphone client' },
  nombreCmd: { type: 'number', required: false, description: 'Nombre de plats commandés' },
  livreur: { type: 'string', required: false, description: 'Nom du livreur' },
  lieu: { type: 'string', required: false, description: 'Lieu de livraison' },
};

// Auto-mapping intelligent des colonnes CSV
const autoMapColumns = (headers) => {
  const mapping = {};
  
  headers.forEach(header => {
    const normalized = header.toLowerCase().trim();
    
    if (['date', 'time', 'timestamp', 'heure', 'created'].some(p => normalized.includes(p))) {
      mapping[header] = 'date';
    }
    else if (['service', 'menu', 'type', 'categorie', 'category'].some(p => normalized.includes(p))) {
      mapping[header] = 'service';
    }
    else if (['commande', 'plat', 'dish', 'item', 'produit', 'product'].some(p => normalized.includes(p))) {
      mapping[header] = 'commande';
    }
    else if (['quantite', 'quantity', 'qty', 'qte', 'nombre'].some(p => normalized.includes(p))) {
      mapping[header] = 'quantite';
    }
    else if (['complement', 'extra', 'option', 'supplement'].some(p => normalized.includes(p))) {
      mapping[header] = 'complements';
    }
    else if (['cash', 'espece', 'espèce', 'liquide'].some(p => normalized.includes(p))) {
      mapping[header] = 'cash';
    }
    else if (['om', 'orange', 'orange money', 'omoney'].some(p => normalized.includes(p))) {
      mapping[header] = 'om';
    }
    else if (['momo', 'mobile money', 'mtn'].some(p => normalized.includes(p))) {
      mapping[header] = 'momo';
    }
    else if (['box', 'nombre de box', 'nbr box'].some(p => normalized.includes(p))) {
      mapping[header] = 'nbrBox';
    }
    else if (['frais', 'livraison', 'delivery', 'fee'].some(p => normalized.includes(p))) {
      mapping[header] = 'fraisLivraison';
    }
    else if (['solde', 'total', 'montant', 'prix', 'price', 'amount'].some(p => normalized.includes(p))) {
      mapping[header] = 'solde';
    }
    else if (['contact', 'tel', 'phone', 'telephone', 'mobile'].some(p => normalized.includes(p))) {
      mapping[header] = 'contact';
    }
    else if (['nombre cmd', 'nbr cmd', 'items count'].some(p => normalized.includes(p))) {
      mapping[header] = 'nombreCmd';
    }
    else if (['livreur', 'deliverer', 'delivery person'].some(p => normalized.includes(p))) {
      mapping[header] = 'livreur';
    }
    else if (['lieu', 'adresse', 'address', 'location', 'quartier'].some(p => normalized.includes(p))) {
      mapping[header] = 'lieu';
    }
  });
  
  return mapping;
};

export default function OrdersHistoryTable({ extraLists = [], itemsCatalog = [], menusCatalog = [] }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // États pour l'import CSV
  const [showImport, setShowImport] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvUrl, setCsvUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [columnMapping, setColumnMapping] = useState({});
  const [importStatus, setImportStatus] = useState(null);
  const [importing, setImporting] = useState(false);
  const [excludedRows, setExcludedRows] = useState(new Set());
  const [freeMode, setFreeMode] = useState(false);

  // Ensure csvData and csvCols are always arrays to avoid runtime errors when
  // calling .length/.slice on them (sometimes the hook may return undefined)
  const { data: csvData = [], cols: csvCols = [], loading: csvLoading, error: csvError } = useCsvData(csvFile, csvUrl);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(all);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // Auto-mapping quand les colonnes CSV sont chargées
  useEffect(() => {
    if (csvCols.length > 0) {
      const autoMapped = autoMapColumns(csvCols);
      setColumnMapping(autoMapped);
    }
  }, [csvCols]);

  const rows = useMemo(() => {
    const menuIdToName = new Map(
      (menusCatalog || []).map(m => [m?.id, m?.name || m?.title || m?.label || ''])
    );
    const itemIdToMenuName = new Map(
      (itemsCatalog || []).map(it => {
        const menuName = it?.menuName || menuIdToName.get(it?.menuId) || '';
        return [it?.id, menuName];
      })
    );

    return orders.map((order) => {
      const date = getOrderDate(order);
      const items = Array.isArray(order.items) ? order.items : [];
      const qty = sumQuantity(items);
      const nbrBox = qty;
      const complements = extractComplements(order, extraLists);

      let totals = { deliveryFee: Number(order.deliveryFee) || 0, totalWithDelivery: Number(order.total) || 0 };
      try {
        if (items.length) {
          totals = calculateOrderTotals(order, extraLists, itemsCatalog);
        }
      } catch {}
      const totalDisplay = Number(totals?.finalTotal ?? totals?.totalWithDelivery ?? order.total ?? 0);
      const deliveryFee = Number(totals?.deliveryFee ?? order.deliveryFee ?? 0);

      const pay = paymentBreakdown(order, totalDisplay);

      const resolvedMenuNames = Array.from(new Set(
        items.map(it =>
          itemIdToMenuName.get(it?.dishId) || it?.menuName || it?.categoryName || it?.menu || it?.category || ''
        ).filter(Boolean)
      ));
      const service = String((resolvedMenuNames.length ? resolvedMenuNames.join(', ') : uniqueMenus(items)) || order?.type || '');
      const commandeNames = String(listItemsNames(items) || order?.id || '—');
      const contact = String(getContact(order) || '');
      const deliverer = String(getDeliverer(order) || '');
      const lieu = String(getLieu(order) || '');
      const nombreCmd = items.length;

      return {
        id: order.id,
        dateObj: date,
        date: date ? date.toLocaleString('fr-FR') : '',
        service,
        commande: commandeNames,
        quantite: qty,
        complements,
        cash: pay.cash,
        om: pay.om,
        momo: pay.momo,
        nbrBox,
        fraisLivraison: deliveryFee,
        solde: totalDisplay,
        contact,
        nombreCmd,
        livreur: deliverer,
        lieu,
      };
    });
  }, [orders, extraLists, itemsCatalog, menusCatalog]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    if (to) { to.setHours(23,59,59,999); }
    return rows.filter(r => {
      if (from && r.dateObj && r.dateObj < from) return false;
      if (to && r.dateObj && r.dateObj > to) return false;
      if (!s) return true;
      const hay = `${r.service} ${r.commande} ${r.contact} ${r.lieu} ${r.livreur}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, search, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, r) => {
      acc.count += 1;
      acc.qty += Number(r.quantite || 0);
      acc.delivery += Number(r.fraisLivraison || 0);
      acc.total += Number(r.solde || 0);
      acc.cash += Number(r.cash || 0);
      acc.om += Number(r.om || 0);
      acc.momo += Number(r.momo || 0);
      return acc;
    }, { count: 0, qty: 0, delivery: 0, total: 0, cash: 0, om: 0, momo: 0 });
  }, [filtered]);

  const exportCSV = () => {
    const headers = [
      'date','service(menu)','comande','quantité','compléments','cash','om','momo','nbr de box','frais de livraison','solde','contact','nombre de cmd','livreurs','lieu'
    ];
    const lines = [headers.join(',')];
    filtered.forEach(r => {
      const row = [r.date,r.service,r.commande,r.quantite,r.complements,r.cash,r.om,r.momo,r.nbrBox,r.fraisLivraison,r.solde,r.contact,r.nombreCmd,r.livreur,r.lieu]
        .map(v => {
          const s = String(v ?? '');
          return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g,'""') + '"' : s;
        }).join(',');
      lines.push(row);
    });
    const blob = new Blob(["\ufeff" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historique_commandes_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setCsvUrl("");
      setUrlInput("");
      setExcludedRows(new Set());
      setColumnMapping({});
    }
  };

  const handleUrlLoad = () => {
    if (urlInput.trim()) {
      setCsvUrl(urlInput.trim());
      setCsvFile(null);
      setExcludedRows(new Set());
      setColumnMapping({});
    }
  };

  const updateColumnMapping = (csvCol, targetField) => {
    setColumnMapping(prev => ({
      ...prev,
      [csvCol]: targetField
    }));
  };

  const toggleRowExcluded = (idx) => {
    setExcludedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const transformCsvRowToOrder = (csvRow, index) => {
    if (freeMode) {
      // Mode libre : garder toutes les colonnes CSV telles quelles
      return {
        ...csvRow,
        importedAt: new Date(),
        importedFromCsv: true,
        csvRowIndex: index,
        timestamp: new Date(),
        status: 'imported',
      };
    }

    // Mode mappé : transformer selon le schéma
    const order = {
      importedAt: new Date(),
      importedFromCsv: true,
      csvRowIndex: index,
    };

    // Parcourir le mapping et transformer les données
    Object.entries(columnMapping).forEach(([csvCol, targetField]) => {
      if (!targetField) return; // Ignorer si pas de champ cible
      
      const value = csvRow[csvCol];
      if (value === undefined || value === null || value === '') return; // Ignorer les valeurs vides
      
      const schema = ORDERS_SCHEMA[targetField];

      if (schema?.type === 'number') {
        // Nettoyer et convertir en nombre
        const cleanValue = String(value).replace(/[^\d.-]/g, '');
        order[targetField] = Number(cleanValue) || 0;
      } else if (schema?.type === 'date') {
        try {
          // Essayer de parser la date
          const parsedDate = new Date(value);
          if (!isNaN(parsedDate.getTime())) {
            order[targetField] = parsedDate;
          } else {
            order[targetField] = value; // Garder comme string si échec
          }
        } catch {
          order[targetField] = value;
        }
      } else {
        // Type string ou autre
        order[targetField] = String(value);
      }
    });

    // Construction d'un objet de paiement structuré
    const hasCash = order.cash !== undefined && order.cash > 0;
    const hasOm = order.om !== undefined && order.om > 0;
    const hasMomo = order.momo !== undefined && order.momo > 0;

    if (hasCash || hasOm || hasMomo) {
      order.payment = {
        cash: Number(order.cash) || 0,
        om: Number(order.om) || 0,
        momo: Number(order.momo) || 0,
      };
      
      // Déterminer la méthode de paiement principale
      if (hasCash && !hasOm && !hasMomo) order.paymentMethod = 'cash';
      else if (hasOm && !hasCash && !hasMomo) order.paymentMethod = 'om';
      else if (hasMomo && !hasCash && !hasOm) order.paymentMethod = 'momo';
      else order.paymentMethod = 'mixed';
    }

    // Définir le total
    if (order.solde !== undefined) {
      order.total = Number(order.solde);
    } else if (order.payment) {
      // Calculer le total à partir des paiements si solde manquant
      order.total = (order.payment.cash || 0) + (order.payment.om || 0) + (order.payment.momo || 0);
    }

    // Définir les frais de livraison
    if (order.fraisLivraison !== undefined) {
      order.deliveryFee = Number(order.fraisLivraison);
    }

    // Champs standards pour Firebase
    order.timestamp = order.date || new Date();
    order.status = order.statut || 'imported';
    
    // Structurer les informations de contact
    if (order.contact) {
      order.phone = order.contact;
      order.customerPhone = order.contact;
    }
    
    // Structurer l'adresse
    if (order.lieu) {
      order.address = {
        completeAddress: order.lieu,
        quartier: order.lieu,
      };
      order.deliveryAddress = order.address;
    }
    
    // Structurer le livreur
    if (order.livreur) {
      order.delivererName = order.livreur;
      order.deliverer = order.livreur;
    }
    
    // Créer un tableau d'items minimal si on a des infos
    if (order.commande || order.service) {
      order.items = [{
        dishName: order.commande || 'Commande importée',
        menuName: order.service || '',
        quantity: order.quantite || 1,
        price: order.solde ? Number(order.solde) / (order.quantite || 1) : 0,
      }];
    }

    return order;
  };

  const importFromCSV = async () => {
    if (!csvData || csvData.length === 0) {
      setImportStatus({ type: 'error', message: 'Aucune donnée CSV à importer' });
      return;
    }

    setImporting(true);
    setImportStatus({ type: 'info', message: 'Import en cours...' });

    try {
      // Upload du CSV vers Storage
      let csvStorageUrl = null;
      if (csvFile) {
        const timestamp = Date.now();
        const fileName = `imports/orders_${timestamp}_${csvFile.name}`;
        const fileRef = storageRef(storage, fileName);
        await uploadBytes(fileRef, csvFile);
        csvStorageUrl = await getDownloadURL(fileRef);
      }

      // Filtrer les lignes exclues
      const rowsToImport = csvData.filter((_, idx) => !excludedRows.has(idx));

      // Transformer et importer par lots
      const batch = writeBatch(db);
      let batchCount = 0;
      const BATCH_SIZE = 500;

      for (let i = 0; i < rowsToImport.length; i++) {
        const csvRow = rowsToImport[i];
        const orderData = transformCsvRowToOrder(csvRow, i);
        
        if (csvStorageUrl) {
          orderData.csvSourceUrl = csvStorageUrl;
        }

        const docRef = doc(collection(db, 'orders'));
        batch.set(docRef, orderData);
        batchCount++;

        // Commit par lots de 500
        if (batchCount === BATCH_SIZE) {
          await batch.commit();
          batchCount = 0;
          setImportStatus({ 
            type: 'info', 
            message: `Import en cours... ${i + 1}/${rowsToImport.length} commandes` 
          });
        }
      }

      // Commit du dernier lot
      if (batchCount > 0) {
        await batch.commit();
      }

      setImportStatus({ 
        type: 'success', 
        message: `✓ ${rowsToImport.length} commandes importées avec succès` 
      });
      
      // Réinitialiser après 3 secondes
      setTimeout(() => {
        setShowImport(false);
        setCsvFile(null);
        setCsvUrl("");
        setColumnMapping({});
        setExcludedRows(new Set());
        setImportStatus(null);
      }, 3000);

    } catch (error) {
      console.error('Erreur import CSV:', error);
      setImportStatus({ 
        type: 'error', 
        message: `Erreur: ${error.message}` 
      });
    } finally {
      setImporting(false);
    }
  };

  if (loading) return (
    <div className="p-6">
      <div className="h-5 w-40 bg-gray-200 rounded mb-3 animate-pulse" />
      <div className="h-9 w-full bg-gray-100 rounded animate-pulse" />
      <div className="mt-4 space-y-2">
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-3 h-full min-h-[70vh] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="font-semibold text-lg">Historique des commandes</div>
          <div className="text-xs text-gray-500">{totals.count} commandes • Qté {totals.qty} • Total {formatPrice(totals.total)} • Livraison {formatPrice(totals.delivery)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (client, lieu, menu, plat, livreur)"
            className="h-9 px-3 border rounded md:w-72"
            type="text"
          />
          <input
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 px-3 border rounded"
            type="date"
          />
          <input
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 px-3 border rounded"
            type="date"
          />
          <button onClick={exportCSV} className="h-9 px-3 bg-white border rounded hover:bg-gray-50">Exporter CSV</button>
          <button 
            onClick={() => setShowImport(!showImport)} 
            className="h-9 px-3 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            {showImport ? 'Fermer' : 'Importer CSV'}
          </button>
        </div>
      </div>

      {/* Section Import CSV */}
      {showImport && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
          <h3 className="font-semibold text-base">Importer des commandes depuis un CSV</h3>
          
          {/* Upload fichier ou URL */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex-1 h-9 px-3 border rounded bg-white"
              />
              <span className="text-gray-500 self-center">ou</span>
              <input
                type="text"
                placeholder="URL du CSV"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 h-9 px-3 border rounded"
              />
              <button 
                onClick={handleUrlLoad}
                disabled={!urlInput.trim()}
                className="h-9 px-3 bg-white border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Charger URL
              </button>
            </div>
            {csvError && <div className="text-sm text-red-600">Erreur: {csvError}</div>}
            {csvLoading && <div className="text-sm text-gray-600">Chargement du CSV...</div>}
          </div>

          {/* Mapping des colonnes */}
          {csvData && csvCols.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium">Mapping des colonnes</h4>
                  <label className="flex items-center gap-2 text-sm">
                    <input 
                      type="checkbox" 
                      checked={freeMode} 
                      onChange={(e) => setFreeMode(e.target.checked)} 
                    />
                    Mode libre (importer toutes les colonnes CSV telles quelles)
                  </label>
                </div>
                {!freeMode && (
                  <button
                    onClick={() => {
                      const autoMapped = autoMapColumns(csvCols);
                      setColumnMapping(autoMapped);
                    }}
                    className="h-8 px-3 text-sm bg-white border rounded hover:bg-gray-50"
                  >
                    🔄 Réinitialiser le mapping
                  </button>
                )}
              </div>

              {!freeMode && (
                <>
                  <div className="text-sm text-gray-600 mb-2">
                    {Object.values(columnMapping).filter(Boolean).length} / {csvCols.length} colonnes mappées
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-auto">
                    {csvCols.map((csvCol) => {
                      const mappedField = columnMapping[csvCol];
                      const autoMapping = autoMapColumns(csvCols);
                      const isAutoMapped = autoMapping[csvCol] === mappedField && mappedField;
                      return (
                        <div key={csvCol} className={`border rounded p-3 ${mappedField ? 'bg-emerald-50 border-emerald-200' : 'bg-white'}`}>
                          <div className="text-sm font-medium mb-1 flex items-center justify-between">
                            <span className="truncate">{csvCol}</span>
                            {isAutoMapped && <span className="ml-2 text-xs bg-emerald-600 text-white px-2 py-0.5 rounded">✓ auto</span>}
                          </div>
                          <select
                            value={mappedField || ''}
                            onChange={(e) => updateColumnMapping(csvCol, e.target.value)}
                            className={`w-full h-8 px-2 border rounded text-sm ${mappedField ? 'border-emerald-500' : 'border-gray-300'}`}
                          >
                            <option value="">-- Ignorer --</option>
                            {Object.keys(ORDERS_SCHEMA).map(field => (
                              <option key={field} value={field}>
                                {field}
                              </option>
                            ))}
                          </select>
                          {mappedField && (
                            <div className="text-xs text-gray-600 mt-1">
                              → {ORDERS_SCHEMA[mappedField]?.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Aperçu des données */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Aperçu des données CSV ({csvData.length} lignes)</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      Lignes à importer: <strong>{csvData.length - excludedRows.size}</strong>
                    </span>
                    <span className="text-sm text-gray-600">
                      Exclues: {excludedRows.size}
                    </span>
                  </div>
                </div>
                <div className="border rounded overflow-auto max-h-64">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-2 text-left whitespace-nowrap">Sél.</th>
                        {csvCols.slice(0, 8).map(col => {
                          const mapped = columnMapping[col];
                          return (
                            <th key={col} className="p-2 text-left">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium">{col}</span>
                                {!freeMode && mapped && (
                                  <span className="text-xs text-emerald-600 font-normal">→ {mapped}</span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                        {csvCols.length > 8 && (
                          <th className="p-2 text-left text-gray-400">
                            ... +{csvCols.length - 8} colonnes
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className={excludedRows.has(idx) ? 'bg-red-50 opacity-60' : 'odd:bg-white even:bg-gray-50'}>
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={excludedRows.has(idx)}
                              onChange={() => toggleRowExcluded(idx)}
                              title={excludedRows.has(idx) ? "Cliquer pour inclure" : "Cliquer pour exclure"}
                            />
                          </td>
                          {csvCols.slice(0, 8).map(col => (
                            <td key={col} className="p-2 max-w-[200px] truncate" title={String(row[col] || '')}>
                              {String(row[col] || '')}
                            </td>
                          ))}
                          {csvCols.length > 8 && <td className="p-2 text-gray-400">...</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData.length > 10 && (
                  <div className="text-xs text-gray-500 text-center">
                    Affichage des 10 premières lignes sur {csvData.length}
                  </div>
                )}
              </div>

              {/* Bouton d'import */}
              <div className="flex items-center gap-3">
                <button
                  onClick={importFromCSV}
                  disabled={importing || csvData.length === 0}
                  className="h-9 px-4 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {importing ? 'Import en cours...' : `Importer ${csvData.length - excludedRows.size} commandes`}
                </button>
                {importStatus && (
                  <div className={`text-sm ${
                    importStatus.type === 'success' ? 'text-emerald-600' :
                    importStatus.type === 'error' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {importStatus.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border rounded-lg overflow-auto flex-1 min-h-0">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-50 text-left sticky top-0 z-10 shadow">
            <tr>
              <th className="p-2 whitespace-nowrap">date</th>
              <th className="p-2 whitespace-nowrap">service(menu)</th>
              <th className="p-2">comande</th>
              <th className="p-2 text-right whitespace-nowrap">quantité</th>
              <th className="p-2">compléments</th>
              <th className="p-2 text-right whitespace-nowrap">solde (cash)</th>
              <th className="p-2 text-right whitespace-nowrap">solde (om)</th>
              <th className="p-2 text-right whitespace-nowrap">solde (momo)</th>
              <th className="p-2 text-right whitespace-nowrap">nbr de box</th>
              <th className="p-2 text-right whitespace-nowrap">frais de livraison</th>
              <th className="p-2 text-right whitespace-nowrap">solde</th>
              <th className="p-2">contact</th>
              <th className="p-2 text-right whitespace-nowrap">nombre de cmd</th>
              <th className="p-2">livreurs</th>
              <th className="p-2">lieu</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="odd:bg-white even:bg-gray-50 border-t hover:bg-emerald-50/50">
                <td className="p-2 whitespace-nowrap">{r.date}</td>
                <td className="p-2">{r.service}</td>
                <td className="p-2">{r.commande}</td>
                <td className="p-2 text-right tabular-nums">{r.quantite}</td>
                <td className="p-2 max-w-[280px] truncate" title={r.complements}>{r.complements}</td>
                <td className="p-2 text-right tabular-nums">{formatPrice(r.cash)}</td>
                <td className="p-2 text-right tabular-nums">{formatPrice(r.om)}</td>
                <td className="p-2 text-right tabular-nums">{formatPrice(r.momo)}</td>
                <td className="p-2 text-right tabular-nums">{r.nbrBox}</td>
                <td className="p-2 text-right tabular-nums">{formatPrice(r.fraisLivraison)}</td>
                <td className="p-2 text-right tabular-nums">{formatPrice(r.solde)}</td>
                <td className="p-2">{r.contact}</td>
                <td className="p-2 text-right tabular-nums">{r.nombreCmd}</td>
                <td className="p-2">{r.livreur}</td>
                <td className="p-2">{r.lieu}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-medium border-t">
              <td className="p-2" colSpan={3}>Totaux</td>
              <td className="p-2 text-right tabular-nums">{totals.qty}</td>
              <td className="p-2" />
              <td className="p-2 text-right tabular-nums">{formatPrice(totals.cash)}</td>
              <td className="p-2 text-right tabular-nums">{formatPrice(totals.om)}</td>
              <td className="p-2 text-right tabular-nums">{formatPrice(totals.momo)}</td>
              <td className="p-2 text-right tabular-nums">{totals.qty}</td>
              <td className="p-2 text-right tabular-nums">{formatPrice(totals.delivery)}</td>
              <td className="p-2 text-right tabular-nums">{formatPrice(totals.total)}</td>
              <td className="p-2" />
              <td className="p-2 text-right tabular-nums"></td>
              <td className="p-2" />
              <td className="p-2" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="text-xs text-gray-500 mt-2">
        Astuce: si `paymentMethod` est défini sur une commande, le total est imputé sur cette méthode.
      </div>
    </div>
  );
}