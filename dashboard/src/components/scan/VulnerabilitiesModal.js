// components/scan/VulnerabilitiesModal.js
import { Bug, Download, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getSeverityColor } from "../utils";
import { apiService } from "../services/apiService";

const VulnerabilitiesModal = ({
  selectedVulnerabilities,
  setSelectedVulnerabilities,
  theme,
  darkMode,
  addNotification,
}) => {
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [groupBy, setGroupBy] = useState("severity");

  useEffect(() => {
    if (selectedVulnerabilities) {
      setLoading(true);
      apiService
        .getScanVulnerabilities(selectedVulnerabilities.id)
        .then((data) => {
          console.log("Vulnérabilités reçues:", data);
          setVulnerabilities(data || []);
        })
        .catch((error) => {
          console.error("Erreur récupération vulnérabilités:", error);
          addNotification(
            "Erreur lors du chargement des vulnérabilités",
            "error"
          );
        })
        .finally(() => setLoading(false));
    }
  }, [selectedVulnerabilities, addNotification]);

  if (!selectedVulnerabilities) return null;

  const groupedVulnerabilities =
    vulnerabilities.length > 0
      ? (() => {
          if (groupBy === "severity") {
            return vulnerabilities.reduce((acc, vuln) => {
              const severity = vuln.severity || "UNKNOWN";
              if (!acc[severity]) acc[severity] = [];
              acc[severity].push(vuln);
              return acc;
            }, {});
          } else if (groupBy === "package") {
            return vulnerabilities.reduce((acc, vuln) => {
              const pkg = vuln.package_name || "Unknown";
              if (!acc[pkg]) acc[pkg] = [];
              acc[pkg].push(vuln);
              return acc;
            }, {});
          }
          return { Toutes: vulnerabilities };
        })()
      : {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${theme.cardBg} rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col`}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Bug className="w-6 h-6 mr-3 text-red-600" />
              <div>
                <h2 className={`text-xl font-bold ${theme.text}`}>
                  Vulnérabilités détaillées
                </h2>
                <p className={`${theme.textMuted}`}>
                  {selectedVulnerabilities.repository} -{" "}
                  {vulnerabilities.length} vulnérabilité
                  {vulnerabilities.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className={`px-3 py-2 ${theme.cardBg} ${theme.border} border rounded-lg ${theme.text} text-sm`}
              >
                <option value="severity">Grouper par sévérité</option>
                <option value="package">Grouper par package</option>
                <option value="none">Sans groupement</option>
              </select>

              {vulnerabilities.length > 0 && (
                <button
                  onClick={() =>
                    apiService.exportVulnerabilities(selectedVulnerabilities.id)
                  }
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center text-sm"
                >
                  <Download className="w-4 h-4 mr-1" />
                  CSV
                </button>
              )}

              <button
                onClick={() => setSelectedVulnerabilities(null)}
                className={`${theme.textMuted} hover:text-gray-700 transition-colors`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              <span className={`ml-3 ${theme.text}`}>
                Chargement des vulnérabilités...
              </span>
            </div>
          ) : vulnerabilities.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className={`text-lg font-medium ${theme.text}`}>
                Aucune vulnérabilité détectée
              </p>
              <p className={`${theme.textMuted}`}>
                Ce dépôt semble sécurisé !
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedVulnerabilities).map(
                ([groupName, vulns]) => (
                  <div key={groupName}>
                    <div className="flex items-center mb-4">
                      <h3
                        className={`text-lg font-semibold ${theme.text} flex items-center`}
                      >
                        {groupBy === "severity" && (
                          <div
                            className={`w-4 h-4 rounded ${getSeverityColor(
                              groupName
                            )} mr-2`}
                          ></div>
                        )}
                        {groupName}
                        <span
                          className={`ml-2 px-2 py-1 bg-gray-100 ${theme.textMuted} text-sm rounded-full`}
                        >
                          {vulns.length}
                        </span>
                      </h3>
                    </div>

                    <div className="grid gap-4">
                      {vulns.map((vuln, index) => (
                        <div
                          key={`${vuln.id}-${index}`}
                          className={`${
                            darkMode ? "bg-gray-700" : "bg-gray-50"
                          } p-4 rounded-lg border-l-4 ${getSeverityColor(
                            vuln.severity
                          )}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4
                                className={`font-semibold ${theme.text} mb-1`}
                              >
                                {vuln.title || vuln.vuln_id}
                              </h4>
                              <div className="flex items-center space-x-4 text-sm">
                                <span
                                  className={`px-2 py-1 rounded text-white text-xs ${getSeverityColor(
                                    vuln.severity
                                  )}`}
                                >
                                  {vuln.severity}
                                </span>
                                <span className={`${theme.textMuted}`}>
                                  📦 {vuln.package_name}
                                </span>
                                <span className={`${theme.textMuted}`}>
                                  🆔 {vuln.vuln_id}
                                </span>
                              </div>
                            </div>
                          </div>

                          <p
                            className={`${theme.text} text-sm mb-3 leading-relaxed`}
                          >
                            {vuln.description}
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span
                                className={`font-medium ${theme.textMuted}`}
                              >
                                Version installée:
                              </span>
                              <div className={`${theme.text} font-mono`}>
                                {vuln.version || "N/A"}
                              </div>
                            </div>
                            <div>
                              <span
                                className={`font-medium ${theme.textMuted}`}
                              >
                                Version corrigée:
                              </span>
                              <div className={`${theme.text} font-mono`}>
                                {vuln.fixed_version || "N/A"}
                              </div>
                            </div>
                          </div>

                          {vuln.reference_links && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <span
                                className={`font-medium ${theme.textMuted} text-xs`}
                              >
                                Références:
                              </span>
                              <div className="mt-1">
                                {(() => {
                                  try {
                                    const refs = Array.isArray(
                                      vuln.reference_links
                                    )
                                      ? vuln.reference_links
                                      : JSON.parse(vuln.reference_links);

                                    return refs.slice(0, 3).map((ref, i) => (
                                      <a
                                        key={i}
                                        href={ref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline text-xs mr-3"
                                      >
                                        {ref.length > 50
                                          ? `${ref.slice(0, 47)}...`
                                          : ref}
                                      </a>
                                    ));
                                  } catch {
                                    return (
                                      <span
                                        className={`text-xs ${theme.textMuted}`}
                                      >
                                        Références non disponibles
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VulnerabilitiesModal;