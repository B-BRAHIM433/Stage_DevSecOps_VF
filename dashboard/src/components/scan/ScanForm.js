// components/scan/ScanForm.js
import { Shield, XCircle } from "lucide-react";
import { isValidGitHubUrl } from "../utils";

const ScanForm = ({
  theme,
  githubUrl,
  setGithubUrl,
  scanDepth,
  setScanDepth,
  loading,
  error,
  onScan,
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!isValidGitHubUrl(githubUrl)) {
      return;
    }
    
    onScan();
  };

  return (
    <div className={`${theme.cardBg} p-6 rounded-lg shadow-sm ${theme.border} border`}>
      <h2 className={`text-xl font-bold ${theme.text} mb-6 flex items-center`}>
        <Shield className="w-6 h-6 mr-2" />
        Nouveau scan de sécurité
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            <label className={`block text-sm font-medium ${theme.text} mb-2`}>
              URL du dépôt GitHub
            </label>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              disabled={loading}
              className={`w-full px-4 py-3 ${theme.cardBg} ${
                theme.border
              } border rounded-lg ${
                theme.text
              } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                error ? "border-red-500" : ""
              }`}
            />
          </div>

          <div className="lg:col-span-2">
            <label className={`block text-sm font-medium ${theme.text} mb-2`}>
              Profondeur
            </label>
            <select
              value={scanDepth}
              onChange={(e) => setScanDepth(e.target.value)}
              disabled={loading}
              className={`w-full px-4 py-3 ${theme.cardBg} ${theme.border} border rounded-lg ${theme.text} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="standard">Standard</option>
              <option value="deep">Approfondi</option>
              <option value="quick">Rapide</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={loading || !githubUrl.trim()}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                loading || !githubUrl.trim()
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              } text-white flex items-center justify-center`}
            >
              {loading ? (
                <>
                  <div className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Analyse...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Scanner
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default ScanForm;