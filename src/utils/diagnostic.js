/**
 * Script de diagnostic pour identifier les problèmes en ligne
 */

export const runDiagnostic = async () => {
  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    issues: [],
    warnings: [],
    recommendations: []
  };

  // 1. Vérifier Firebase
  try {
    const { db, auth } = await import('../firebase');
    if (!db || !auth) {
      results.issues.push({
        category: 'Firebase',
        message: 'Firebase non initialisé correctement',
        severity: 'high'
      });
    } else {
      results.recommendations.push({
        category: 'Firebase',
        message: 'Firebase initialisé correctement'
      });
    }
  } catch (error) {
    results.issues.push({
      category: 'Firebase',
      message: `Erreur Firebase: ${error.message}`,
      severity: 'critical'
    });
  }

  // 2. Vérifier les permissions
  try {
    const { useRoleAuth } = await import('../hooks/useRoleAuth');
    // Note: On ne peut pas utiliser le hook ici, mais on peut vérifier l'import
    results.recommendations.push({
      category: 'Permissions',
      message: 'Système de permissions disponible'
    });
  } catch (error) {
    results.issues.push({
      category: 'Permissions',
      message: `Erreur permissions: ${error.message}`,
      severity: 'medium'
    });
  }

  // 3. Vérifier les composants lazy
  const lazyComponents = [
    'Admin',
    'RestaurantAdmin',
    'AllPaymentsPage',
    'BudgetManager',
    'PaymentManager'
  ];

  for (const component of lazyComponents) {
    try {
      // Simuler un import pour vérifier la disponibilité
      const module = await import(`../pages/${component}`);
      if (!module.default) {
        results.warnings.push({
          category: 'Lazy Loading',
          message: `Composant ${component} n'a pas d'export par défaut`,
          severity: 'medium'
        });
      }
    } catch (error) {
      results.issues.push({
        category: 'Lazy Loading',
        message: `Composant ${component} non trouvé: ${error.message}`,
        severity: 'high'
      });
    }
  }

  // 4. Vérifier les variables d'environnement
  const requiredEnvVars = [
    'REACT_APP_PUBLIC_BASE_URL',
    'REACT_APP_API_URL'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      results.warnings.push({
        category: 'Configuration',
        message: `Variable d'environnement ${envVar} manquante`,
        severity: 'low'
      });
    }
  }

  // 5. Vérifier la connectivité réseau
  try {
    const response = await fetch('https://www.google.com', { mode: 'no-cors' });
    results.recommendations.push({
      category: 'Réseau',
      message: 'Connectivité réseau OK'
    });
  } catch (error) {
    results.issues.push({
      category: 'Réseau',
      message: 'Problème de connectivité réseau',
      severity: 'high'
    });
  }

  // 6. Générer des recommandations
  if (results.issues.length === 0) {
    results.recommendations.push({
      category: 'Général',
      message: 'Aucun problème critique détecté'
    });
  } else {
    results.recommendations.push({
      category: 'Général',
      message: `${results.issues.length} problème(s) détecté(s), voir les détails ci-dessus`
    });
  }

  return results;
};

// Fonction pour afficher le diagnostic dans la console
export const logDiagnostic = async () => {
  const results = await runDiagnostic();
  
  console.group('🔍 Diagnostic de l\'application');
  console.log('Timestamp:', results.timestamp);
  console.log('Environment:', results.environment);
  
  if (results.issues.length > 0) {
    console.group('❌ Problèmes détectés');
    results.issues.forEach(issue => {
      console.error(`[${issue.severity.toUpperCase()}] ${issue.category}: ${issue.message}`);
    });
    console.groupEnd();
  }
  
  if (results.warnings.length > 0) {
    console.group('⚠️ Avertissements');
    results.warnings.forEach(warning => {
      console.warn(`[${warning.severity.toUpperCase()}] ${warning.category}: ${warning.message}`);
    });
    console.groupEnd();
  }
  
  if (results.recommendations.length > 0) {
    console.group('✅ Recommandations');
    results.recommendations.forEach(rec => {
      console.log(`[${rec.category}] ${rec.message}`);
    });
    console.groupEnd();
  }
  
  console.groupEnd();
  
  return results;
};

// Fonction pour diagnostiquer une section spécifique
export const diagnoseSection = async (sectionName) => {
  const results = {
    section: sectionName,
    timestamp: new Date().toISOString(),
    issues: [],
    recommendations: []
  };

  try {
    // Vérifier si le composant existe
    const componentMap = {
      'budget': '../components/admin/BudgetManager',
      'payments': '../components/admin/AllPaymentsPage',
      'admin': '../pages/Admin',
      'restaurant': '../pages/restaurantadmin'
    };

    const componentPath = componentMap[sectionName.toLowerCase()];
    if (!componentPath) {
      results.issues.push({
        message: `Section ${sectionName} non reconnue`,
        severity: 'high'
      });
      return results;
    }

    const module = await import(componentPath);
    if (!module.default) {
      results.issues.push({
        message: `Composant ${sectionName} n'a pas d'export par défaut`,
        severity: 'high'
      });
    } else {
      results.recommendations.push({
        message: `Composant ${sectionName} disponible`
      });
    }

  } catch (error) {
    results.issues.push({
      message: `Erreur lors du chargement de ${sectionName}: ${error.message}`,
      severity: 'critical'
    });
  }

  return results;
};











