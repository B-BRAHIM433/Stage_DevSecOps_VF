import React, { useState, useEffect, useCallback, useMemo } from 'react';

const apiService = {
  baseUrl: 'http://localhost:3001',
  
  async startScan(repository, scanDepth = 'standard') {
    console.log('🚀 Démarrage du scan:', { repository, scanDepth });
    
    try {
      const response = await fetch(`${this.baseUrl}/api/start-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository,
          scanDepth,
          userId: this.getUserId(),
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Scan démarré:', result);
      return result;
    } catch (error) {
      console.error('❌ Erreur démarrage scan:', error);
      throw error;
    }
  },

  // Vérifier le statut d'un scan
  async getScanStatus(scanId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/scan-status/${scanId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ Erreur statut scan:', error);
      throw error;
    }
  },

  // Récupérer les résultats d'un scan
  async getScanResults(scanId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/scan-results/${scanId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ Erreur résultats scan:', error);
      throw error;
    }
  },

  // Récupérer la liste des scans
  async getScans(params = {}) {
    const { limit = 20, status = 'all', search = '' } = params;
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      status,
      search
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/scans?${queryParams}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('❌ Erreur récupération scans:', error);
      throw error;
    }
  },

  // Supprimer un scan
  async deleteScan(scanId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/scans/${scanId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Erreur suppression scan:', error);
      throw error;
    }
  },

  // Helper pour l'ID utilisateur
  getUserId() {
    return `user_${Date.now()}`;
  }
};

function App() {
  const [githubUrl, setGithubUrl] = useState('');
  const [scans, setScans] = useState([]);
  const [currentScan, setCurrentScan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ws, setWs] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  
  const [selectedScan, setSelectedScan] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [deletingScans, setDeletingScans] = useState(new Set());
  const [selectedScansForDeletion, setSelectedScansForDeletion] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [scanDepth, setScanDepth] = useState('standard');

  const theme = useMemo(() => ({
    bg: darkMode ? '#0f0f23' : '#f8f9fa',
    cardBg: darkMode ? '#1e1e3f' : 'white',
    text: darkMode ? '#ffffff' : '#2c3e50',
    textMuted: darkMode ? '#a0a0a0' : '#6c757d',
    border: darkMode ? '#404040' : '#e1e8ed',
    primary: '#3498db',
    success: '#27ae60',
    warning: '#f39c12',
    danger: '#e74c3c',
    info: '#17a2b8'
  }), [darkMode]);

  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    const notification = { 
      id, 
      message, 
      type, 
      timestamp: new Date(),
      read: false 
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Max 10 notifications
    
    // Auto-suppression après 5 secondes pour les succès/infos
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 5000);
    }
  }, []);

  // ✅ RÉCUPÉRATION DES SCANS AVEC RETRY
  const fetchScans = useCallback(async (retries = 3) => {
    try {
      const data = await apiService.getScans({
        limit: 50,
        status: filterStatus,
        search: searchTerm
      });
      setScans(data);
    } catch (err) {
      console.error('❌ Erreur récupération scans:', err);
      if (retries > 0) {
        setTimeout(() => fetchScans(retries - 1), 2000);
      } else {
        addNotification('Impossible de charger l\'historique', 'error');
      }
    }
  }, [filterStatus, searchTerm, addNotification]);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  // ✅ VALIDATION URL GITHUB AMÉLIORÉE
  const isValidGitHubUrl = (url) => {
    const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
    return githubRegex.test(url.trim());
  };

  // ✅ DÉMARRAGE DE SCAN AVEC GESTION D'ERREURS ROBUSTE
  const handleScan = async (e) => {
    e.preventDefault();
    
    if (!isValidGitHubUrl(githubUrl)) {
      const errorMsg = 'Veuillez entrer une URL GitHub valide (ex: https://github.com/user/repo)';
      setError(errorMsg);
      addNotification(errorMsg, 'error');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentScan(null);
    
    try {
      console.log('🚀 Démarrage du scan...', { githubUrl, scanDepth });
      
      const result = await apiService.startScan(githubUrl, scanDepth);
      
      if (result.success && result.scan) {
        setCurrentScan(result.scan);
        setGithubUrl('');
        addNotification(`🚀 Scan démarré pour ${result.scan.repository}`, 'success');
        
        // Démarrer le polling du statut
        startPolling(result.scan.scanId || result.scan.id);
      } else {
        throw new Error(result.error || 'Réponse invalide du serveur');
      }
    } catch (err) {
      const errorMsg = err.message || 'Erreur lors du démarrage du scan';
      setError(errorMsg);
      addNotification(errorMsg, 'error');
      console.error('❌ Erreur scan:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ POLLING DU STATUT AVEC TIMEOUT
  const startPolling = useCallback(async (scanId) => {
    if (!scanId) return;
    
    const maxAttempts = 120; // 10 minutes avec 5s d'intervalle
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        console.log(`🔍 Polling statut scan ${scanId} (${attempts}/${maxAttempts})`);
        
        const statusResponse = await apiService.getScanStatus(scanId);
        
        if (statusResponse.success && statusResponse.scan) {
          const scan = statusResponse.scan;
          setCurrentScan(scan);
          
          if (scan.status === 'completed') {
            console.log('✅ Scan terminé:', scan);
            fetchScans(); // Actualiser la liste
            return; // Arrêter le polling
          } else if (scan.status === 'failed') {
            console.log('❌ Scan échoué:', scan);
            addNotification(`Scan échoué: ${scan.error_message || 'Erreur inconnue'}`, 'error');
            return; // Arrêter le polling
          } else if (scan.status === 'running' && attempts < maxAttempts) {
            // Continuer le polling
            setTimeout(poll, 5000);
          } else if (attempts >= maxAttempts) {
            addNotification('Timeout: le scan prend plus de temps que prévu', 'warning');
            return;
          }
        } else if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Retry sur erreur
        }
      } catch (error) {
        console.error('❌ Erreur polling:', error);
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Retry sur erreur
        } else {
          addNotification('Erreur de communication avec le serveur', 'error');
        }
      }
    };

    poll();
  }, [addNotification, fetchScans]);

  // ✅ SUPPRESSION DE SCAN AMÉLIORÉE
  const deleteScan = async (scanId) => {
    setDeletingScans(prev => new Set([...prev, scanId]));
    
    try {
      await apiService.deleteScan(scanId);
      
      // Mise à jour locale immédiate
      setScans(prev => prev.filter(scan => scan.id !== scanId));
      setSelectedScansForDeletion(prev => {
        const newSet = new Set(prev);
        newSet.delete(scanId);
        return newSet;
      });
      
      if (selectedScan && selectedScan.id === scanId) {
        setSelectedScan(null);
      }

      addNotification('✅ Scan supprimé avec succès', 'success');
    } catch (err) {
      console.error('❌ Erreur suppression:', err);
      addNotification(err.message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeletingScans(prev => {
        const newSet = new Set(prev);
        newSet.delete(scanId);
        return newSet;
      });
      setShowDeleteConfirm(null);
    }
  };

  // ✅ FILTRAGE AVANCÉ
  const filteredScans = useMemo(() => {
    return scans.filter(scan => {
      const matchesSearch = !searchTerm || 
        scan.repository?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scan.github_url?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || scan.status === filterStatus;
      return matchesSearch && matchesFilter;
    }).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [scans, searchTerm, filterStatus]);

  // ✅ RELANCE DE SCAN
  const rerunScan = async (scan) => {
    const repoUrl = scan.github_url || `https://github.com/${scan.repository}`;
    setGithubUrl(repoUrl);
    setScanDepth('standard');
    
    // Scroll vers le formulaire
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    addNotification(`📋 URL copiée: ${scan.repository}`, 'info');
  };

  // ✅ COMPOSANTS UI

  // Panel de notifications
  const NotificationPanel = () => (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 1000,
      display: showNotifications ? 'block' : 'none',
      maxWidth: '350px'
    }}>
      {notifications.map(notification => (
        <div
          key={notification.id}
          style={{
            backgroundColor: theme.cardBg,
            border: `2px solid ${
              notification.type === 'success' ? theme.success :
              notification.type === 'error' ? theme.danger :
              notification.type === 'warning' ? theme.warning :
              theme.info
            }`,
            color: theme.text,
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '0.75rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            animation: 'slideInRight 0.3s ease-out',
            position: 'relative'
          }}
        >
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: '500',
            marginBottom: '0.25rem'
          }}>
            {notification.type === 'success' && '✅ '}
            {notification.type === 'error' && '❌ '}
            {notification.type === 'warning' && '⚠️ '}
            {notification.type === 'info' && 'ℹ️ '}
            {notification.message}
          </div>
          <div style={{ 
            fontSize: '0.75rem', 
            color: theme.textMuted 
          }}>
            {notification.timestamp.toLocaleTimeString('fr-FR')}
          </div>
          
          <button
            onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'none',
              border: 'none',
              color: theme.textMuted,
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0.25rem'
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );

  // Composant statut scan
  const ScanStatus = ({ scan }) => {
    const getStatusConfig = (status) => {
      switch (status) {
        case 'pending': 
          return { color: theme.warning, icon: '⏳', label: 'En attente' };
        case 'running': 
          return { color: theme.primary, icon: '🔄', label: 'En cours' };
        case 'completed': 
          return { color: theme.success, icon: '✅', label: 'Terminé' };
        case 'failed': 
          return { color: theme.danger, icon: '❌', label: 'Échoué' };
        default: 
          return { color: theme.textMuted, icon: '❓', label: 'Inconnu' };
      }
    };

    const statusConfig = getStatusConfig(scan.status);
    const duration = scan.completed_at ? 
      Math.round((new Date(scan.completed_at) - new Date(scan.start_time)) / 1000) : 
      Math.round((Date.now() - new Date(scan.start_time)) / 1000);

    return (
      <div style={{
        backgroundColor: theme.cardBg,
        color: theme.text,
        padding: '2rem',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        marginBottom: '2rem',
        border: `2px solid ${statusConfig.color}20`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            fontSize: '2.5rem',
            animation: scan.status === 'running' ? 'spin 2s linear infinite' : 'none'
          }}>
            {statusConfig.icon}
          </div>
          
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: theme.text, fontSize: '1.5rem' }}>
              Scan {statusConfig.label}
            </h3>
            <p style={{ margin: '0 0 0.75rem 0', color: theme.text, fontSize: '1.1rem', fontWeight: '500' }}>
              📦 {scan.repository}
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              color: theme.textMuted,
              fontSize: '0.875rem'
            }}>
              <span>⏰ Démarré: {new Date(scan.start_time).toLocaleString('fr-FR')}</span>
              <span>⏱️ Durée: {duration}s</span>
              {scan.files_scanned && (
                <span>📁 Fichiers: {scan.files_scanned}</span>
              )}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <span style={{
            padding: '0.5rem 1rem',
            backgroundColor: statusConfig.color,
            color: 'white',
            borderRadius: '2rem',
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            letterSpacing: '0.05em'
          }}>
            {statusConfig.label}
          </span>
          
          {scan.status === 'running' && (
            <span style={{
              color: theme.textMuted,
              fontSize: '0.875rem',
              fontStyle: 'italic'
            }}>
              🔍 Analyse en cours...
            </span>
          )}
          
          {scan.error_message && (
            <span style={{
              color: theme.danger,
              fontSize: '0.875rem',
              backgroundColor: theme.danger + '20',
              padding: '0.25rem 0.75rem',
              borderRadius: '0.25rem'
            }}>
              ❌ {scan.error_message}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Composant résultats
  const ScanResults = ({ scan }) => {
    if (!scan.results) return null;

    let results;
    try {
      results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
    } catch (e) {
      console.error('Erreur parsing résultats:', e);
      return null;
    }

    const totalVulns = (results.critical || 0) + 
                      (results.high || 0) + 
                      (results.medium || 0) +
                      (results.low || 0);

    const vulnData = [
      { key: 'critical', label: 'Critiques', color: '#dc2626', count: results.critical || 0 },
      { key: 'high', label: 'Élevées', color: '#ea580c', count: results.high || 0 },
      { key: 'medium', label: 'Moyennes', color: '#d97706', count: results.medium || 0 },
      { key: 'low', label: 'Faibles', color: '#65a30d', count: results.low || 0 }
    ];

    return (
      <div style={{
        backgroundColor: theme.cardBg,
        color: theme.text,
        padding: '2rem',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: `2px solid ${totalVulns > 0 ? theme.danger : theme.success}40`,
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: theme.text, fontSize: '1.5rem' }}>
              📊 Résultats du scan
            </h3>
            <p style={{ margin: 0, color: theme.textMuted }}>
              Analyse complète de {scan.repository}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{
              textAlign: 'center',
              padding: '1rem',
              backgroundColor: totalVulns > 0 ? theme.danger + '20' : theme.success + '20',
              borderRadius: '0.75rem',
              border: `2px solid ${totalVulns > 0 ? theme.danger : theme.success}40`
            }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: totalVulns > 0 ? theme.danger : theme.success,
                margin: '0 0 0.25rem 0'
              }}>
                {totalVulns}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: theme.textMuted,
                fontWeight: '500'
              }}>
                Vulnérabilité{totalVulns !== 1 ? 's' : ''}
              </div>
            </div>
            
            <button
              onClick={() => setSelectedScan(scan)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: theme.primary,
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🔍 Voir détails
            </button>
          </div>
        </div>

        {/* Grille des vulnérabilités */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {vulnData.map(({ key, label, color, count }) => (
            <div 
              key={key}
              style={{
                backgroundColor: count > 0 ? `${color}20` : (darkMode ? '#374151' : '#f9fafb'),
                padding: '1.5rem',
                borderRadius: '0.75rem',
                textAlign: 'center',
                border: `2px solid ${color}30`,
                transition: 'all 0.2s',
                cursor: count > 0 ? 'pointer' : 'default'
              }}
              onClick={() => count > 0 && setSelectedScan(scan)}
            >
              <div style={{ 
                fontSize: '2rem', 
                fontWeight: 'bold', 
                color: color,
                marginBottom: '0.5rem'
              }}>
                {count}
              </div>
              <div style={{ 
                fontSize: '0.875rem', 
                color: theme.textMuted,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Graphique en barres */}
        {totalVulns > 0 && (
          <div>
            <h4 style={{ 
              margin: '0 0 1rem 0', 
              color: theme.text, 
              fontSize: '1.1rem',
              fontWeight: '600'
            }}>
              📈 Répartition des vulnérabilités
            </h4>
            <div style={{ 
              display: 'flex', 
              height: '12px', 
              backgroundColor: darkMode ? '#374151' : '#f3f4f6', 
              borderRadius: '0.5rem', 
              overflow: 'hidden',
              border: `1px solid ${theme.border}`
            }}>
              {vulnData.map(({ key, color, count }) => {
                const percentage = totalVulns > 0 ? (count / totalVulns) * 100 : 0;
                return percentage > 0 ? (
                  <div
                    key={key}
                    style={{
                      backgroundColor: color,
                      width: `${percentage}%`,
                      height: '100%',
                      transition: 'all 0.3s ease'
                    }}
                    title={`${key}: ${count} (${percentage.toFixed(1)}%)`}
                  />
                ) : null;
              })}
            </div>
            
            {/* Légende */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem',
              marginTop: '1rem',
              flexWrap: 'wrap'
            }}>
              {vulnData.filter(({ count }) => count > 0).map(({ key, label, color, count }) => (
                <div key={key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: theme.text
                }}>
                  <div style={{
                    width: '0.75rem',
                    height: '0.75rem',
                    backgroundColor: color,
                    borderRadius: '50%'
                  }} />
                  <span>{label}: {count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Informations supplémentaires */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '2rem',
          borderTop: `1px solid ${theme.border}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          fontSize: '0.875rem',
          color: theme.textMuted
        }}>
          <div>
            <strong>📁 Fichiers analysés:</strong> {results.files_scanned || 'N/A'}
          </div>
          <div>
            <strong>⏱️ Durée du scan:</strong> {scan.completed_at ? 
              Math.round((new Date(scan.completed_at) - new Date(scan.start_time)) / 1000) + 's' : 
              'En cours'
            }
          </div>
          <div>
            <strong>📅 Date:</strong> {new Date(scan.start_time).toLocaleString('fr-FR')}
          </div>
          <div>
            <strong>🔍 Profondeur:</strong> {scan.scan_depth || 'Standard'}
          </div>
        </div>
      </div>
    );
  };

  // Composant historique des scans
  const ScanHistory = () => (
    <div style={{
      backgroundColor: theme.cardBg,
      color: theme.text,
      padding: '2rem',
      borderRadius: '0.75rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      marginBottom: '2rem'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <h3 style={{ margin: 0, fontSize: '1.5rem' }}>📋 Historique des scans</h3>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filtres */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '0.5rem',
              color: theme.text,
              fontSize: '0.875rem'
            }}
          >
            <option value="all">Tous les statuts</option>
            <option value="completed">✅ Terminés</option>
            <option value="running">🔄 En cours</option>
            <option value="failed">❌ Échoués</option>
            <option value="pending">⏳ En attente</option>
          </select>

          {/* Barre de recherche */}
          <input
            type="text"
            placeholder="🔍 Rechercher un dépôt..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '0.5rem',
              color: theme.text,
              fontSize: '0.875rem',
              minWidth: '200px'
            }}
          />
        </div>
      </div>

      {/* Liste des scans */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredScans.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: theme.textMuted,
            padding: '3rem',
            fontSize: '1.1rem'
          }}>
            {searchTerm || filterStatus !== 'all' ? 
              '🔍 Aucun scan ne correspond à vos critères' : 
              '📝 Aucun scan enregistré pour le moment'
            }
          </div>
        ) : (
          filteredScans.map(scan => (
            <div
              key={scan.id}
              style={{
                backgroundColor: darkMode ? '#2a2a4a' : '#f8f9fa',
                border: `1px solid ${theme.border}`,
                borderRadius: '0.5rem',
                padding: '1.5rem',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedScan(scan)}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <h4 style={{ 
                    margin: '0 0 0.5rem 0', 
                    fontSize: '1.1rem',
                    color: theme.text 
                  }}>
                    📦 {scan.repository}
                  </h4>
                  
                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                    fontSize: '0.875rem',
                    color: theme.textMuted
                  }}>
                    <span>📅 {new Date(scan.start_time).toLocaleString('fr-FR')}</span>
                    {scan.completed_at && (
                      <span>⏱️ {Math.round((new Date(scan.completed_at) - new Date(scan.start_time)) / 1000)}s</span>
                    )}
                    {scan.files_scanned && (
                      <span>📁 {scan.files_scanned} fichiers</span>
                    )}
                  </div>

                  {/* Résultats rapides */}
                  {scan.results && (() => {
                    try {
                      const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                      const totalVulns = (results.critical || 0) + (results.high || 0) + (results.medium || 0) + (results.low || 0);
                      
                      return (
                        <div style={{
                          display: 'flex',
                          gap: '0.5rem',
                          alignItems: 'center',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ fontSize: '0.875rem', color: theme.textMuted }}>
                            🔍 {totalVulns} vulnérabilité{totalVulns !== 1 ? 's' : ''}:
                          </span>
                          {results.critical > 0 && (
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              {results.critical} critique{results.critical > 1 ? 's' : ''}
                            </span>
                          )}
                          {results.high > 0 && (
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#ea580c',
                              color: 'white',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              {results.high} élevée{results.high > 1 ? 's' : ''}
                            </span>
                          )}
                          {results.medium > 0 && (
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#d97706',
                              color: 'white',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              {results.medium} moyenne{results.medium > 1 ? 's' : ''}
                            </span>
                          )}
                          {results.low > 0 && (
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#65a30d',
                              color: 'white',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: 'bold'
                            }}>
                              {results.low} faible{results.low > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  {/* Statut */}
                  <span style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: (() => {
                      switch (scan.status) {
                        case 'completed': return theme.success;
                        case 'running': return theme.primary;
                        case 'failed': return theme.danger;
                        case 'pending': return theme.warning;
                        default: return theme.textMuted;
                      }
                    })(),
                    color: 'white',
                    borderRadius: '2rem',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {(() => {
                      switch (scan.status) {
                        case 'completed': return '✅ Terminé';
                        case 'running': return '🔄 En cours';
                        case 'failed': return '❌ Échoué';
                        case 'pending': return '⏳ En attente';
                        default: return '❓ Inconnu';
                      }
                    })()}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rerunScan(scan);
                      }}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.primary}`,
                        color: theme.primary,
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      title="Relancer le scan"
                    >
                      🔄
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(scan.id);
                      }}
                      disabled={deletingScans.has(scan.id)}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.danger}`,
                        color: theme.danger,
                        borderRadius: '0.25rem',
                        cursor: deletingScans.has(scan.id) ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem',
                        opacity: deletingScans.has(scan.id) ? 0.5 : 1
                      }}
                      title="Supprimer le scan"
                    >
                      {deletingScans.has(scan.id) ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Modal de détails du scan
  const ScanDetailsModal = ({ scan, onClose }) => {
    if (!scan) return null;

    let results = null;
    try {
      results = scan.results ? (typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results) : null;
    } catch (e) {
      console.error('Erreur parsing résultats:', e);
    }

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        backdropFilter: 'blur(4px)',
        padding: '1rem'
      }}>
        <div style={{
          backgroundColor: theme.cardBg,
          color: theme.text,
          padding: '2rem',
          borderRadius: '0.75rem',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: `1px solid ${theme.border}`
        }}>
          {/* En-tête */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '2rem',
            paddingBottom: '1rem',
            borderBottom: `1px solid ${theme.border}`
          }}>
            <div>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
                📦 {scan.repository}
              </h2>
              <p style={{ margin: 0, color: theme.textMuted }}>
                Détails du scan #{scan.id}
              </p>
            </div>
            
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: theme.textMuted,
                cursor: 'pointer',
                fontSize: '1.5rem',
                padding: '0.5rem'
              }}
            >
              ✕
            </button>
          </div>

          {/* Informations générales */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
            padding: '1.5rem',
            backgroundColor: darkMode ? '#2a2a4a' : '#f8f9fa',
            borderRadius: '0.5rem'
          }}>
            <div>
              <strong>📅 Date de début:</strong><br />
              {new Date(scan.start_time).toLocaleString('fr-FR')}
            </div>
            <div>
              <strong>📅 Date de fin:</strong><br />
              {scan.completed_at ? new Date(scan.completed_at).toLocaleString('fr-FR') : 'En cours'}
            </div>
            <div>
              <strong>⏱️ Durée:</strong><br />
              {scan.completed_at ? 
                Math.round((new Date(scan.completed_at) - new Date(scan.start_time)) / 1000) + 's' : 
                Math.round((Date.now() - new Date(scan.start_time)) / 1000) + 's'
              }
            </div>
            <div>
              <strong>🔍 Profondeur:</strong><br />
              {scan.scan_depth || 'Standard'}
            </div>
            <div>
              <strong>📁 Fichiers analysés:</strong><br />
              {scan.files_scanned || 'N/A'}
            </div>
            <div>
              <strong>📊 Statut:</strong><br />
              <span style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: (() => {
                  switch (scan.status) {
                    case 'completed': return theme.success;
                    case 'running': return theme.primary;
                    case 'failed': return theme.danger;
                    case 'pending': return theme.warning;
                    default: return theme.textMuted;
                  }
                })(),
                color: 'white',
                borderRadius: '1rem',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                {(() => {
                  switch (scan.status) {
                    case 'completed': return '✅ Terminé';
                    case 'running': return '🔄 En cours';
                    case 'failed': return '❌ Échoué';
                    case 'pending': return '⏳ En attente';
                    default: return '❓ Inconnu';
                  }
                })()}
              </span>
            </div>
          </div>

          {/* Résultats détaillés */}
          {results && (
            <div>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
                🛡️ Résultats de sécurité
              </h3>
              
              {/* Grille des vulnérabilités */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                {[
                  { key: 'critical', label: 'Critiques', color: '#dc2626', count: results.critical || 0 },
                  { key: 'high', label: 'Élevées', color: '#ea580c', count: results.high || 0 },
                  { key: 'medium', label: 'Moyennes', color: '#d97706', count: results.medium || 0 },
                  { key: 'low', label: 'Faibles', color: '#65a30d', count: results.low || 0 }
                ].map(({ key, label, color, count }) => (
                  <div 
                    key={key}
                    style={{
                      backgroundColor: count > 0 ? `${color}20` : (darkMode ? '#374151' : '#f9fafb'),
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      textAlign: 'center',
                      border: `2px solid ${color}30`
                    }}
                  >
                    <div style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 'bold', 
                      color: color,
                      marginBottom: '0.25rem'
                    }}>
                      {count}
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: theme.textMuted,
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Détails supplémentaires */}
              {results.details && (
                <div>
                  <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
                    📋 Détails des vulnérabilités
                  </h4>
                  <div style={{
                    backgroundColor: darkMode ? '#2a2a4a' : '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    maxHeight: '300px',
                    overflow: 'auto',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    color: theme.text
                  }}>
                    {typeof results.details === 'string' ? results.details : JSON.stringify(results.details, null, 2)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Message d'erreur */}
          {scan.error_message && (
            <div style={{
              backgroundColor: theme.danger + '20',
              border: `1px solid ${theme.danger}`,
              borderRadius: '0.5rem',
              padding: '1rem',
              marginTop: '1rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: theme.danger }}>
                ❌ Erreur
              </h4>
              <p style={{ margin: 0, color: theme.text }}>
                {scan.error_message}
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '2rem',
            paddingTop: '1rem',
            borderTop: `1px solid ${theme.border}`,
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={() => rerunScan(scan)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: theme.primary,
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              🔄 Relancer
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Modal de confirmation de suppression
  const DeleteConfirmModal = ({ scanId, onConfirm, onCancel }) => {
    const scan = scans.find(s => s.id === scanId);
    if (!scan) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        backdropFilter: 'blur(4px)'
      }}>
        <div style={{
          backgroundColor: theme.cardBg,
          color: theme.text,
          padding: '2rem',
          borderRadius: '0.75rem',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: `1px solid ${theme.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '2rem', marginRight: '0.75rem' }}>🗑️</span>
            <h3 style={{ margin: 0, color: theme.text }}>
              Confirmer la suppression
            </h3>
          </div>
          
          <p style={{ margin: '0 0 2rem 0', color: theme.textMuted, lineHeight: 1.5 }}>
            Êtes-vous sûr de vouloir supprimer le scan de <strong>{scan.repository}</strong> ? 
            Cette action est irréversible.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: theme.danger,
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ✅ RENDU PRINCIPAL
  return (
    <div style={{
      backgroundColor: theme.bg,
      color: theme.text,
      minHeight: '100vh',
      transition: 'all 0.3s ease'
    }}>
      {/* En-tête */}
      <header style={{
        backgroundColor: theme.cardBg,
        borderBottom: `1px solid ${theme.border}`,
        padding: '1rem 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 'bold' }}>
              🛡️ Security Scanner
            </h1>
            <span style={{
              padding: '0.25rem 0.75rem',
              backgroundColor: theme.primary + '20',
              color: theme.primary,
              borderRadius: '1rem',
              fontSize: '0.75rem',
              fontWeight: 'bold'
            }}>
              v1.0
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Statut WebSocket */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: ws && ws.readyState === WebSocket.OPEN ? theme.success + '20' : theme.warning + '20',
              borderRadius: '2rem',
              fontSize: '0.875rem'
            }}>
              <span style={{
                width: '0.5rem',
                height: '0.5rem',
                backgroundColor: ws && ws.readyState === WebSocket.OPEN ? theme.success : theme.warning,
                borderRadius: '50%',
                animation: wsReconnecting ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }} />
              {ws && ws.readyState === WebSocket.OPEN ? '🟢 Connecté' : '🟡 Reconnexion...'}
            </div>

            {/* Notifications */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                position: 'relative',
                padding: '0.75rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                borderRadius: '0.5rem',
                color: theme.text,
                cursor: 'pointer',
                fontSize: '1.25rem'
              }}
            >
              🔔
              {notifications.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-0.25rem',
                  right: '-0.25rem',
                  backgroundColor: theme.danger,
                  color: 'white',
                  borderRadius: '50%',
                  width: '1.25rem',
                  height: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}>
                  {notifications.length}
                </span>
              )}
            </button>

            {/* Toggle thème */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                padding: '0.75rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                borderRadius: '0.5rem',
                color: theme.text,
                cursor: 'pointer',
                fontSize: '1.25rem'
              }}
            >
              {darkMode ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem'
      }}>
        {/* Formulaire de scan */}
        <div style={{
          backgroundColor: theme.cardBg,
          color: theme.text,
          padding: '2rem',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          marginBottom: '2rem',
          border: `2px solid ${theme.primary}20`
        }}>
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem' }}>
            🚀 Nouveau scan de sécurité
          </h2>
          
          <form onSubmit={handleScan} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '300px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: theme.text
                }}>
                  URL du dépôt GitHub
                </label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    backgroundColor: theme.cardBg,
                    border: `2px solid ${error ? theme.danger : theme.border}`,
                    borderRadius: '0.5rem',
                    color: theme.text,
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = theme.primary}
                  onBlur={(e) => e.target.style.borderColor = error ? theme.danger : theme.border}
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: theme.text
                }}>
                  Profondeur
                </label>
                <select
                  value={scanDepth}
                  onChange={(e) => setScanDepth(e.target.value)}
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: theme.cardBg,
                    border: `2px solid ${theme.border}`,
                    borderRadius: '0.5rem',
                    color: theme.text,
                    fontSize: '1rem',
                    outline: 'none',
                    minWidth: '120px'
                  }}
                >
                  <option value="standard">Standard</option>
                  <option value="deep">Approfondi</option>
                  <option value="quick">Rapide</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading || !githubUrl.trim()}
                style={{
                  padding: '0.75rem 2rem',
                  backgroundColor: loading || !githubUrl.trim() ? theme.textMuted : theme.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: loading || !githubUrl.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  minWidth: '140px',
                  justifyContent: 'center'
                }}
              >
                {loading ? (
                  <>
                    <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                    Analyse...
                  </>
                ) : (
                  <>
                    🚀 Scanner
                  </>
                )}
              </button>
            </div>

            {error && (
              <div style={{
                padding: '1rem',
                backgroundColor: theme.danger + '20',
                border: `1px solid ${theme.danger}`,
                borderRadius: '0.5rem',
                color: theme.danger,
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                ❌ {error}
              </div>
            )}
          </form>
        </div>

        {/* Scan en cours */}
        {currentScan && (
          <ScanStatus scan={currentScan} />
        )}

        {/* Résultats du scan actuel */}
        {currentScan && currentScan.status === 'completed' && (
          <ScanResults scan={currentScan} />
        )}

        {/* Historique des scans */}
        <ScanHistory />
      </main>

      {/* Panel de notifications */}
      <NotificationPanel />

      {/* Modal de détails du scan */}
      {selectedScan && (
        <ScanDetailsModal
          scan={selectedScan}
          onClose={() => setSelectedScan(null)}
        />
      )}

      {/* Modal de confirmation de suppression */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          scanId={showDeleteConfirm}
          onConfirm={() => deleteScan(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}

      {/* Styles CSS globaux pour les animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes scan-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        /* Scrollbar personnalisée */
        * {
          scrollbar-width: thin;
          scrollbar-color: ${theme.primary} ${theme.cardBg};
        }
        
        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        *::-webkit-scrollbar-track {
          background: ${theme.cardBg};
          border-radius: 4px;
        }
        
        *::-webkit-scrollbar-thumb {
          background: ${theme.primary};
          border-radius: 4px;
        }
        
        *::-webkit-scrollbar-thumb:hover {
          background: ${theme.primary}dd;
        }
        
        /* Transitions globales */
        * {
          transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .main-container {
            padding: 1rem;
          }
          
          .scan-form {
            flex-direction: column;
          }
          
          .scan-form > * {
            min-width: auto !important;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default App;