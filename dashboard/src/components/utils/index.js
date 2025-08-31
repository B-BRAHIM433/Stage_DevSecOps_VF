// components/utils/index.js
import React from "react";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";

export const isValidGitHubUrl = (url) => {
  const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
  return githubRegex.test(url.trim());
};

export const getStatusIcon = (status) => {
  switch (status) {
    case "pending":
      return <Clock className="w-5 h-5 text-yellow-500" />;
    case "running":
      return <div className="w-5 h-5 text-blue-500 animate-spin">⚡</div>;
    case "completed":
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <AlertCircle className="w-5 h-5 text-gray-500" />;
  }
};

export const getStatusLabel = (status) => {
  const labels = {
    pending: "En attente",
    running: "En cours",
    completed: "Terminé",
    failed: "Échoué",
  };
  return labels[status] || "Inconnu";
};

export const getSeverityColor = (severity) => {
  const colors = {
    CRITICAL: "bg-red-600",
    HIGH: "bg-orange-600",
    MEDIUM: "bg-yellow-600",
    LOW: "bg-green-600",
  };
  return colors[severity] || "bg-gray-600";
};

export const getVulnerabilitiesFromResults = (scan) => {
  if (!scan.results || !scan.results.detailed_vulnerabilities) {
    return { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
  }

  const vulns = scan.results.detailed_vulnerabilities;
  return {
    total: vulns.length,
    critical: vulns.filter((v) => v.severity === "CRITICAL").length,
    high: vulns.filter((v) => v.severity === "HIGH").length,
    medium: vulns.filter((v) => v.severity === "MEDIUM").length,
    low: vulns.filter((v) => v.severity === "LOW").length,
  };
};

export const createTheme = (darkMode) => ({
  bg: darkMode ? "bg-gray-900" : "bg-gray-50",
  cardBg: darkMode ? "bg-gray-800" : "bg-white",
  text: darkMode ? "text-white" : "text-gray-900",
  textMuted: darkMode ? "text-gray-400" : "text-gray-600",
  border: darkMode ? "border-gray-700" : "border-gray-200",
  primary: "text-blue-500",
  success: "text-green-500",
  warning: "text-yellow-500",
  danger: "text-red-500",
  info: "text-blue-500",
});