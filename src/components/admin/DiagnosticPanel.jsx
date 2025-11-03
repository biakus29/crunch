import React, { useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Bug } from 'lucide-react';
import { logDiagnostic, diagnoseSection } from '../../utils/diagnostic';

const DiagnosticPanel = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);

  const runFullDiagnostic = async () => {
    setIsRunning(true);
    try {
      const diagnosticResults = await logDiagnostic();
      setResults(diagnosticResults);
    } catch (error) {
      console.error('Erreur lors du diagnostic:', error);
      setResults({
        issues: [{
          category: 'Diagnostic',
          message: `Erreur lors de l'exécution du diagnostic: ${error.message}`,
          severity: 'critical'
        }],
        warnings: [],
        recommendations: []
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runSectionDiagnostic = async (section) => {
    setIsRunning(true);
    try {
      const sectionResults = await diagnoseSection(section);
      setResults({
        issues: sectionResults.issues,
        warnings: [],
        recommendations: sectionResults.recommendations
      });
    } catch (error) {
      console.error('Erreur lors du diagnostic de section:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Bug className="w-5 h-5 mr-2 text-blue-600" />
          Diagnostic du Système
        </h3>
        <button
          onClick={runFullDiagnostic}
          disabled={isRunning}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Diagnostic...' : 'Diagnostic Complet'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <button
          onClick={() => runSectionDiagnostic('budget')}
          disabled={isRunning}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          Budget
        </button>
        <button
          onClick={() => runSectionDiagnostic('payments')}
          disabled={isRunning}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          Paiements
        </button>
        <button
          onClick={() => runSectionDiagnostic('admin')}
          disabled={isRunning}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          Admin
        </button>
        <button
          onClick={() => runSectionDiagnostic('restaurant')}
          disabled={isRunning}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          Restaurant
        </button>
      </div>

      {results && (
        <div className="space-y-4">
          {results.issues && results.issues.length > 0 && (
            <div>
              <h4 className="font-medium text-red-800 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Problèmes Détectés ({results.issues.length})
              </h4>
              <div className="space-y-2">
                {results.issues.map((issue, index) => (
                  <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-red-800">{issue.category}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        issue.severity === 'critical' ? 'bg-red-600 text-white' :
                        issue.severity === 'high' ? 'bg-red-500 text-white' :
                        issue.severity === 'medium' ? 'bg-yellow-500 text-white' :
                        'bg-gray-500 text-white'
                      }`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-red-700 text-sm mt-1">{issue.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.warnings && results.warnings.length > 0 && (
            <div>
              <h4 className="font-medium text-yellow-800 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Avertissements ({results.warnings.length})
              </h4>
              <div className="space-y-2">
                {results.warnings.map((warning, index) => (
                  <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-yellow-800">{warning.category}</span>
                      <span className="text-xs px-2 py-1 rounded bg-yellow-500 text-white">
                        {warning.severity}
                      </span>
                    </div>
                    <p className="text-yellow-700 text-sm mt-1">{warning.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.recommendations && results.recommendations.length > 0 && (
            <div>
              <h4 className="font-medium text-green-800 mb-2 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2" />
                Recommandations ({results.recommendations.length})
              </h4>
              <div className="space-y-2">
                {results.recommendations.map((rec, index) => (
                  <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-green-800">{rec.category}</span>
                    </div>
                    <p className="text-green-700 text-sm mt-1">{rec.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800 text-sm">
          <strong>Note:</strong> Le diagnostic vérifie la configuration Firebase, les permissions, 
          le chargement des composants et la connectivité réseau. Consultez la console pour plus de détails.
        </p>
      </div>
    </div>
  );
};

export default DiagnosticPanel;











