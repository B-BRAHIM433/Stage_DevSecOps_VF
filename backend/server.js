const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { Octokit } = require('@octokit/rest');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN manquant dans .env');
  process.exit(1);
}

// GitHub API
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Base de données SQLite
const db = new sqlite3.Database('./scanner.db', (err) => {
  if (err) {
    console.error('❌ Erreur base de données:', err);
    process.exit(1);
  }
  console.log('✅ Base de données connectée');
});

// Créer tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      github_url TEXT NOT NULL,
      repository TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      results TEXT,
      error_message TEXT
    )
  `);
});

// WebSocket
let wsServer;
const clients = new Set();

// Fonctions utilitaires
const broadcastToClients = (data) => {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch (error) {
        clients.delete(client);
      }
    }
  });
};

const updateScanStatus = (scanId, status, additionalData = {}) => {
  return new Promise((resolve, reject) => {
    let query = 'UPDATE scans SET status = ?';
    let params = [status];
    
    if (status === 'completed' || status === 'failed') {
      query += ', completed_at = CURRENT_TIMESTAMP';
    }
    
    if (additionalData.results) {
      query += ', results = ?';
      params.push(JSON.stringify(additionalData.results));
    }
    
    if (additionalData.errorMessage) {
      query += ', error_message = ?';
      params.push(additionalData.errorMessage);
    }
    
    query += ' WHERE id = ?';
    params.push(scanId);
    
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        // Récupérer le scan mis à jour
        db.get('SELECT * FROM scans WHERE id = ?', [scanId], (err, scan) => {
          if (!err && scan) {
            const scanData = {
              ...scan,
              results: scan.results ? JSON.parse(scan.results) : null
            };
            
            // Notifier via WebSocket
            broadcastToClients({
              type: 'scan_update',
              scan: scanData
            });
            
            resolve(scanData);
          } else {
            resolve({ id: scanId, status });
          }
        });
      }
    });
  });
};

const parseGitHubUrl = (url) => {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error('URL GitHub invalide');
  
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
    fullName: `${match[1]}/${match[2].replace(/\.git$/, '')}`
  };
};

// 🚀 ROUTES API

// Déclencher un scan
app.post('/api/scan/trigger', async (req, res) => {
  try {
    const { githubUrl } = req.body;
    
    if (!githubUrl) {
      return res.status(400).json({ error: 'URL GitHub requise' });
    }
    
    // Parser l'URL
    const repoInfo = parseGitHubUrl(githubUrl);
    const scanId = uuidv4();
    
    console.log(`🚀 Nouveau scan: ${repoInfo.fullName}`);
    
    // Vérifier que le repo existe
    try {
      await octokit.rest.repos.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo
      });
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ error: 'Repository non trouvé ou privé' });
      }
      throw error;
    }
    
    // Créer le scan en base
    db.run(
      'INSERT INTO scans (id, github_url, repository) VALUES (?, ?, ?)',
      [scanId, githubUrl, repoInfo.fullName],
      async function(err) {
        if (err) {
          console.error('❌ Erreur base:', err);
          return res.status(500).json({ error: 'Erreur base de données' });
        }
        
        try {
          // Déclencher GitHub Actions
          await octokit.rest.actions.createWorkflowDispatch({
            owner: process.env.GITHUB_ACTIONS_OWNER,
            repo: process.env.GITHUB_ACTIONS_REPO,
            workflow_id: 'security-scan.yml',
            ref: 'main',
            inputs: {
              target_repo: githubUrl,
              scan_id: scanId,
              callback_url: `${req.protocol}://${req.get('host')}/api/scan/results`
            }
          });
          
          // Marquer comme running
          await updateScanStatus(scanId, 'running');
          
          const scan = {
            id: scanId,
            githubUrl,
            repository: repoInfo.fullName,
            status: 'running',
            startTime: new Date().toISOString()
          };
          
          res.json({
            success: true,
            scan,
            message: 'Scan démarré avec succès'
          });
          
        } catch (workflowError) {
          console.error('❌ Erreur workflow:', workflowError);
          await updateScanStatus(scanId, 'failed', {
            errorMessage: workflowError.message
          });
          
          res.status(500).json({
            error: 'Erreur lors du déclenchement du scan',
            details: workflowError.message
          });
        }
      }
    );
    
  } catch (error) {
    console.error('❌ Erreur scan:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Recevoir résultats depuis GitHub Actions
app.post('/api/scan/results', async (req, res) => {
  try {
    const { scan_id, status, results, error_message } = req.body;
    
    if (!scan_id) {
      return res.status(400).json({ error: 'scan_id requis' });
    }
    
    console.log(`📥 Résultats reçus pour ${scan_id}: ${status}`);
    
    // Vérifier que le scan existe
    db.get('SELECT * FROM scans WHERE id = ?', [scan_id], async (err, scan) => {
      if (err) {
        console.error('❌ Erreur base:', err);
        return res.status(500).json({ error: 'Erreur base de données' });
      }
      
      if (!scan) {
        return res.status(404).json({ error: 'Scan non trouvé' });
      }
      
      try {
        await updateScanStatus(scan_id, status, {
          results: results,
          errorMessage: error_message
        });
        
        res.json({ success: true, message: 'Résultats enregistrés' });
        
      } catch (updateError) {
        console.error('❌ Erreur update:', updateError);
        res.status(500).json({ error: 'Erreur mise à jour' });
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur résultats:', error);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Lister les scans
app.get('/api/scans', (req, res) => {
  const { limit = 20, status, search } = req.query;
  
  let query = 'SELECT * FROM scans';
  let params = [];
  let conditions = [];
  
  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }
  
  if (search) {
    conditions.push('repository LIKE ?');
    params.push(`%${search}%`);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY start_time DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('❌ Erreur scans:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    
    const scans = rows.map(row => ({
      ...row,
      results: row.results ? JSON.parse(row.results) : null
    }));
    
    res.json(scans);
  });
});

// Détails d'un scan
app.get('/api/scan/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM scans WHERE id = ?', [id], (err, scan) => {
    if (err) {
      console.error('❌ Erreur scan:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    
    if (!scan) {
      return res.status(404).json({ error: 'Scan non trouvé' });
    }
    
    const scanData = {
      ...scan,
      results: scan.results ? JSON.parse(scan.results) : null
    };
    
    res.json(scanData);
  });
});

// Statistiques
app.get('/api/stats', (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_scans,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_scans,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_scans,
      COUNT(CASE WHEN status = 'running' THEN 1 END) as running_scans
    FROM scans
  `;
  
  db.get(query, [], (err, stats) => {
    if (err) {
      console.error('❌ Erreur stats:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    
    res.json(stats || {});
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: 'connected',
    websocket: wsServer ? 'active' : 'inactive',
    clients: clients.size
  });
});

// Route par défaut
app.get('/', (req, res) => {
  res.json({
    name: 'Security Scanner API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'POST /api/scan/trigger',
      'POST /api/scan/results', 
      'GET /api/scans',
      'GET /api/scan/:id',
      'GET /api/stats',
      'GET /health'
    ]
  });
});

// Démarrage serveur
const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📊 API disponible sur http://localhost:${PORT}`);
});

// WebSocket
wsServer = new WebSocketServer({ server });

wsServer.on('connection', (ws) => {
  console.log('🔌 Nouvelle connexion WebSocket');
  clients.add(ws);
  
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connexion WebSocket établie'
  }));
  
  ws.on('close', () => {
    console.log('🔌 Connexion WebSocket fermée');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('❌ Erreur WebSocket:', error);
    clients.delete(ws);
  });
});

// Arrêt propre
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Arrêt du serveur...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});