// components/scan/CurrentScanStatus.js
import { Download, Eye } from "lucide-react";
import { getStatusIcon, getStatusLabel, getVulnerabilitiesFromResults } from "../utils";
import { apiService } from "../services/apiService";

const CurrentScanStatus = ({
  currentScan,
  theme,
  setSelectedVulnerabilities,
}) => {
  if (!currentScan) return null;

  const duration = currentScan.completed_at
    ? Math.round(
        (new Date(currentScan.completed_at) - new Date(currentScan.start_time)) / 1000
      )
    : Math.round((Date.now() - new Date(currentScan.start_time)) / 1000);

  const vulnCounts = getVulnerabilitiesFromResults(currentScan);

  return (
    <div className={`${theme.cardBg} p-6 rounded-lg shadow-sm ${theme.border} border`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          {getStatusIcon(currentScan.status)}
          <div className="ml-3">
            <h3 className={`text-lg font-semibold ${theme.text}`}>
              Scan {getStatusLabel(currentScan.status)}
            </h3>
            <p className={`${theme.textMuted}`}>📦 {currentScan.repository}</p>
          </div>
        </div>

        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            currentScan.status === "completed"
              ? "bg-green-100 text-green-800"
              : currentScan.status === "running"
              ? "bg-blue-100 text-blue-800"
              : currentScan.status === "failed"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {getStatusLabel(currentScan.status)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className={`text-sm ${theme.textMuted}`}>Démarré</p>
          <p className={`font-medium ${theme.text}`}>
            {new Date(currentScan.start_time).toLocaleString("fr-FR")}
          </p>
        </div>
        <div>
          <p className={`text-sm ${theme.textMuted}`}>Durée</p>
          <p className={`font-medium ${theme.text}`}>{duration}s</p>
        </div>
        {currentScan.files_scanned && (
          <div>
            <p className={`text-sm ${theme.textMuted}`}>Fichiers</p>
            <p className={`font-medium ${theme.text}`}>{currentScan.files_scanned}</p>
          </div>
        )}
        {currentScan.status === "completed" && (
          <div>
            <p className={`text-sm ${theme.textMuted}`}>Vulnérabilités</p>
            <p className={`font-medium ${theme.text}`}>{vulnCounts.total}</p>
          </div>
        )}
      </div>

      {currentScan.status === "running" && (
        <div className="mt-4">
          <div className="bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full animate-pulse"
              style={{ width: "60%" }}
            ></div>
          </div>
          <p className={`text-sm ${theme.textMuted} mt-2`}>🔍 Analyse en cours...</p>
        </div>
      )}

      {currentScan.status === "completed" && vulnCounts.total > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className={`font-semibold ${theme.text}`}>Vulnérabilités détectées</h4>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedVulnerabilities(currentScan)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                <Eye className="w-4 h-4 inline mr-1" />
                Détails
              </button>
              <button
                onClick={() => apiService.exportVulnerabilities(currentScan.id)}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                <Download className="w-4 h-4 inline mr-1" />
                CSV
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {vulnCounts.critical > 0 && (
              <div className="bg-red-600 text-white text-center py-2 rounded text-sm">
                <div className="font-bold">{vulnCounts.critical}</div>
                <div>Critiques</div>
              </div>
            )}
            {vulnCounts.high > 0 && (
              <div className="bg-orange-600 text-white text-center py-2 rounded text-sm">
                <div className="font-bold">{vulnCounts.high}</div>
                <div>Élevées</div>
              </div>
            )}
            {vulnCounts.medium > 0 && (
              <div className="bg-yellow-600 text-white text-center py-2 rounded text-sm">
                <div className="font-bold">{vulnCounts.medium}</div>
                <div>Moyennes</div>
              </div>
            )}
            {vulnCounts.low > 0 && (
              <div className="bg-green-600 text-white text-center py-2 rounded text-sm">
                <div className="font-bold">{vulnCounts.low}</div>
                <div>Faibles</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CurrentScanStatus;