// components/scan/ScanHistoryTable.js
import { Download, Eye, RotateCcw, Search, Shield } from "lucide-react";
import { getStatusIcon, getStatusLabel, getVulnerabilitiesFromResults } from "../utils";
import { apiService } from "../services/apiService";

const ScanHistoryTable = ({
  theme,
  darkMode,
  filteredScans,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  setSelectedScan,
  setSelectedVulnerabilities,
  setGithubUrl,
  setScanDepth,
  addNotification,
}) => {
  return (
    <div className={`${theme.cardBg} rounded-lg shadow-sm ${theme.border} border`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${theme.text}`}>
            Historique des scans
          </h3>

          <div className="flex space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 pr-4 py-2 ${theme.cardBg} ${theme.border} border rounded-lg ${theme.text} focus:outline-none focus:ring-2 focus:ring-blue-500 w-64`}
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`px-4 py-2 ${theme.cardBg} ${theme.border} border rounded-lg ${theme.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="all">Tous les statuts</option>
              <option value="completed">Terminés</option>
              <option value="running">En cours</option>
              <option value="failed">Échoués</option>
              <option value="pending">En attente</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {filteredScans.length === 0 ? (
          <div className="p-12 text-center">
            <div className={`text-6xl mb-4 ${theme.textMuted}`}>📊</div>
            <p className={`text-lg ${theme.textMuted}`}>
              {searchTerm || filterStatus !== "all"
                ? "Aucun scan ne correspond à vos critères"
                : "Aucun scan enregistré pour le moment"}
            </p>
          </div>
        ) : (
          <table className="min-w-full">
            <thead className={`bg-gray-50 ${darkMode ? "bg-gray-700" : ""}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                  Dépôt
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                  Statut
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                  Vulnérabilités
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                  Date
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                  Durée
                </th>
                <th className={`px-6 py-3 text-right text-xs font-medium ${theme.textMuted} uppercase tracking-wider`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredScans.map((scan) => {
                const vulnCounts = getVulnerabilitiesFromResults(scan);
                const duration = scan.completed_at
                  ? Math.round(
                      (new Date(scan.completed_at) - new Date(scan.start_time)) / 1000
                    )
                  : null;

                return (
                  <tr
                    key={scan.id}
                    className={`hover:${
                      darkMode ? "bg-gray-700" : "bg-gray-50"
                    } transition-colors cursor-pointer`}
                    onClick={() => setSelectedScan(scan)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-medium ${theme.text}`}>
                            {scan.repository}
                          </div>
                          <div className={`text-sm ${theme.textMuted}`}>
                            {scan.files_scanned
                              ? `${scan.files_scanned} fichiers`
                              : "En cours..."}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(scan.status)}
                        <span
                          className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                            scan.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : scan.status === "running"
                              ? "bg-blue-100 text-blue-800"
                              : scan.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {getStatusLabel(scan.status)}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {scan.status === "completed" ? (
                        <div className="flex items-center space-x-2">
                          <div
                            className={`text-lg font-bold ${
                              vulnCounts.total === 0
                                ? "text-green-600"
                                : vulnCounts.critical > 0
                                ? "text-red-600"
                                : vulnCounts.high > 0
                                ? "text-orange-600"
                                : "text-yellow-600"
                            }`}
                          >
                            {vulnCounts.total}
                          </div>
                          {vulnCounts.critical > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              {vulnCounts.critical} critique
                              {vulnCounts.critical > 1 ? "s" : ""}
                            </span>
                          )}
                          {vulnCounts.high > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {vulnCounts.high} élevée
                              {vulnCounts.high > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={`text-sm ${theme.textMuted}`}>
                          {scan.status === "running" ? "En analyse..." : "-"}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${theme.text}`}>
                        {new Date(scan.start_time).toLocaleDateString("fr-FR")}
                      </div>
                      <div className={`text-sm ${theme.textMuted}`}>
                        {new Date(scan.start_time).toLocaleTimeString("fr-FR")}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${theme.text}`}>
                        {duration ? `${duration}s` : "-"}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {scan.status === "completed" && vulnCounts.total > 0 && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVulnerabilities(scan);
                              }}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                              title="Voir les vulnérabilités"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                apiService.exportVulnerabilities(scan.id);
                              }}
                              className="text-green-600 hover:text-green-900 transition-colors"
                              title="Exporter en CSV"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const repoUrl =
                              scan.github_url ||
                              `https://github.com/${scan.repository}`;
                            setGithubUrl(repoUrl);
                            setScanDepth("standard");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                            addNotification(
                              `URL copiée: ${scan.repository}`,
                              "info"
                            );
                          }}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors"
                          title="Relancer le scan"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ScanHistoryTable;