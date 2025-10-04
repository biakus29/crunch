#!/bin/bash

echo "🧹 Nettoyage des anciens composants de rapports..."

# Supprimer les anciens composants
rm -f src/components/admin/RoleBasedReports.jsx
rm -f src/components/admin/KitchenSupplyReport.jsx
rm -f src/components/admin/AccountantFinancialReport.jsx
rm -f src/components/admin/ManagerDashboardReport.jsx
rm -f src/components/admin/RoleBasedReportsDashboard.jsx

echo "✅ Anciens composants supprimés"

# Vérifier les imports dans restaurantadmin.jsx
echo "🔍 Vérification des imports..."

# Afficher les imports de rapports restants
grep -n "import.*Report" src/pages/restaurantadmin.jsx || echo "Aucun import de rapport trouvé"

echo "🎉 Nettoyage terminé !"


