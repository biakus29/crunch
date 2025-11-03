import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatMonthRange = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startStr: toStr(start), endStr: toStr(end) };
};

const PurchaseSummary = ({ currentRestaurantId }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'amount', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedDate] = useState(new Date());
  const { startStr: defaultStart, endStr: defaultEnd } = useMemo(() => formatMonthRange(selectedDate), [selectedDate]);
  const [rangeStart, setRangeStart] = useState(defaultStart);
  const [rangeEnd, setRangeEnd] = useState(defaultEnd);

  useEffect(() => {
    const fetchPurchaseLists = async () => {
      setLoading(true);
      setError(null);
      try {
        const start = rangeStart && rangeStart.trim() ? rangeStart : defaultStart;
        const end = rangeEnd && rangeEnd.trim() ? rangeEnd : defaultEnd;

        const base = [collection(db, 'purchaseLists')];
        if (currentRestaurantId) base.push(where('restaurantId', '==', currentRestaurantId));
        base.push(where('date', '>=', start));
        base.push(where('date', '<=', end));
        base.push(orderBy('date', 'asc'));

        const q = query.apply(null, base);
        const snap = await getDocs(q);

        const totals = new Map();

        snap.docs.forEach((d) => {
          const pl = d.data();
          const items = Array.isArray(pl.items) ? pl.items : [];
          items.forEach((it) => {
            const key = it.name || it.ingredientId || 'Inconnu';
            const prev = totals.get(key) || { ingredient: key, quantity: 0, amount: 0, unit: it.unit || '' };
            prev.quantity += Number(it.quantity || 0);
            prev.amount += Number(it.total || (it.unitPrice || 0) * (it.quantity || 0));
            if (!prev.unit && it.unit) prev.unit = it.unit;
            totals.set(key, prev);
          });
        });

        const rowsArr = Array.from(totals.values());
        setRows(rowsArr);
      } catch (e) {
        console.error('Erreur chargement Résumé Achats:', e);
        setError('Impossible de charger le résumé des achats');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchaseLists();
  }, [currentRestaurantId, rangeStart, rangeEnd, defaultStart, defaultEnd]);

  // Filtrage et tri
  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows.filter(r => 
      r.ingredient.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'ingredient') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [rows, searchTerm, sortConfig]);

  const totalAmount = filteredAndSortedRows.reduce((s, r) => s + (r.amount || 0), 0);
  const totalQuantity = filteredAndSortedRows.reduce((s, r) => s + (r.quantity || 0), 0);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const applyPreset = (preset) => {
    const now = new Date();
    let s, e;
    const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    if (preset === 'today') {
      s = toStr(now);
      e = toStr(now);
    } else if (preset === 'thisMonth') {
      s = defaultStart; 
      e = defaultEnd;
    } else if (preset === 'lastMonth') {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const { startStr, endStr } = formatMonthRange(last);
      s = startStr; 
      e = endStr;
    } else if (preset === 'last7') {
      const d7 = new Date(now); 
      d7.setDate(now.getDate() - 6);
      s = toStr(d7); 
      e = toStr(now);
    } else if (preset === 'last30') {
      const d30 = new Date(now); 
      d30.setDate(now.getDate() - 29);
      s = toStr(d30); 
      e = toStr(now);
    } else {
      s = defaultStart; 
      e = defaultEnd;
    }
    setRangeStart(s); 
    setRangeEnd(e);
  };

  const exportToCSV = () => {
    const headers = ['Ingrédient', 'Quantité', 'Unité', 'Montant (FCFA)'];
    const csvRows = [
      headers.join(','),
      ...filteredAndSortedRows.map(r => 
        [r.ingredient, r.quantity, r.unit || '', r.amount].join(',')
      ),
      ['TOTAL', totalQuantity, '', totalAmount].join(',')
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `achats_${rangeStart}_${rangeEnd}.csv`;
    link.click();
  };

  const exportToPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Fonction pour formater les nombres avec espaces comme séparateur de milliers
      const formatNumber = (num) => {
        return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      };
      
      // En-tête du document
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('RAPPORT D\'ACHATS', pageWidth / 2, 20, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Période: ${rangeStart} au ${rangeEnd}`, pageWidth / 2, 30, { align: 'center' });
      
      // Informations générales
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      const today = new Date().toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Généré le: ${today}`, 14, 48);
      
      // Section Statistiques
      let yPos = 58;
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(14, yPos, pageWidth - 28, 30, 3, 3, 'F');
      
      doc.setTextColor(52, 73, 94);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('STATISTIQUES GÉNÉRALES', 20, yPos + 8);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const col1X = 20;
      const col2X = pageWidth / 2 + 10;
      
      doc.setTextColor(100, 100, 100);
      doc.text('Nombre d\'ingrédients:', col1X, yPos + 16);
      doc.text('Quantité totale:', col1X, yPos + 22);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(41, 128, 185);
      doc.text(filteredAndSortedRows.length.toString(), col1X + 50, yPos + 16);
      doc.text(formatNumber(totalQuantity), col1X + 50, yPos + 22);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Montant total:', col2X, yPos + 16);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(46, 204, 113);
      doc.setFontSize(11);
      doc.text(`${formatNumber(totalAmount)} FCFA`, col2X + 32, yPos + 16);
      
      // Tableau des achats
      yPos += 40;
      doc.setTextColor(52, 73, 94);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DÉTAIL PAR INGRÉDIENT', 14, yPos);
      
      yPos += 5;
      
      const tableData = filteredAndSortedRows.map((r, idx) => {
        const percentage = totalAmount > 0 ? ((r.amount / totalAmount) * 100).toFixed(1) : '0.0';
        return [
          (idx + 1).toString(),
          r.ingredient,
          `${formatNumber(r.quantity)} ${r.unit || ''}`.trim(),
          formatNumber(r.amount),
          `${percentage} %`
        ];
      });
      
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Ingrédient', 'Quantité', 'Montant (FCFA)', 'Part']],
        body: tableData,
        foot: [['', 'TOTAL', formatNumber(totalQuantity), formatNumber(totalAmount), '100.0 %']],
        theme: 'grid',
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [52, 73, 94]
        },
        footStyles: {
          fillColor: [245, 247, 250],
          textColor: [52, 73, 94],
          fontSize: 10,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 65 },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 20, halign: 'center' }
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        },
        margin: { left: 14, right: 14 }
      });
      
      // Top 5 des achats
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : (yPos + 10);
      if (finalY < pageHeight - 60 && filteredAndSortedRows.length > 0) {
        yPos = finalY + 15;
        
        doc.setFillColor(255, 243, 224);
        doc.roundedRect(14, yPos, pageWidth - 28, 8, 2, 2, 'F');
        
        doc.setTextColor(230, 126, 34);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('TOP 5 DES ACHATS', 20, yPos + 5.5);
        
        yPos += 12;
        doc.setTextColor(52, 73, 94);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const top5 = filteredAndSortedRows.slice(0, 5);
        top5.forEach((item, idx) => {
          const percentage = totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) : '0.0';
          doc.text(`${idx + 1}. ${item.ingredient}`, 20, yPos);
          doc.setFont('helvetica', 'bold');
          doc.text(`${formatNumber(item.amount)} FCFA (${percentage} %)`, pageWidth - 20, yPos, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          yPos += 6;
        });
      }
      
      // Pied de page
      const footerY = pageHeight - 15;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, footerY, pageWidth - 14, footerY);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text('Document généré automatiquement - Système de gestion des achats', pageWidth / 2, footerY + 5, { align: 'center' });
      doc.text(`Page 1`, pageWidth - 14, footerY + 5, { align: 'right' });
      
      // Sauvegarde
      doc.save(`rapport_achats_${rangeStart}_${rangeEnd}.pdf`);
      
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de la génération du PDF. Vérifiez que les dépendances sont installées.');
    }
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-400 ml-1">⇅</span>;
    }
    return (
      <span className="ml-1">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Résumé des Achats</h2>
              <p className="text-sm text-gray-500 mt-1">
                Du {rangeStart || defaultStart} au {rangeEnd || defaultEnd}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                disabled={rows.length === 0}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <span>📊</span>
                <span>CSV</span>
              </button>
              <button
                onClick={exportToPDF}
                disabled={rows.length === 0}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <span>📄</span>
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* Filtres de dates */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Date début</label>
                <input 
                  type="date" 
                  value={rangeStart} 
                  onChange={(e) => setRangeStart(e.target.value)} 
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-gray-600 mb-1">Date fin</label>
                <input 
                  type="date" 
                  value={rangeEnd} 
                  onChange={(e) => setRangeEnd(e.target.value)} 
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-end">
              <button onClick={() => applyPreset('today')} className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                Aujourd'hui
              </button>
              <button onClick={() => applyPreset('last7')} className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                7 jours
              </button>
              <button onClick={() => applyPreset('last30')} className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                30 jours
              </button>
              <button onClick={() => applyPreset('thisMonth')} className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                Mois en cours
              </button>
              <button onClick={() => applyPreset('lastMonth')} className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                Mois précédent
              </button>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Rechercher un ingrédient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 pl-10 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <p className="text-xs font-medium text-blue-600">Nombre d'ingrédients</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{filteredAndSortedRows.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
              <p className="text-xs font-medium text-green-600">Quantité totale</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{totalQuantity.toLocaleString()}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
              <p className="text-xs font-medium text-purple-600">Montant total</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">{totalAmount.toLocaleString()} FCFA</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-sm border">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-500">Chargement des données...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-xl">⚠️</span>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      ) : filteredAndSortedRows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun achat trouvé</h3>
          <p className="text-gray-500 text-sm">
            {searchTerm 
              ? `Aucun résultat pour "${searchTerm}"`
              : "Aucun achat n'a été enregistré pour cette période"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    onClick={() => handleSort('ingredient')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center">
                      Ingrédient
                      <SortIcon columnKey="ingredient" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('quantity')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center">
                      Quantité
                      <SortIcon columnKey="quantity" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('amount')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center">
                      Montant (FCFA)
                      <SortIcon columnKey="amount" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Part (%)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedRows.map((r, idx) => {
                  const percentage = totalAmount > 0 ? ((r.amount / totalAmount) * 100).toFixed(1) : 0;
                  return (
                    <tr key={r.ingredient} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm mr-3">
                            {idx + 1}
                          </div>
                          <div className="text-sm font-medium text-gray-900">{r.ingredient}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <span className="font-semibold">{r.quantity.toLocaleString()}</span>
                          {r.unit && <span className="text-gray-500 ml-1">{r.unit}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {r.amount.toLocaleString()} FCFA
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600">{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">TOTAL</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                    {totalQuantity.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {totalAmount.toLocaleString()} FCFA
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-600">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseSummary;