// components/hooks/useScanManagement.js
import { useCallback, useEffect, useRef, useState } from "react";
import { apiService } from "../services/apiService";
import { WebSocketService } from "../services/webSocketService";
import { isValidGitHubUrl } from "../utils";

export const useScanManagement = () => {
  // États principaux
  const [scans, setScans] = useState([]);
  const [currentScan, setCurrentScan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [vulnStats, setVulnStats] = useState({});
  
  // États de l'interface
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [scanDepth, setScanDepth] = useState("standard");
  
  // WebSocket service
  const wsServiceRef = useRef(null);
  const isMountedRef = useRef(true);

  // Initialize WebSocket service
  useEffect(() => {
    if (!wsServiceRef.current) {
      wsServiceRef.current = new WebSocketService();
    }
    
    return () => {
      isMountedRef.current = false;
      if (wsServiceRef.current) {
        wsServiceRef.current.cleanup();
        wsServiceRef.current = null;
      }
    };
  }, []);

  // Fetch functions
  const fetchScans = useCallback(async (retries = 2) => {
    if (!isMountedRef.current) return;
    
    try {
      const data = await apiService.getScans({
        limit: 50,
        status: filterStatus,
        search: searchTerm,
      });
      
      if (isMountedRef.current) {
        setScans(data || []);

        // Update current scan if it exists
        if (currentScan) {
          const updatedCurrentScan = data?.find((scan) => scan.id === currentScan.id);
          if (updatedCurrentScan) {
            setCurrentScan(updatedCurrentScan);
            
            // Stop polling when scan completes
            if (updatedCurrentScan.status === 'completed' || updatedCurrentScan.status === 'failed') {
              console.log(`Scan ${updatedCurrentScan.id} finished with status: ${updatedCurrentScan.status}`);
              if (wsServiceRef.current) {
                wsServiceRef.current.stopPolling();
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Erreur récupération scans:", err);
      if (retries > 0 && isMountedRef.current) {
        setTimeout(() => fetchScans(retries - 1), 2000);
      }
    }
  }, [filterStatus, searchTerm, currentScan]);

  const fetchStats = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const data = await apiService.getStats();
      if (isMountedRef.current) {
        setStats(data || {});
      }
    } catch (error) {
      console.error("Erreur stats:", error);
    }
  }, []);

  const fetchVulnStats = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const data = await apiService.getVulnerabilitiesStats();
      if (isMountedRef.current) {
        setVulnStats(data || {});
      }
    } catch (error) {
      console.error("Erreur stats vulnérabilités:", error);
    }
  }, []);

  // Polling management
  const managePolling = useCallback(async () => {
    if (!wsServiceRef.current || !isMountedRef.current) return;
    
    try {
      const runningScans = await apiService.getScans({ status: "running" });
      const hasRunning = runningScans && runningScans.length > 0;
      
      if (hasRunning) {
        console.log(`Found ${runningScans.length} running scans, starting polling`);
        
        const checkRunningScans = async () => {
          try {
            const currentRunning = await apiService.getScans({ status: "running" });
            const stillHasRunning = currentRunning && currentRunning.length > 0;
            console.log(`Polling check: ${stillHasRunning ? currentRunning.length + ' running' : 'none running'}`);
            return stillHasRunning;
          } catch (error) {
            console.error("Error checking running scans:", error);
            return false;
          }
        };
        
        wsServiceRef.current.startPolling(checkRunningScans);
      } else {
        console.log("No running scans found");
        wsServiceRef.current.stopPolling();
      }
    } catch (error) {
      console.error("Error managing polling:", error);
      if (wsServiceRef.current) {
        wsServiceRef.current.stopPolling();
      }
    }
  }, []);

  // WebSocket setup
  useEffect(() => {
    if (!wsServiceRef.current || !isMountedRef.current) return;

    const handleUpdate = (data) => {
      console.log("Received update:", data.type);
      if (!isMountedRef.current) return;
      
      fetchScans();
      fetchStats();
      fetchVulnStats();
    };

    wsServiceRef.current.subscribe("app-updates", handleUpdate);
    managePolling();

    return () => {
      if (wsServiceRef.current) {
        wsServiceRef.current.unsubscribe("app-updates");
      }
    };
  }, [fetchScans, fetchStats, fetchVulnStats, managePolling]);

  // Load initial data
  useEffect(() => {
    fetchScans();
    fetchStats();
    fetchVulnStats();
  }, [fetchScans, fetchStats, fetchVulnStats]);

  // Scan handling
  const handleScan = useCallback(async (githubUrl, scanDepth, addNotification) => {
    if (!isValidGitHubUrl(githubUrl)) {
      const errorMsg = "Veuillez entrer une URL GitHub valide (ex: https://github.com/user/repo)";
      setError(errorMsg);
      addNotification(errorMsg, "error");
      return false;
    }

    setLoading(true);
    setError(null);
    setCurrentScan(null);

    try {
      console.log("Démarrage du scan...", { githubUrl, scanDepth });

      const result = await apiService.startScan(githubUrl, scanDepth);

      if (result.success && result.scan) {
        if (isMountedRef.current) {
          setCurrentScan(result.scan);
          addNotification(`Scan démarré pour ${result.scan.repository}`, "success");
          
          // Start polling for this new scan
          setTimeout(() => {
            managePolling();
          }, 1000);
          
          return true;
        }
      } else {
        throw new Error(result.error || "Réponse invalide du serveur");
      }
    } catch (err) {
      const errorMsg = err.message || "Erreur lors du démarrage du scan";
      if (isMountedRef.current) {
        setError(errorMsg);
        addNotification(errorMsg, "error", true);
      }
      console.error("Erreur scan:", err);
      return false;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [managePolling]);

  return {
    // State
    scans,
    currentScan,
    loading,
    error,
    stats,
    vulnStats,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    scanDepth,
    setScanDepth,
    
    // Actions
    handleScan,
    fetchScans,
    fetchStats,
    fetchVulnStats,
  };
};