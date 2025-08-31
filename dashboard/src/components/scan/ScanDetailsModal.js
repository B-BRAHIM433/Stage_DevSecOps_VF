// components/scan/ScanDetailsModal.js
import { Download, Eye, Shield, X, XCircle } from "lucide-react";
import { getStatusIcon, getStatusLabel, getVulnerabilitiesFromResults } from "../utils";
import { apiService } from "../services/apiService";

const ScanDetailsModal = ({
  selectedScan,
  setSelectedScan,
  setSelectedVulnerabilities,
  theme,
  darkMode,
}) => {
  if (!selectedScan) return null;

  const vulnCounts = getVulnerabilitiesFromResults(selectedScan);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${theme.cardBg} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="w-6 h-6 mr-3 text-blue-600" />
              <div>
                <h2 className={`text-xl font-bold ${theme.text}`}>
                  {selectedScan.repository}
                </h2>
                <p className={`${theme.textMuted}`}>Scan #{selectedScan.id}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedScan(null)}
              className={`${theme.textMuted} hover:text-gray-700 transition-colors`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Informations générales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={`p-4 ${darkMode ? "bg-gray-700" : "bg-gray-50"} rounded-lg`}>
              <p className={`text-sm font-medium ${theme.textMuted} mb-1`}>Statut</p>
              <div className="flex items-center">
                {getStatusIcon(selectedScan.status)}
                <span className={`ml-2 font-semibold ${theme.text}`}>
                  {getStatusLabel(selectedScan.status)}
                </span>
              </div>
            </div>

            <div className={`p-4 ${darkMode ? "bg-gray-700" : "bg-gray-50"} rounded-lg`}>
              <p className={`text-sm font-medium ${theme.textMuted} mb-1`}>Date de début</p>
              <p className={`font-semibold ${theme.text}`}>
                {new Date(selectedScan.start_time).toLocaleString("fr-FR")}
              </p>
            </div>

            {selectedScan.completed_at && (
              <div className={`p-4 ${darkMode ? "bg-gray-700" : "bg-gray-50"} rounded-lg`}>
                <p className={`text-sm font-medium ${theme.textMuted} mb-1`}>Durée</p>
                <p className={`font-semibold ${theme.text}`}>
                  {Math.round(
                    (new Date(selectedScan.completed_at) - new Date(selectedScan.start_time)) / 1000
                  )}s
                </p>
              </div>
            )}

            {selectedScan.files_scanned && (
              <div className={`p-4 ${darkMode ? "bg-gray-700" : "bg-gray-50"} rounded-lg`}>
                <p className={`text-sm font-medium ${theme.textMuted} mb-1`}>Fichiers analysés</p>
                <p className={`font-semibold ${theme.text}`}>{selectedScan.files_scanned}</p>
              </div>
            )}
          </div>

          {/* Résultats de sécurité */}
          {selectedScan.status === "completed" && vulnCounts.total >= 0 && (
            <div>
              <h3 className={`text-lg font-semibold ${theme.text} mb-4`}>
                Résultats de sécurité
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    key: "critical",
                    label: "Critiques",
                    count: vulnCounts.critical,
                    color: "bg-red-600",
                  },
                  {
                    key: "high",
                    label: "Élevées",
                    count: vulnCounts.high,
                    color: "bg-orange-600",
                  },
                  {
                    key: "medium",
                    label: "Moyennes",
                    count: vulnCounts.medium,
                    color: "bg-yellow-600",
                  },
                  {
                    key: "low",
                    label: "Faibles",
                    count: vulnCounts.low,
                    color: "bg-green-600",
                  },
                ].map(({ key, label, count, color }) => (
                  <div
                    key={key}
                    className={`p-4 rounded-lg text-center text-white ${
                      count > 0 ? color : "bg-gray-400"
                    }`}
                  >
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm opacity-90">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-3">
                {vulnCounts.total > 0 && (
                  <>
                    <button
                      onClick={() => setSelectedVulnerabilities(selectedScan)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Voir les détails des vulnérabilités ({vulnCounts.total})
                    </button>

                    <button
                      onClick={() => apiService.exportVulnerabilities(selectedScan.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </button>
                  </>
                )}

                {vulnCounts.total === 0 && (
                  <div className="flex-1 text-center py-4">
                    <Shield className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className={`font-medium ${theme.text}`}>
                      Aucune vulnérabilité détectée
                    </p>
                    <p className={`text-sm ${theme.textMuted}`}>
                      Ce dépôt semble sécurisé!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Message d'erreur */}
          {selectedScan.error_message && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 text-red-500 mr-2" />
                <div>
                  <h4 className="font-medium text-red-800">Erreur durant l'exécution</h4>
                  <p className="text-sm text-red-700 mt-1">{selectedScan.error_message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanDetailsModal;