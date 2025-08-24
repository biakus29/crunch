/**
 * Script de test des performances pour l'application Crunch
 * Utilise Puppeteer pour automatiser les tests de performance
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration des tests
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  pages: [
    { name: 'Accueil', url: '/' },
    { name: 'Menu', url: '/accueil' },
    { name: 'Panier', url: '/panier' },
    { name: 'Détail Produit', url: '/detail/sample-id' },
  ],
  metrics: {
    LCP: { threshold: 2500, name: 'Largest Contentful Paint' },
    FID: { threshold: 100, name: 'First Input Delay' },
    CLS: { threshold: 0.1, name: 'Cumulative Layout Shift' },
    FCP: { threshold: 1800, name: 'First Contentful Paint' },
    TTI: { threshold: 3800, name: 'Time to Interactive' },
  },
  devices: [
    { name: 'Desktop', viewport: { width: 1920, height: 1080 } },
    { name: 'Mobile', viewport: { width: 375, height: 667 } },
    { name: 'Tablet', viewport: { width: 768, height: 1024 } },
  ],
};

class PerformanceTester {
  constructor() {
    this.browser = null;
    this.results = [];
  }

  async init() {
    console.log('🚀 Initialisation du testeur de performance...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async testPage(pageConfig, deviceConfig) {
    const page = await this.browser.newPage();
    
    try {
      // Configuration de la page
      await page.setViewport(deviceConfig.viewport);
      await page.setCacheEnabled(false); // Désactiver le cache pour des tests cohérents
      
      console.log(`📊 Test de ${pageConfig.name} sur ${deviceConfig.name}...`);
      
      // Collecter les métriques de performance
      const metrics = await this.collectMetrics(page, pageConfig.url);
      
      // Analyser les ressources chargées
      const resources = await this.analyzeResources(page);
      
      // Tester l'accessibilité
      const accessibility = await this.testAccessibility(page);
      
      const result = {
        page: pageConfig.name,
        device: deviceConfig.name,
        url: pageConfig.url,
        timestamp: new Date().toISOString(),
        metrics,
        resources,
        accessibility,
        passed: this.evaluateResults(metrics),
      };
      
      this.results.push(result);
      return result;
      
    } catch (error) {
      console.error(`❌ Erreur lors du test de ${pageConfig.name}:`, error);
      return null;
    } finally {
      await page.close();
    }
  }

  async collectMetrics(page, url) {
    // Naviguer vers la page
    const response = await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Collecter les Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {};
        let metricsCollected = 0;
        const totalMetrics = 5;

        const collectMetric = (name, value) => {
          vitals[name] = value;
          metricsCollected++;
          if (metricsCollected >= totalMetrics) {
            resolve(vitals);
          }
        };

        // Utiliser web-vitals si disponible
        if (window.webVitals) {
          window.webVitals.getCLS(({ value }) => collectMetric('CLS', value));
          window.webVitals.getFID(({ value }) => collectMetric('FID', value));
          window.webVitals.getFCP(({ value }) => collectMetric('FCP', value));
          window.webVitals.getLCP(({ value }) => collectMetric('LCP', value));
          window.webVitals.getTTFB(({ value }) => collectMetric('TTFB', value));
        } else {
          // Fallback avec Performance API
          const navigation = performance.getEntriesByType('navigation')[0];
          const paint = performance.getEntriesByType('paint');
          
          collectMetric('FCP', paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0);
          collectMetric('LCP', 0); // Approximation
          collectMetric('FID', 0); // Ne peut pas être mesuré sans interaction
          collectMetric('CLS', 0); // Nécessite observation
          collectMetric('TTFB', navigation?.responseStart - navigation?.requestStart || 0);
        }

        // Timeout de sécurité
        setTimeout(() => resolve(vitals), 5000);
      });
    });

    // Métriques de navigation
    const navigationMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (!navigation) return {};

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.navigationStart,
        responseTime: navigation.responseEnd - navigation.requestStart,
      };
    });

    // Métriques de ressources
    const resourceMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const totalSize = resources.reduce((sum, resource) => {
        return sum + (resource.transferSize || 0);
      }, 0);

      return {
        totalResources: resources.length,
        totalSize: totalSize,
        averageLoadTime: resources.reduce((sum, r) => sum + r.duration, 0) / resources.length,
      };
    });

    return {
      ...webVitals,
      ...navigationMetrics,
      ...resourceMetrics,
      statusCode: response?.status() || 0,
    };
  }

  async analyzeResources(page) {
    const resources = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      return entries.map(entry => ({
        name: entry.name,
        type: entry.initiatorType,
        size: entry.transferSize || 0,
        duration: entry.duration,
        cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
      }));
    });

    // Analyser par type de ressource
    const analysis = {
      total: resources.length,
      totalSize: resources.reduce((sum, r) => sum + r.size, 0),
      cached: resources.filter(r => r.cached).length,
      byType: {},
    };

    // Grouper par type
    resources.forEach(resource => {
      if (!analysis.byType[resource.type]) {
        analysis.byType[resource.type] = {
          count: 0,
          totalSize: 0,
          averageDuration: 0,
        };
      }
      
      analysis.byType[resource.type].count++;
      analysis.byType[resource.type].totalSize += resource.size;
    });

    // Calculer les moyennes
    Object.keys(analysis.byType).forEach(type => {
      const typeData = analysis.byType[type];
      const typeResources = resources.filter(r => r.type === type);
      typeData.averageDuration = typeResources.reduce((sum, r) => sum + r.duration, 0) / typeResources.length;
    });

    return analysis;
  }

  async testAccessibility(page) {
    // Test basique d'accessibilité
    const accessibility = await page.evaluate(() => {
      const issues = [];
      
      // Vérifier les images sans alt
      const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
      if (imagesWithoutAlt.length > 0) {
        issues.push(`${imagesWithoutAlt.length} images sans attribut alt`);
      }
      
      // Vérifier les liens sans texte
      const emptyLinks = document.querySelectorAll('a:empty, a[aria-label=""]');
      if (emptyLinks.length > 0) {
        issues.push(`${emptyLinks.length} liens sans texte`);
      }
      
      // Vérifier la structure des titres
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const h1Count = document.querySelectorAll('h1').length;
      if (h1Count !== 1) {
        issues.push(`${h1Count} éléments h1 trouvés (devrait être 1)`);
      }
      
      return {
        issues,
        score: Math.max(0, 100 - (issues.length * 10)),
      };
    });

    return accessibility;
  }

  evaluateResults(metrics) {
    const failures = [];
    
    Object.entries(TEST_CONFIG.metrics).forEach(([key, config]) => {
      const value = metrics[key];
      if (value && value > config.threshold) {
        failures.push(`${config.name}: ${value}ms > ${config.threshold}ms`);
      }
    });
    
    return {
      passed: failures.length === 0,
      failures,
    };
  }

  async runAllTests() {
    console.log('🧪 Démarrage des tests de performance...');
    
    for (const device of TEST_CONFIG.devices) {
      for (const page of TEST_CONFIG.pages) {
        await this.testPage(page, device);
      }
    }
    
    return this.generateReport();
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      results: this.results,
      recommendations: this.generateRecommendations(),
    };

    // Sauvegarder le rapport
    const reportPath = path.join(__dirname, '..', 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Générer un rapport HTML
    this.generateHtmlReport(report);
    
    console.log('📊 Rapport de performance généré:', reportPath);
    return report;
  }

  generateSummary() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed?.passed).length;
    const failedTests = totalTests - passedTests;
    
    const averageMetrics = {};
    Object.keys(TEST_CONFIG.metrics).forEach(metric => {
      const values = this.results
        .map(r => r.metrics[metric])
        .filter(v => v && v > 0);
      
      if (values.length > 0) {
        averageMetrics[metric] = {
          average: values.reduce((sum, v) => sum + v, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    });

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      averageMetrics,
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const summary = this.generateSummary();
    
    // Recommandations basées sur les métriques
    Object.entries(summary.averageMetrics).forEach(([metric, data]) => {
      const threshold = TEST_CONFIG.metrics[metric]?.threshold;
      if (threshold && data.average > threshold) {
        recommendations.push({
          type: 'performance',
          metric,
          issue: `${metric} moyen (${Math.round(data.average)}ms) dépasse le seuil (${threshold}ms)`,
          suggestions: this.getMetricSuggestions(metric),
        });
      }
    });

    // Recommandations basées sur les ressources
    const avgResourceSize = this.results.reduce((sum, r) => sum + (r.resources?.totalSize || 0), 0) / this.results.length;
    if (avgResourceSize > 1024 * 1024) { // 1MB
      recommendations.push({
        type: 'resources',
        issue: `Taille moyenne des ressources (${Math.round(avgResourceSize / 1024)}KB) trop élevée`,
        suggestions: [
          'Optimiser les images avec compression',
          'Implémenter le code splitting',
          'Utiliser la compression gzip/brotli',
          'Minifier les assets CSS/JS',
        ],
      });
    }

    return recommendations;
  }

  getMetricSuggestions(metric) {
    const suggestions = {
      LCP: [
        'Optimiser les images above-the-fold',
        'Précharger les ressources critiques',
        'Utiliser un CDN pour les assets',
        'Réduire le temps de réponse du serveur',
      ],
      FID: [
        'Réduire le JavaScript bloquant',
        'Utiliser le code splitting',
        'Optimiser les event listeners',
        'Différer le JavaScript non critique',
      ],
      CLS: [
        'Définir les dimensions des images',
        'Réserver l\'espace pour le contenu dynamique',
        'Éviter l\'insertion de contenu au-dessus du fold',
        'Utiliser des polices web optimisées',
      ],
      FCP: [
        'Optimiser le CSS critique',
        'Réduire le temps de réponse du serveur',
        'Éliminer les ressources bloquantes',
        'Utiliser la préconnexion pour les domaines externes',
      ],
    };

    return suggestions[metric] || ['Consulter la documentation de performance'];
  }

  generateHtmlReport(report) {
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport de Performance - Crunch App</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #059669; padding-bottom: 10px; }
        h2 { color: #059669; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #059669; }
        .metric-label { color: #666; margin-top: 5px; }
        .passed { color: #059669; }
        .failed { color: #dc3545; }
        .results-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .results-table th, .results-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .results-table th { background: #f8f9fa; font-weight: 600; }
        .recommendations { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .recommendation { margin: 10px 0; }
        .suggestion { margin-left: 20px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Rapport de Performance - Crunch App</h1>
        <p><strong>Généré le:</strong> ${new Date(report.timestamp).toLocaleString('fr-FR')}</p>
        
        <h2>Résumé</h2>
        <div class="summary">
            <div class="metric-card">
                <div class="metric-value">${report.summary.totalTests}</div>
                <div class="metric-label">Tests Total</div>
            </div>
            <div class="metric-card">
                <div class="metric-value passed">${report.summary.passedTests}</div>
                <div class="metric-label">Tests Réussis</div>
            </div>
            <div class="metric-card">
                <div class="metric-value failed">${report.summary.failedTests}</div>
                <div class="metric-label">Tests Échoués</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.round(report.summary.successRate)}%</div>
                <div class="metric-label">Taux de Réussite</div>
            </div>
        </div>

        <h2>Métriques Moyennes</h2>
        <div class="summary">
            ${Object.entries(report.summary.averageMetrics).map(([metric, data]) => `
                <div class="metric-card">
                    <div class="metric-value">${Math.round(data.average)}</div>
                    <div class="metric-label">${metric} (ms)</div>
                </div>
            `).join('')}
        </div>

        <h2>Résultats Détaillés</h2>
        <table class="results-table">
            <thead>
                <tr>
                    <th>Page</th>
                    <th>Appareil</th>
                    <th>LCP (ms)</th>
                    <th>FID (ms)</th>
                    <th>CLS</th>
                    <th>Statut</th>
                </tr>
            </thead>
            <tbody>
                ${report.results.map(result => `
                    <tr>
                        <td>${result.page}</td>
                        <td>${result.device}</td>
                        <td>${Math.round(result.metrics.LCP || 0)}</td>
                        <td>${Math.round(result.metrics.FID || 0)}</td>
                        <td>${(result.metrics.CLS || 0).toFixed(3)}</td>
                        <td class="${result.passed?.passed ? 'passed' : 'failed'}">
                            ${result.passed?.passed ? '✅ Réussi' : '❌ Échoué'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>Recommandations</h2>
        <div class="recommendations">
            ${report.recommendations.map(rec => `
                <div class="recommendation">
                    <strong>${rec.issue}</strong>
                    ${rec.suggestions ? rec.suggestions.map(s => `<div class="suggestion">• ${s}</div>`).join('') : ''}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `;

    const htmlPath = path.join(__dirname, '..', 'performance-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log('📄 Rapport HTML généré:', htmlPath);
  }
}

// Fonction principale
async function runPerformanceTests() {
  const tester = new PerformanceTester();
  
  try {
    await tester.init();
    const report = await tester.runAllTests();
    
    console.log('\n🎉 Tests de performance terminés!');
    console.log(`📊 Taux de réussite: ${Math.round(report.summary.successRate)}%`);
    console.log(`✅ Tests réussis: ${report.summary.passedTests}/${report.summary.totalTests}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommandations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.issue}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
    process.exit(1);
  } finally {
    await tester.close();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  runPerformanceTests();
}

module.exports = { PerformanceTester, runPerformanceTests };