import React, { useState, useEffect, useCallback, useMemo } from 'react';

function App() {
  const [githubUrl, setGithubUrl] = useState('');
  const [scans, setScans] = useState([]);
  const [currentScan, setCurrentScan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ws, setWs] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedScan, setSelectedScan] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [wsReconnecting, setWsReconnecting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Thème
  const theme = useMemo(() => ({
    bg: darkMode ? '#1a1a1a' : '#f8f9fa',
    cardBg: darkMode ? '#2d2d2d' : 'white',
    text: darkMode ? '#ffffff' : '#2c3e50',
    textMuted: darkMode ? '#a0a0a0' : '#6c757d',
    border: darkMode ? '#404040' : '#e1e8ed',
    primary: '#3498db',
    success: '#27ae60',
    warning: '#f39c12',
    danger: '#e74c3c'
  }), [darkMode]);

  // Connexion WebSocket avec reconnexion automatique
  const connectWebSocket = useCallback(() => {
    const websocket = new WebSocket('ws://localhost:3001');
    
    websocket.onopen = () => {
      console.log('WebSocket connecté');
      setWs(websocket);
      setWsReconnecting(false);
      addNotification('Connexion temps réel établie', 'success');
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'scan_update') {
        setCurrentScan(data.scan);
        if (data.scan.status === 'completed') {
          addNotification(`Scan terminé pour ${data.scan.repository}`, 'success');
          fetchScans();
          // Notification navigateur
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Scan terminé', {
              body: `Le scan de ${data.scan.repository} est terminé`,
              icon: '🛡️'
            });
          }
        } else if (data.scan.status === 'failed') {
          addNotification(`Scan échoué pour ${data.scan.repository}`, 'error');
        }
      }
    };

    websocket.onclose = () => {
      console.log('WebSocket déconnecté');
      setWs(null);
      // Reconnexion automatique après 3 secondes
      if (!wsReconnecting) {
        setWsReconnecting(true);
        setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };

    websocket.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
    };

    return websocket;
  }, [wsReconnecting]);

  useEffect(() => {
    const websocket = connectWebSocket();
    
    // Demander permission pour les notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [connectWebSocket]);

  // Système de notifications
  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    const notification = { id, message, type, timestamp: new Date() };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    // Auto-suppression après 5 secondes
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Récupérer l'historique des scans avec retry
  const fetchScans = async (retries = 3) => {
    try {
      const response = await fetch('http://localhost:3001/api/scans');
      if (!response.ok) throw new Error('Erreur réseau');
      const data = await response.json();
      setScans(data);
    } catch (err) {
      console.error('Erreur lors de la récupération des scans:', err);
      if (retries > 0) {
        setTimeout(() => fetchScans(retries - 1), 2000);
      } else {
        addNotification('Impossible de charger l\'historique', 'error');
      }
    }
  };

  useEffect(() => {
    fetchScans();
  }, []);

  // Validation URL GitHub améliorée
  const isValidGitHubUrl = (url) => {
    const githubRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/;
    return githubRegex.test(url);
  };

  // Déclencher un nouveau scan avec gestion d'erreurs améliorée
  const handleScan = async (e) => {
    e.preventDefault();
    
    if (!isValidGitHubUrl(githubUrl)) {
      setError('Veuillez entrer une URL GitHub valide (ex: https://github.com/user/repo)');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/scan/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ githubUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erreur lors du déclenchement du scan');
      }

      const result = await response.json();
      setCurrentScan(result.scan);
      setGithubUrl('');
      addNotification(`Scan démarré pour ${result.scan.repository}`, 'info');
    } catch (err) {
      setError(err.message);
      addNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtrage des scans
  const filteredScans = useMemo(() => {
    return scans.filter(scan => {
      const matchesSearch = scan.repository?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || scan.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [scans, searchTerm, filterStatus]);

  // Relancer un scan
  const rerunScan = async (scanId) => {
    const scan = scans.find(s => s.id === scanId);
    if (scan) {
      setGithubUrl(scan.githubUrl || `https://github.com/${scan.repository}`);
    }
  };

  // Export des données
  const exportScans = () => {
    const dataStr = JSON.stringify(filteredScans, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `security-scans-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Composant Notification
  const NotificationPanel = () => (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 1000,
      display: showNotifications ? 'block' : 'none'
    }}>
      {notifications.map(notification => (
        <div
          key={notification.id}
          style={{
            backgroundColor: theme.cardBg,
            border: `2px solid ${
              notification.type === 'success' ? theme.success :
              notification.type === 'error' ? theme.danger :
              theme.primary
            }`,
            color: theme.text,
            padding: '0.75rem',
            borderRadius: '0.5rem',
            marginBottom: '0.5rem',
            maxWidth: '300px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div style={{ fontSize: '0.875rem' }}>
            {notification.message}
          </div>
          <div style={{ fontSize: '0.75rem', color: theme.textMuted, marginTop: '0.25rem' }}>
            {notification.timestamp.toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );

  // Composant pour afficher le statut du scan
  const ScanStatus = ({ scan }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'pending': return theme.warning;
        case 'running': return theme.primary;
        case 'completed': return theme.success;
        case 'failed': return theme.danger;
        default: return theme.textMuted;
      }
    };

    const getStatusIcon = (status) => {
      switch (status) {
        case 'pending': return '⏳';
        case 'running': return '🔄';
        case 'completed': return '✅';
        case 'failed': return '❌';
        default: return '❓';
      }
    };

    const duration = scan.completedAt ? 
      Math.round((new Date(scan.completedAt) - new Date(scan.startTime)) / 1000) : 
      Math.round((Date.now() - new Date(scan.startTime)) / 1000);

    return (
      <div style={{
        backgroundColor: theme.cardBg,
        color: theme.text,
        padding: '1.5rem',
        borderRadius: '0.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '2rem',
        border: `1px solid ${theme.border}`
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>
            {getStatusIcon(scan.status)}
          </span>
          <div>
            <h3 style={{ margin: 0, color: theme.text }}>
              Scan en cours
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', color: theme.textMuted, fontSize: '0.875rem' }}>
              {scan.repository}
            </p>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: getStatusColor(scan.status),
            color: 'white',
            borderRadius: '1rem',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            fontWeight: 'bold'
          }}>
            {scan.status}
          </span>
          <span style={{ color: theme.textMuted, fontSize: '0.875rem' }}>
            Démarré: {new Date(scan.startTime).toLocaleString('fr-FR')}
          </span>
          <span style={{ color: theme.textMuted, fontSize: '0.875rem' }}>
            Durée: {duration}s
          </span>
        </div>

        {scan.status === 'running' && (
          <div style={{
            marginTop: '1rem',
            backgroundColor: darkMode ? '#404040' : '#f8f9fa',
            height: '0.5rem',
            borderRadius: '0.25rem',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              backgroundColor: theme.primary,
              width: '60%',
              borderRadius: '0.25rem',
              animation: 'pulse 2s infinite'
            }} />
          </div>
        )}
      </div>
    );
  };

  // Composant pour afficher les résultats détaillés
  const ScanResults = ({ scan }) => {
    if (!scan.results) return null;

    const totalVulns = (scan.results.critical || 0) + 
                      (scan.results.high || 0) + 
                      (scan.results.medium || 0) +
                      (scan.results.low || 0);

    const vulnData = [
      { key: 'critical', label: 'Critiques', color: theme.danger, count: scan.results.critical || 0 },
      { key: 'high', label: 'Élevées', color: theme.warning, count: scan.results.high || 0 },
      { key: 'medium', label: 'Moyennes', color: '#f1c40f', count: scan.results.medium || 0 },
      { key: 'low', label: 'Faibles', color: '#95a5a6', count: scan.results.low || 0 }
    ];

    return (
      <div style={{
        backgroundColor: theme.cardBg,
        color: theme.text,
        padding: '1.5rem',
        borderRadius: '0.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: `2px solid ${totalVulns > 0 ? theme.danger : theme.success}`
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h3 style={{ margin: 0, color: theme.text }}>
            📊 Résultats du scan
          </h3>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: totalVulns > 0 ? theme.danger : theme.success
            }}>
              {totalVulns} vuln{totalVulns !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setSelectedScan(scan)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.primary}`,
                color: theme.primary,
                borderRadius: '0.25rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Voir détails
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '1rem'
        }}>
          {vulnData.map(({ key, label, color, count }) => (
            <div 
              key={key}
              style={{
                backgroundColor: count > 0 ? `${color}20` : (darkMode ? '#404040' : '#f8f9fa'),
                padding: '1rem',
                borderRadius: '0.375rem',
                textAlign: 'center',
                border: `1px solid ${color}30`
              }}
            >
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                color: color 
              }}>
                {count}
              </div>
              <div style={{ 
                fontSize: '0.75rem', 
                color: theme.textMuted,
                textTransform: 'uppercase'
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Graphique simple en barres */}
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: theme.text, fontSize: '1rem' }}>
            Répartition des vulnérabilités
          </h4>
          <div style={{ display: 'flex', gap: '0.25rem', height: '20px', backgroundColor: darkMode ? '#404040' : '#f8f9fa', borderRadius: '10px', overflow: 'hidden' }}>
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
        </div>
      </div>
    );
  };

  // Modal de détails
  const ScanDetailsModal = ({ scan, onClose }) => {
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
        zIndex: 1000,
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: theme.cardBg,
          color: theme.text,
          borderRadius: '0.5rem',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ margin: 0 }}>Détails du scan - {scan.repository}</h2>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: theme.text
              }}
            >
              ✕
            </button>
          </div>
          
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div>
              <strong>Repository:</strong><br />
              {scan.repository}
            </div>
            <div>
              <strong>Status:</strong><br />
              {scan.status}
            </div>
            <div>
              <strong>Démarré:</strong><br />
              {new Date(scan.startTime).toLocaleString()}
            </div>
            {scan.completedAt && (
              <div>
                <strong>Terminé:</strong><br />
                {new Date(scan.completedAt).toLocaleString()}
              </div>
            )}
          </div>

          {scan.results && (
            <div style={{ marginTop: '2rem' }}>
              <h3>Résultats détaillés</h3>
              <pre style={{
                backgroundColor: darkMode ? '#404040' : '#f8f9fa',
                padding: '1rem',
                borderRadius: '0.25rem',
                overflow: 'auto',
                fontSize: '0.875rem'
              }}>
                {JSON.stringify(scan.results, null, 2)}
              </pre>
            </div>
          )}

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => rerunScan(scan.id)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: theme.primary,
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer'
              }}
            >
              Relancer le scan
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      padding: '2rem',
      fontFamily: 'sans-serif',
      backgroundColor: theme.bg,
      color: theme.text,
      minHeight: '100vh',
      transition: 'all 0.3s ease'
    }}>
      <NotificationPanel />
      
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header avec contrôles */}
        <header style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '3rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              color: theme.text,
              fontSize: '2.5rem',
              margin: '0 0 0.5rem 0'
            }}>
              🛡️ Security Scanner Platform
            </h1>
            <p style={{
              color: theme.textMuted,
              fontSize: '1.1rem',
              margin: 0
            }}>
              Analysez la sécurité de n'importe quel repository GitHub
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: '0.25rem',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              🔔 {notifications.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: theme.danger,
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {notifications.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                color: theme.text,
                borderRadius: '0.25rem',
                cursor: 'pointer'
              }}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Status de connexion */}
        {wsReconnecting && (
          <div style={{
            backgroundColor: theme.warning + '20',
            border: `1px solid ${theme.warning}`,
            color: theme.warning,
            padding: '0.75rem',
            borderRadius: '0.375rem',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            🔄 Reconnexion en cours...
          </div>
        )}

        {/* Formulaire de scan */}
        <div style={{
          backgroundColor: theme.cardBg,
          padding: '2rem',
          borderRadius: '0.5rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '2rem',
          border: `1px solid ${theme.border}`
        }}>
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 'bold',
                color: theme.text
              }}>
                URL du repository GitHub
              </label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `2px solid ${theme.border}`,
                  borderRadius: '0.375rem',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  backgroundColor: theme.cardBg,
                  color: theme.text
                }}
                onFocus={(e) => e.target.style.borderColor = theme.primary}
                onBlur={(e) => e.target.style.borderColor = theme.border}
                disabled={loading}
              />
            </div>
            
            {error && (
              <div style={{
                backgroundColor: theme.danger + '20',
                color: theme.danger,
                padding: '0.75rem',
                borderRadius: '0.375rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                border: `1px solid ${theme.danger}`
              }}>
                {error}
              </div>
            )}
            
            <button
              onClick={handleScan}
              disabled={loading || !githubUrl.trim()}
              style={{
                backgroundColor: loading ? theme.textMuted : theme.primary,
                color: 'white',
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <>
                  <span>🔄</span>
                  Démarrage du scan...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Lancer le scan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scan en cours */}
        {currentScan && (
          <>
            <ScanStatus scan={currentScan} />
            {currentScan.status === 'completed' && currentScan.results && (
              <ScanResults scan={currentScan} />
            )}
          </>
        )}

        {/* Contrôles de l'historique */}
        {scans.length > 0 && (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <h2 style={{ color: theme.text, margin: 0 }}>
                📋 Historique des scans ({filteredScans.length})
              </h2>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '0.25rem',
                    backgroundColor: theme.cardBg,
                    color: theme.text,
                    width: '200px'
                  }}
                />
                
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '0.25rem',
                    backgroundColor: theme.cardBg,
                    color: theme.text
                  }}
                >
                  <option value="all">Tous les statuts</option>
                  <option value="completed">Terminés</option>
                  <option value="failed">Échoués</option>
                  <option value="running">En cours</option>
                </select>
                
                <button
                  onClick={exportScans}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: theme.success,
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  📥 Exporter
                </button>
              </div>
            </div>

            {/* Liste des scans */}
            <div style={{ display: 'grid', gap: '1rem' }}>
              {filteredScans.slice(0, 20).map((scan, index) => {
                const totalVulns = scan.results ? 
                  (scan.results.critical || 0) + (scan.results.high || 0) + (scan.results.medium || 0) + (scan.results.low || 0) : 0;
                
                return (
                  <div
                    key={scan.id || index}
                    style={{
                      backgroundColor: theme.cardBg,
                      padding: '1rem',
                      borderRadius: '0.375rem',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: `1px solid ${theme.border}`,
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedScan(scan)}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', color: theme.text }}>
                        {scan.repository}
                      </h4>
                      <p style={{ margin: 0, color: theme.textMuted, fontSize: '0.875rem' }}>
                        {new Date(scan.completedAt || scan.startTime).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem'
                    }}>
                      {scan.results && (
                        <div style={{ 
                          fontSize: '0.875rem', 
                          color: totalVulns > 0 ? theme.danger : theme.success,
                          fontWeight: 'bold'
                        }}>
                          {totalVulns} vulns
                        </div>
                      )}
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: scan.status === 'completed' ? theme.success : 
                                       scan.status === 'failed' ? theme.danger :
                                       scan.status === 'running' ? theme.primary : theme.textMuted,
                        color: 'white',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem'
                      }}>
                        {scan.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rerunScan(scan.id);
                        }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: 'transparent',
                          border: `1px solid ${theme.primary}`,
                          color: theme.primary,
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        ↻
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal de détails */}
      {selectedScan && (
        <ScanDetailsModal 
          scan={selectedScan} 
          onClose={() => setSelectedScan(null)} 
        />
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}

export default App;