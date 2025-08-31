// components/services/apiService.js
export const apiService = {
  baseUrl: "http://localhost:3001",

  async startScan(githubUrl, scanDepth = "standard") {
    console.log("🚀 Démarrage du scan:", { githubUrl, scanDepth });

    try {
      const response = await fetch(`${this.baseUrl}/api/scan/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          githubUrl,
          scanDepth,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log("✅ Scan démarré:", result);
      return result;
    } catch (error) {
      console.error("❌ Erreur démarrage scan:", error);
      throw error;
    }
  },

  async getScanDetails(scanId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/scan/${scanId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("❌ Erreur détails scan:", error);
      throw error;
    }
  },

  async getScanVulnerabilities(scanId) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/scan/${scanId}/vulnerabilities`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("❌ Erreur vulnérabilités scan:", error);
      throw error;
    }
  },

  async exportVulnerabilities(scanId) {
    try {
      const vulnerabilities = await this.getScanVulnerabilities(scanId);
      const csvContent = this.convertToCSV(vulnerabilities);

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vulnerabilities-${scanId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true };
    } catch (error) {
      console.error("❌ Erreur export:", error);
      throw error;
    }
  },

  convertToCSV(vulnerabilities) {
    if (!vulnerabilities || vulnerabilities.length === 0) {
      return "No vulnerabilities found";
    }

    const headers = [
      "Vulnerability ID",
      "Title",
      "Severity",
      "Package",
      "Installed Version",
      "Fixed Version",
      "Description",
      "References",
    ];

    const rows = vulnerabilities.map((vuln) => [
      vuln.vuln_id || "",
      vuln.title || "",
      vuln.severity || "",
      vuln.package_name || "",
      vuln.version || "",
      vuln.fixed_version || "",
      (vuln.description || "").replace(/"/g, '""'),
      vuln.reference_links || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((field) => `"${field}"`).join(",")),
    ].join("\n");

    return csvContent;
  },

  async getScans(params = {}) {
    const { limit = 20, status = "all", search = "" } = params;
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      status,
      search,
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/scans?${queryParams}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("❌ Erreur récupération scans:", error);
      throw error;
    }
  },

  async getStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/stats`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("❌ Erreur stats:", error);
      throw error;
    }
  },

  async getVulnerabilitiesStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/stats/vulnerabilities`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("❌ Erreur stats vulnérabilités:", error);
      throw error;
    }
  },
};