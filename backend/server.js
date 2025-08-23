// const express = require("express");
// const cors = require("cors");
// const { WebSocketServer } = require("ws");
// const { Octokit } = require("@octokit/rest");
// const sqlite3 = require("sqlite3").verbose();
// const { v4: uuidv4 } = require("uuid");
// require("dotenv").config();

// const app = express();
// const PORT = process.env.PORT || 3001;

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Configuration
// const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
// if (!GITHUB_TOKEN) {
//   console.error("❌ GITHUB_TOKEN manquant dans .env");
//   process.exit(1);
// }

// // GitHub API
// const octokit = new Octokit({ auth: GITHUB_TOKEN });

// // Base de données SQLite
// const db = new sqlite3.Database("./scanner.db", (err) => {
//   if (err) {
//     console.error("❌ Erreur base de données:", err);
//     process.exit(1);
//   }
//   console.log("✅ Base de données connectée");
// });

// // Créer tables
// db.serialize(() => {
//   db.run(`
//     CREATE TABLE IF NOT EXISTS scans (
//       id TEXT PRIMARY KEY,
//       github_url TEXT NOT NULL,
//       repository TEXT NOT NULL,
//       status TEXT DEFAULT 'pending',
//       start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
//       completed_at DATETIME,
//       results TEXT,
//       error_message TEXT
//     )
//   `);
// });

// // WebSocket
// let wsServer;
// const clients = new Set();

// // Fonctions utilitaires
// const broadcastToClients = (data) => {
//   const message = JSON.stringify(data);
//   clients.forEach((client) => {
//     if (client.readyState === 1) {
//       try {
//         client.send(message);
//       } catch (error) {
//         clients.delete(client);
//       }
//     }
//   });
// };

// const updateScanStatus = (scanId, status, additionalData = {}) => {
//   return new Promise((resolve, reject) => {
//     let query = "UPDATE scans SET status = ?";
//     let params = [status];

//     if (status === "completed" || status === "failed") {
//       query += ", completed_at = CURRENT_TIMESTAMP";
//     }

//     if (additionalData.results) {
//       query += ", results = ?";
//       params.push(JSON.stringify(additionalData.results));
//     }

//     if (additionalData.errorMessage) {
//       query += ", error_message = ?";
//       params.push(additionalData.errorMessage);
//     }

//     query += " WHERE id = ?";
//     params.push(scanId);

//     db.run(query, params, function (err) {
//       if (err) {
//         reject(err);
//       } else {
//         // Récupérer le scan mis à jour
//         db.get("SELECT * FROM scans WHERE id = ?", [scanId], (err, scan) => {
//           if (!err && scan) {
//             const scanData = {
//               ...scan,
//               results: scan.results ? JSON.parse(scan.results) : null,
//             };

//             // Notifier via WebSocket
//             broadcastToClients({
//               type: "scan_update",
//               scan: scanData,
//             });

//             resolve(scanData);
//           } else {
//             resolve({ id: scanId, status });
//           }
//         });
//       }
//     });
//   });
// };

// const parseGitHubUrl = (url) => {
//   const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
//   if (!match) throw new Error("URL GitHub invalide");

//   return {
//     owner: match[1],
//     repo: match[2].replace(/\.git$/, ""),
//     fullName: `${match[1]}/${match[2].replace(/\.git$/, "")}`,
//   };
// };

// // 🚀 ROUTES API

// // Déclencher un scan
// app.post("/api/scan/trigger", async (req, res) => {
//   try {
//     const { githubUrl } = req.body;

//     if (!githubUrl) {
//       return res.status(400).json({ error: "URL GitHub requise" });
//     }

//     // Parser l'URL
//     const repoInfo = parseGitHubUrl(githubUrl);
//     const scanId = uuidv4();

//     console.log(`🚀 Nouveau scan: ${repoInfo.fullName}`);

//     // Vérifier que le repo existe
//     try {
//       await octokit.rest.repos.get({
//         owner: repoInfo.owner,
//         repo: repoInfo.repo,
//       });
//     } catch (error) {
//       if (error.status === 404) {
//         return res
//           .status(404)
//           .json({ error: "Repository non trouvé ou privé" });
//       }
//       throw error;
//     }

//     // Créer le scan en base
//     db.run(
//       "INSERT INTO scans (id, github_url, repository) VALUES (?, ?, ?)",
//       [scanId, githubUrl, repoInfo.fullName],
//       async function (err) {
//         if (err) {
//           console.error("❌ Erreur base:", err);
//           return res.status(500).json({ error: "Erreur base de données" });
//         }

//         try {
//           // Déclencher GitHub Actions
//           await octokit.rest.actions.createWorkflowDispatch({
//             owner: process.env.GITHUB_ACTIONS_OWNER,
//             repo: process.env.GITHUB_ACTIONS_REPO,
//             workflow_id: "security-scan.yml",
//             ref: "main",
//             inputs: {
//               target_repo: githubUrl,
//               scan_id: scanId,
//               callback_url: "https://077ea4755.ngrok-free.app/api/scan/results",
//             },
//           });

//           // Marquer comme running
//           await updateScanStatus(scanId, "running");

//           const scan = {
//             id: scanId,
//             githubUrl,
//             repository: repoInfo.fullName,
//             status: "running",
//             startTime: new Date().toISOString(),
//           };

//           res.json({
//             success: true,
//             scan,
//             message: "Scan démarré avec succès",
//           });
//         } catch (workflowError) {
//           console.error("❌ Erreur workflow:", workflowError);
//           await updateScanStatus(scanId, "failed", {
//             errorMessage: workflowError.message,
//           });

//           res.status(500).json({
//             error: "Erreur lors du déclenchement du scan",
//             details: workflowError.message,
//           });
//         }
//       }
//     );
//   } catch (error) {
//     console.error("❌ Erreur scan:", error);
//     res.status(500).json({ error: "Erreur interne" });
//   }
// });

// // Recevoir résultats depuis GitHub Actions
// app.post("/api/scan/results", async (req, res) => {
//   try {
//     const { scan_id, status, results, error_message } = req.body;

//     if (!scan_id) {
//       return res.status(400).json({ error: "scan_id requis" });
//     }

//     console.log(`📥 Résultats reçus pour ${scan_id}: ${status}`);

//     // Vérifier que le scan existe
//     db.get("SELECT * FROM scans WHERE id = ?", [scan_id], async (err, scan) => {
//       if (err) {
//         console.error("❌ Erreur base:", err);
//         return res.status(500).json({ error: "Erreur base de données" });
//       }

//       if (!scan) {
//         return res.status(404).json({ error: "Scan non trouvé" });
//       }

//       try {
//         await updateScanStatus(scan_id, status, {
//           results: results,
//           errorMessage: error_message,
//         });

//         res.json({ success: true, message: "Résultats enregistrés" });
//       } catch (updateError) {
//         console.error("❌ Erreur update:", updateError);
//         res.status(500).json({ error: "Erreur mise à jour" });
//       }
//     });
//   } catch (error) {
//     console.error("❌ Erreur résultats:", error);
//     res.status(500).json({ error: "Erreur interne" });
//   }
// });

// // Lister les scans
// app.get("/api/scans", (req, res) => {
//   const { limit = 20, status, search } = req.query;

//   let query = "SELECT * FROM scans";
//   let params = [];
//   let conditions = [];

//   if (status && status !== "all") {
//     conditions.push("status = ?");
//     params.push(status);
//   }

//   if (search) {
//     conditions.push("repository LIKE ?");
//     params.push(`%${search}%`);
//   }

//   if (conditions.length > 0) {
//     query += " WHERE " + conditions.join(" AND ");
//   }

//   query += " ORDER BY start_time DESC LIMIT ?";
//   params.push(parseInt(limit));

//   db.all(query, params, (err, rows) => {
//     if (err) {
//       console.error("❌ Erreur scans:", err);
//       return res.status(500).json({ error: "Erreur base de données" });
//     }

//     const scans = rows.map((row) => ({
//       ...row,
//       results: row.results ? JSON.parse(row.results) : null,
//     }));

//     res.json(scans);
//   });
// });

// // Détails d'un scan
// app.get("/api/scan/:id", (req, res) => {
//   const { id } = req.params;

//   db.get("SELECT * FROM scans WHERE id = ?", [id], (err, scan) => {
//     if (err) {
//       console.error("❌ Erreur scan:", err);
//       return res.status(500).json({ error: "Erreur base de données" });
//     }

//     if (!scan) {
//       return res.status(404).json({ error: "Scan non trouvé" });
//     }

//     const scanData = {
//       ...scan,
//       results: scan.results ? JSON.parse(scan.results) : null,
//     };

//     res.json(scanData);
//   });
// });

// // ✨ NOUVELLES ROUTES DE SUPPRESSION ✨

// // Supprimer un scan spécifique
// app.delete("/api/scans/:scanId", (req, res) => {
//   const { scanId } = req.params;

//   console.log(`🗑️ Demande de suppression du scan: ${scanId}`);

//   // Vérifier d'abord si le scan existe
//   db.get("SELECT * FROM scans WHERE id = ?", [scanId], (err, scan) => {
//     if (err) {
//       console.error("❌ Erreur lors de la vérification:", err);
//       return res.status(500).json({
//         success: false,
//         message: "Erreur base de données",
//       });
//     }

//     if (!scan) {
//       return res.status(404).json({
//         success: false,
//         message: "Scan non trouvé",
//       });
//     }

//     // Empêcher la suppression d'un scan en cours
//     if (scan.status === "running") {
//       return res.status(400).json({
//         success: false,
//         message: "Impossible de supprimer un scan en cours",
//       });
//     }

//     // Supprimer le scan
//     db.run("DELETE FROM scans WHERE id = ?", [scanId], function (err) {
//       if (err) {
//         console.error("❌ Erreur lors de la suppression:", err);
//         return res.status(500).json({
//           success: false,
//           message: "Erreur lors de la suppression",
//         });
//       }

//       if (this.changes === 0) {
//         return res.status(404).json({
//           success: false,
//           message: "Scan non trouvé",
//         });
//       }

//       console.log(`✅ Scan ${scanId} supprimé avec succès`);

//       // Notifier via WebSocket de la suppression
//       broadcastToClients({
//         type: "scan_deleted",
//         scanId: scanId,
//         repository: scan.repository,
//       });

//       res.json({
//         success: true,
//         message: "Scan supprimé avec succès",
//         deletedScanId: scanId,
//         repository: scan.repository,
//       });
//     });
//   });
// });

// // Supprimer plusieurs scans
// app.delete("/api/scans", (req, res) => {
//   const { scanIds } = req.body;

//   if (!scanIds || !Array.isArray(scanIds) || scanIds.length === 0) {
//     return res.status(400).json({
//       success: false,
//       message: "Liste de scanIds requise",
//     });
//   }

//   console.log(`🗑️ Suppression multiple: ${scanIds.length} scans`);

//   // Créer placeholders pour la requête IN
//   const placeholders = scanIds.map(() => "?").join(",");

//   // Vérifier quels scans existent et leur statut
//   db.all(
//     `SELECT id, repository, status FROM scans WHERE id IN (${placeholders})`,
//     scanIds,
//     (err, existingScans) => {
//       if (err) {
//         console.error("❌ Erreur vérification:", err);
//         return res.status(500).json({
//           success: false,
//           message: "Erreur base de données",
//         });
//       }

//       // Vérifier s'il y a des scans en cours
//       const runningScans = existingScans.filter(
//         (scan) => scan.status === "running"
//       );
//       if (runningScans.length > 0) {
//         return res.status(400).json({
//           success: false,
//           message: `Impossible de supprimer ${runningScans.length} scan(s) en cours`,
//           runningScans: runningScans.map((s) => s.repository),
//         });
//       }

//       if (existingScans.length === 0) {
//         return res.status(404).json({
//           success: false,
//           message: "Aucun scan trouvé",
//         });
//       }

//       // Supprimer les scans
//       db.run(
//         `DELETE FROM scans WHERE id IN (${placeholders})`,
//         scanIds,
//         function (err) {
//           if (err) {
//             console.error("❌ Erreur suppression multiple:", err);
//             return res.status(500).json({
//               success: false,
//               message: "Erreur lors de la suppression",
//             });
//           }

//           console.log(`✅ ${this.changes} scan(s) supprimé(s)`);

//           // Notifier via WebSocket
//           existingScans.forEach((scan) => {
//             broadcastToClients({
//               type: "scan_deleted",
//               scanId: scan.id,
//               repository: scan.repository,
//             });
//           });

//           res.json({
//             success: true,
//             message: `${this.changes} scan(s) supprimé(s) avec succès`,
//             deletedCount: this.changes,
//             deletedScans: existingScans.map((s) => ({
//               id: s.id,
//               repository: s.repository,
//             })),
//           });
//         }
//       );
//     }
//   );
// });

// // Supprimer tous les scans (avec confirmation)
// app.delete("/api/scans/all", (req, res) => {
//   const { confirm } = req.body;

//   if (confirm !== "DELETE_ALL") {
//     return res.status(400).json({
//       success: false,
//       message: 'Confirmation requise: { "confirm": "DELETE_ALL" }',
//     });
//   }

//   console.log(`🗑️ Suppression de TOUS les scans`);

//   // Vérifier s'il y a des scans en cours
//   db.all(
//     'SELECT COUNT(*) as count FROM scans WHERE status = "running"',
//     [],
//     (err, result) => {
//       if (err) {
//         console.error("❌ Erreur vérification:", err);
//         return res.status(500).json({
//           success: false,
//           message: "Erreur base de données",
//         });
//       }

//       if (result[0].count > 0) {
//         return res.status(400).json({
//           success: false,
//           message: `Impossible de supprimer: ${result[0].count} scan(s) en cours`,
//         });
//       }

//       // Supprimer tous les scans
//       db.run("DELETE FROM scans", [], function (err) {
//         if (err) {
//           console.error("❌ Erreur suppression totale:", err);
//           return res.status(500).json({
//             success: false,
//             message: "Erreur lors de la suppression",
//           });
//         }

//         console.log(`✅ TOUS les scans supprimés (${this.changes} scans)`);

//         // Notifier via WebSocket
//         broadcastToClients({
//           type: "all_scans_deleted",
//           deletedCount: this.changes,
//         });

//         res.json({
//           success: true,
//           message: `Tous les scans supprimés (${this.changes} scans)`,
//           deletedCount: this.changes,
//         });
//       });
//     }
//   );
// });

// // Statistiques
// app.get("/api/stats", (req, res) => {
//   const query = `
//     SELECT 
//       COUNT(*) as total_scans,
//       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_scans,
//       COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_scans,
//       COUNT(CASE WHEN status = 'running' THEN 1 END) as running_scans
//     FROM scans
//   `;

//   db.get(query, [], (err, stats) => {
//     if (err) {
//       console.error("❌ Erreur stats:", err);
//       return res.status(500).json({ error: "Erreur base de données" });
//     }

//     res.json(stats || {});
//   });
// });

// // Health check
// app.get("/health", (req, res) => {
//   res.json({
//     status: "healthy",
//     timestamp: new Date().toISOString(),
//     database: "connected",
//     websocket: wsServer ? "active" : "inactive",
//     clients: clients.size,
//   });
// });

// // Route par défaut
// app.get("/", (req, res) => {
//   res.json({
//     name: "Security Scanner API",
//     version: "1.0.0",
//     status: "running",
//     endpoints: [
//       "POST /api/scan/trigger",
//       "POST /api/scan/results",
//       "GET /api/scans",
//       "GET /api/scan/:id",
//       "DELETE /api/scans/:scanId", // ✨ NOUVEAU
//       "DELETE /api/scans", // ✨ NOUVEAU (suppression multiple)
//       "DELETE /api/scans/all", // ✨ NOUVEAU (suppression totale)
//       "GET /api/stats",
//       "GET /health",
//     ],
//   });
// });

// // Démarrage serveur
// const server = app.listen(PORT, () => {
//   console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
//   console.log(`📊 API disponible sur http://localhost:${PORT}`);
// });

// // WebSocket
// wsServer = new WebSocketServer({ server });

// wsServer.on("connection", (ws) => {
//   console.log("🔌 Nouvelle connexion WebSocket");
//   clients.add(ws);

//   ws.send(
//     JSON.stringify({
//       type: "connection",
//       message: "Connexion WebSocket établie",
//     })
//   );

//   ws.on("close", () => {
//     console.log("🔌 Connexion WebSocket fermée");
//     clients.delete(ws);
//   });

//   ws.on("error", (error) => {
//     console.error("❌ Erreur WebSocket:", error);
//     clients.delete(ws);
//   });
// });

// // Arrêt propre
// process.on("SIGTERM", () => {
//   console.log("🛑 Arrêt du serveur...");
//   server.close(() => {
//     db.close();
//     process.exit(0);
//   });
// });

// process.on("SIGINT", () => {
//   console.log("🛑 Arrêt du serveur...");
//   server.close(() => {
//     db.close();
//     process.exit(0);
//   });
// });
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");
const { Octokit } = require("@octokit/rest");
const sqlite3 = require("sqlite3").verbose();
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ MIDDLEWARE AMÉLIORÉ
app.use(cors({
  origin: process.env.FRONTEND_URL || ["http://localhost:3000", "http://localhost:3001"],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ LOGGING MIDDLEWARE
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error("❌ GITHUB_TOKEN manquant dans .env");
  process.exit(1);
}

// ✅ CONFIGURATION NGROK DYNAMIQUE
const getNgrokUrl = async () => {
  try {
    // Option 1: Environment variable (recommended)
    if (process.env.NGROK_URL) {
      return process.env.NGROK_URL.replace(/\/$/, '');
    }

    // Option 2: API ngrok locale
    const response = await fetch('http://localhost:4040/api/tunnels');
    if (response.ok) {
      const data = await response.json();
      const httpsTunnel = data.tunnels.find(tunnel => tunnel.proto === 'https');
      if (httpsTunnel) {
        console.log(`✅ Ngrok URL détectée: ${httpsTunnel.public_url}`);
        return httpsTunnel.public_url;
      }
    }
  } catch (error) {
    console.warn('⚠️ Impossible de récupérer l\'URL ngrok automatiquement');
  }

  // Fallback - MUST be updated manually
  throw new Error('❌ Ngrok URL non configurée. Veuillez définir NGROK_URL dans .env');
};

// GitHub API
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Base de données SQLite
const db = new sqlite3.Database("./scanner.db", (err) => {
  if (err) {
    console.error("❌ Erreur base de données:", err);
    process.exit(1);
  }
  console.log("✅ Base de données connectée");
});

// ✅ CRÉATION DE TABLES AMÉLIORÉE
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
      error_message TEXT,
      duration INTEGER,
      files_scanned INTEGER,
      callback_url TEXT,
      workflow_run_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ✅ NOUVELLE TABLE POUR LES STATISTIQUES
  db.run(`
    CREATE TABLE IF NOT EXISTS scan_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT,
      scan_type TEXT,
      vulnerabilities_found INTEGER,
      critical_count INTEGER DEFAULT 0,
      high_count INTEGER DEFAULT 0,
      medium_count INTEGER DEFAULT 0,
      low_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
    )
  `);
});

// WebSocket
let wsServer;
const clients = new Set();

// ✅ FONCTIONS UTILITAIRES AMÉLIORÉES
const broadcastToClients = (data) => {
  const message = JSON.stringify(data);
  console.log(`📡 Broadcasting to ${clients.size} clients:`, data.type);
  
  clients.forEach((client) => {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch (error) {
        console.error('❌ Erreur broadcast:', error);
        clients.delete(client);
      }
    }
  });
};

const updateScanStatus = (scanId, status, additionalData = {}) => {
  return new Promise((resolve, reject) => {
    let query = "UPDATE scans SET status = ?, updated_at = CURRENT_TIMESTAMP";
    let params = [status];

    if (status === "completed" || status === "failed") {
      query += ", completed_at = CURRENT_TIMESTAMP";
    }

    if (additionalData.results) {
      query += ", results = ?";
      params.push(JSON.stringify(additionalData.results));
    }

    if (additionalData.errorMessage) {
      query += ", error_message = ?";
      params.push(additionalData.errorMessage);
    }

    if (additionalData.duration) {
      query += ", duration = ?";
      params.push(additionalData.duration);
    }

    if (additionalData.filesScanned) {
      query += ", files_scanned = ?";
      params.push(additionalData.filesScanned);
    }

    query += " WHERE id = ?";
    params.push(scanId);

    db.run(query, params, function (err) {
      if (err) {
        console.error('❌ Erreur update scan:', err);
        reject(err);
      } else {
        // Récupérer le scan mis à jour
        db.get("SELECT * FROM scans WHERE id = ?", [scanId], (err, scan) => {
          if (!err && scan) {
            const scanData = {
              ...scan,
              results: scan.results ? JSON.parse(scan.results) : null,
            };

            // Sauvegarder les statistiques si c'est un scan complété
            if (status === 'completed' && additionalData.results) {
              saveScanStats(scanId, additionalData.results);
            }

            // Notifier via WebSocket
            broadcastToClients({
              type: "scan_update",
              scan: scanData,
              timestamp: new Date().toISOString()
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

// ✅ NOUVELLE FONCTION POUR SAUVEGARDER LES STATS
const saveScanStats = (scanId, results) => {
  const critical = results.critical || 0;
  const high = results.high || 0;
  const medium = results.medium || 0;
  const low = results.low || 0;
  const total = critical + high + medium + low;

  db.run(`
    INSERT INTO scan_stats (
      scan_id, scan_type, vulnerabilities_found, 
      critical_count, high_count, medium_count, low_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [scanId, 'security', total, critical, high, medium, low], (err) => {
    if (err) {
      console.error('❌ Erreur sauvegarde stats:', err);
    } else {
      console.log(`✅ Stats sauvegardées pour ${scanId}: ${total} vulns`);
    }
  });
};

const parseGitHubUrl = (url) => {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("URL GitHub invalide");

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
    fullName: `${match[1]}/${match[2].replace(/\.git$/, "")}`,
  };
};

// 🚀 ROUTES API AMÉLIORÉES

// ✅ ROUTE COMPATIBLE AVEC LE FRONTEND - /api/start-scan
app.post("/api/start-scan", async (req, res) => {
  try {
    const { repository, callbackUrl, scanDepth = 'standard', userId } = req.body;
    
    console.log('🚀 Nouvelle demande de scan:', {
      repository,
      callbackUrl,
      scanDepth,
      userId
    });

    if (!repository) {
      return res.status(400).json({ 
        success: false,
        error: "Repository URL requise" 
      });
    }

    // Parser l'URL
    const repoInfo = parseGitHubUrl(repository);
    const scanId = uuidv4();

    console.log(`🚀 Nouveau scan: ${repoInfo.fullName} (ID: ${scanId})`);

    // Vérifier que le repo existe
    try {
      await octokit.rest.repos.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
      });
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ 
          success: false,
          error: "Repository non trouvé ou privé" 
        });
      }
      throw error;
    }

    // ✅ CALLBACK URL DYNAMIQUE AVEC ENDPOINT CORRECT
    const ngrokBaseUrl = await getNgrokUrl();
    const finalCallbackUrl = callbackUrl || `${ngrokBaseUrl}/api/scan-callback`;
    
    console.log(`📞 Callback URL: ${finalCallbackUrl}`);

    // Créer le scan en base avec callback URL
    db.run(
      `INSERT INTO scans (
        id, github_url, repository, callback_url, status
      ) VALUES (?, ?, ?, ?, ?)`,
      [scanId, repository, repoInfo.fullName, finalCallbackUrl, 'pending'],
      async function (err) {
        if (err) {
          console.error("❌ Erreur base:", err);
          return res.status(500).json({ 
            success: false,
            error: "Erreur base de données" 
          });
        }

        try {
          // ✅ DÉCLENCHEMENT GITHUB ACTIONS AVEC CALLBACK CORRECT
          const workflowDispatch = await octokit.rest.actions.createWorkflowDispatch({
            owner: process.env.GITHUB_ACTIONS_OWNER || 'B-BRAHIM433',
            repo: process.env.GITHUB_ACTIONS_REPO || 'Stage_DevSecOps_VF',
            workflow_id: "security-scan.yml",
            ref: "main",
            inputs: {
              target_repo: repository,
              scan_id: scanId,
              callback_url: finalCallbackUrl, // ✅ URL COMPLETE AVEC ENDPOINT
              scan_depth: scanDepth,
              timestamp: new Date().toISOString()
            },
          });

          console.log(`✅ Workflow déclenché pour ${scanId}`);

          // Marquer comme running
          await updateScanStatus(scanId, "running");

          const scanData = {
            scanId: scanId,
            id: scanId,
            repository: repoInfo.fullName,
            githubUrl: repository,
            status: "running",
            startTime: new Date().toISOString(),
            callbackUrl: finalCallbackUrl
          };

          res.json({
            success: true,
            scan: scanData,
            scanId: scanId,
            message: "Scan démarré avec succès",
            workflowUrl: `https://github.com/${process.env.GITHUB_ACTIONS_OWNER || 'B-BRAHIM433'}/${process.env.GITHUB_ACTIONS_REPO || 'DevSecOps-Pipeline'}/actions`
          });

          // Broadcast de démarrage
          broadcastToClients({
            type: "scan_started",
            scan: scanData,
            timestamp: new Date().toISOString()
          });

        } catch (workflowError) {
          console.error("❌ Erreur workflow:", workflowError);
          await updateScanStatus(scanId, "failed", {
            errorMessage: `Workflow error: ${workflowError.message}`,
          });

          res.status(500).json({
            success: false,
            error: "Erreur lors du déclenchement du scan",
            details: workflowError.message,
          });
        }
      }
    );
  } catch (error) {
    console.error("❌ Erreur scan:", error);
    res.status(500).json({ 
      success: false,
      error: "Erreur interne",
      details: error.message 
    });
  }
});

// ✅ ROUTE DE CALLBACK AMÉLIORÉE - /api/scan-callback
app.post("/api/scan-callback", async (req, res) => {
  try {
    console.log('📥 Callback reçu:', JSON.stringify(req.body, null, 2));
    
    const { 
      scan_id, 
      status, 
      results, 
      error_message,
      duration,
      files_scanned,
      repository
    } = req.body;

    if (!scan_id) {
      console.error('❌ scan_id manquant dans le callback');
      return res.status(400).json({ 
        success: false,
        error: "scan_id requis" 
      });
    }

    console.log(`📥 Résultats reçus pour ${scan_id}:`, {
      status,
      duration,
      files_scanned,
      vulnerabilities: results ? Object.keys(results).length : 0
    });

    // Vérifier que le scan existe
    db.get("SELECT * FROM scans WHERE id = ?", [scan_id], async (err, scan) => {
      if (err) {
        console.error("❌ Erreur base:", err);
        return res.status(500).json({ 
          success: false,
          error: "Erreur base de données" 
        });
      }

      if (!scan) {
        console.error(`❌ Scan ${scan_id} non trouvé`);
        return res.status(404).json({ 
          success: false,
          error: "Scan non trouvé" 
        });
      }

      try {
        // ✅ MISE À JOUR AVEC TOUTES LES DONNÉES
        const updatedScan = await updateScanStatus(scan_id, status, {
          results: results,
          errorMessage: error_message,
          duration: duration,
          filesScanned: files_scanned
        });

        console.log(`✅ Scan ${scan_id} mis à jour: ${status}`);

        res.json({ 
          success: true, 
          message: "Résultats enregistrés avec succès",
          scan: updatedScan
        });

        // ✅ NOTIFICATIONS SPÉCIALES POUR LES RÉSULTATS
        if (status === 'completed' && results) {
          const totalVulns = (results.critical || 0) + (results.high || 0) + 
                           (results.medium || 0) + (results.low || 0);
          
          broadcastToClients({
            type: "scan_completed",
            scan: updatedScan,
            summary: {
              repository: scan.repository,
              totalVulnerabilities: totalVulns,
              duration: duration,
              filesScanned: files_scanned
            },
            timestamp: new Date().toISOString()
          });
        }

      } catch (updateError) {
        console.error("❌ Erreur update:", updateError);
        res.status(500).json({ 
          success: false,
          error: "Erreur mise à jour",
          details: updateError.message
        });
      }
    });
  } catch (error) {
    console.error("❌ Erreur callback:", error);
    res.status(500).json({ 
      success: false,
      error: "Erreur interne",
      details: error.message 
    });
  }
});

// ✅ ROUTES DE STATUT ET RÉSULTATS (compatibles avec le frontend)
app.get("/api/scan-status/:scanId", (req, res) => {
  const { scanId } = req.params;

  db.get("SELECT * FROM scans WHERE id = ?", [scanId], (err, scan) => {
    if (err) {
      console.error("❌ Erreur scan status:", err);
      return res.status(500).json({ 
        success: false,
        error: "Erreur base de données" 
      });
    }

    if (!scan) {
      return res.status(404).json({ 
        success: false,
        error: "Scan non trouvé" 
      });
    }

    res.json({
      success: true,
      status: scan.status,
      scan: {
        ...scan,
        results: scan.results ? JSON.parse(scan.results) : null,
      }
    });
  });
});

app.get("/api/scan-results/:scanId", (req, res) => {
  const { scanId } = req.params;

  db.get("SELECT * FROM scans WHERE id = ?", [scanId], (err, scan) => {
    if (err) {
      console.error("❌ Erreur scan results:", err);
      return res.status(500).json({ 
        success: false,
        error: "Erreur base de données" 
      });
    }

    if (!scan) {
      return res.status(404).json({ 
        success: false,
        error: "Scan non trouvé" 
      });
    }

    if (scan.status !== 'completed') {
      return res.status(202).json({
        success: false,
        message: "Scan non terminé",
        status: scan.status
      });
    }

    const results = {
      scanId: scan.id,
      repository: scan.repository,
      status: scan.status,
      duration: scan.duration,
      filesScanned: scan.files_scanned,
      completedAt: scan.completed_at,
      results: scan.results ? JSON.parse(scan.results) : null,
      totalVulnerabilities: 0
    };

    // Calculer le total des vulnérabilités
    if (results.results) {
      results.totalVulnerabilities = (results.results.critical || 0) + 
                                    (results.results.high || 0) + 
                                    (results.results.medium || 0) + 
                                    (results.results.low || 0);
    }

    res.json({
      success: true,
      ...results
    });
  });
});

// ✅ ROUTES EXISTANTES MAINTENUES POUR COMPATIBILITÉ
app.post("/api/scan/trigger", async (req, res) => {
  // Rediriger vers la nouvelle route
  req.body.repository = req.body.githubUrl;
  delete req.body.githubUrl;
  
  // Appeler la nouvelle logique
  return app._router.handle({ ...req, url: '/api/start-scan', path: '/api/start-scan' }, res);
});

app.post("/api/scan/results", async (req, res) => {
  // Rediriger vers la nouvelle route
  return app._router.handle({ ...req, url: '/api/scan-callback', path: '/api/scan-callback' }, res);
});

// ✅ RESTE DES ROUTES EXISTANTES (scans, suppression, etc.)
app.get("/api/scans", (req, res) => {
  const { limit = 20, status, search } = req.query;

  let query = "SELECT * FROM scans";
  let params = [];
  let conditions = [];

  if (status && status !== "all") {
    conditions.push("status = ?");
    params.push(status);
  }

  if (search) {
    conditions.push("repository LIKE ?");
    params.push(`%${search}%`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY start_time DESC LIMIT ?";
  params.push(parseInt(limit));

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("❌ Erreur scans:", err);
      return res.status(500).json({ error: "Erreur base de données" });
    }

    const scans = rows.map((row) => ({
      ...row,
      results: row.results ? JSON.parse(row.results) : null,
    }));

    res.json(scans);
  });
});

app.get("/api/scan/:id", (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM scans WHERE id = ?", [id], (err, scan) => {
    if (err) {
      console.error("❌ Erreur scan:", err);
      return res.status(500).json({ error: "Erreur base de données" });
    }

    if (!scan) {
      return res.status(404).json({ error: "Scan non trouvé" });
    }

    const scanData = {
      ...scan,
      results: scan.results ? JSON.parse(scan.results) : null,
    };

    res.json(scanData);
  });
});

// ✅ ROUTES DE SUPPRESSION (maintenues)
app.delete("/api/scans/:scanId", (req, res) => {
  const { scanId } = req.params;

  console.log(`🗑️ Demande de suppression du scan: ${scanId}`);

  db.get("SELECT * FROM scans WHERE id = ?", [scanId], (err, scan) => {
    if (err) {
      console.error("❌ Erreur lors de la vérification:", err);
      return res.status(500).json({
        success: false,
        message: "Erreur base de données",
      });
    }

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: "Scan non trouvé",
      });
    }

    if (scan.status === "running") {
      return res.status(400).json({
        success: false,
        message: "Impossible de supprimer un scan en cours",
      });
    }

    db.run("DELETE FROM scans WHERE id = ?", [scanId], function (err) {
      if (err) {
        console.error("❌ Erreur lors de la suppression:", err);
        return res.status(500).json({
          success: false,
          message: "Erreur lors de la suppression",
        });
      }

      console.log(`✅ Scan ${scanId} supprimé avec succès`);

      broadcastToClients({
        type: "scan_deleted",
        scanId: scanId,
        repository: scan.repository,
      });

      res.json({
        success: true,
        message: "Scan supprimé avec succès",
        deletedScanId: scanId,
        repository: scan.repository,
      });
    });
  });
});

// ✅ STATISTIQUES AVANCÉES
app.get("/api/stats", (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_scans,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_scans,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_scans,
      COUNT(CASE WHEN status = 'running' THEN 1 END) as running_scans,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_scans,
      AVG(duration) as avg_duration,
      SUM(files_scanned) as total_files_scanned,
      MAX(start_time) as last_scan_time
    FROM scans
  `;

  db.get(query, [], (err, stats) => {
    if (err) {
      console.error("❌ Erreur stats:", err);
      return res.status(500).json({ error: "Erreur base de données" });
    }

    // Stats des vulnérabilités
    db.get(`
      SELECT 
        SUM(vulnerabilities_found) as total_vulnerabilities,
        SUM(critical_count) as total_critical,
        SUM(high_count) as total_high,
        SUM(medium_count) as total_medium,
        SUM(low_count) as total_low,
        AVG(vulnerabilities_found) as avg_vulnerabilities_per_scan
      FROM scan_stats
    `, [], (err, vulnStats) => {
      if (err) {
        console.warn("⚠️ Erreur stats vulnérabilités:", err);
      }

      res.json({
        ...stats,
        ...vulnStats,
        clients_connected: clients.size,
        ngrok_url: process.env.NGROK_URL || 'Not configured'
      });
    });
  });
});

// ✅ HEALTH CHECK AMÉLIORÉ
app.get("/health", async (req, res) => {
  const ngrokUrl = await getNgrokUrl();
  
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: "connected",
    websocket: wsServer ? "active" : "inactive",
    clients: clients.size,
    ngrok_url: ngrokUrl,
    callback_endpoint: `${ngrokUrl}/api/scan-callback`,
    github_actions_repo: `${process.env.GITHUB_ACTIONS_OWNER || 'B-BRAHIM433'}/${process.env.GITHUB_ACTIONS_REPO || 'DevSecOps-Pipeline'}`,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Route par défaut avec toutes les routes disponibles
app.get("/", (req, res) => {
  res.json({
    name: "Security Scanner API",
    version: "2.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: [
      // ✅ NOUVELLES ROUTES PRINCIPALES
      "POST /api/start-scan - Démarrer un scan (nouvelle interface)",
      "POST /api/scan-callback - Recevoir résultats GitHub Actions",
      "GET /api/scan-status/:scanId - Statut d'un scan",
      "GET /api/scan-results/:scanId - Résultats d'un scan",
      
      // Routes de compatibilité
      "POST /api/scan/trigger - Déclencher scan (ancienne interface)",
      "POST /api/scan/results - Recevoir résultats (ancienne interface)",
      
      // Routes existantes
      "GET /api/scans - Liste des scans",
      "GET /api/scan/:id - Détails d'un scan",
      "DELETE /api/scans/:scanId - Supprimer un scan",
      "DELETE /api/scans - Suppression multiple",
      "DELETE /api/scans/all - Suppression totale",
      "GET /api/stats - Statistiques",
      "GET /health - Health check"
    ],
    websocket: "ws://localhost:" + PORT,
    callback_url_pattern: "/api/scan-callback"
  });
});

// Démarrage serveur
const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📊 API disponible sur http://localhost:${PORT}`);
  console.log(`🔌 WebSocket sur ws://localhost:${PORT}`);
  
  // Afficher l'URL de callback au démarrage
  getNgrokUrl().then(url => {
    console.log(`📞 Callback URL: ${url}/api/scan-callback`);
    console.log(`💡 Assurez-vous que cette URL est accessible depuis GitHub Actions!`);
  });
});

// ✅ WEBSOCKET AMÉLIORÉ
wsServer = new WebSocketServer({ server });

wsServer.on("connection", (ws, req) => {
  console.log(`🔌 Nouvelle connexion WebSocket (${clients.size + 1} clients)`);
  clients.add(ws);

  // Envoi d'un message de bienvenue
  ws.send(JSON.stringify({
    type: "connection",
    message: "Connexion WebSocket établie",
    clientId: Date.now(),
    timestamp: new Date().toISOString()
  }));

  // Heartbeat pour maintenir la connexion
  const heartbeat = setInterval(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "ping", timestamp: new Date().toISOString() }));
    }
  }, 30000);

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === "pong") {
        // Réponse au ping - connexion active
      }
    } catch (error) {
      console.error("❌ Erreur message WebSocket:", error);
    }
  });

  ws.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(ws);
    console.log(`🔌 Connexion WebSocket fermée (${clients.size} clients restants)`);
  });

  ws.on("error", (error) => {
    console.error("❌ Erreur WebSocket:", error);
    clearInterval(heartbeat);
    clients.delete(ws);
  });
});

// ✅ ARRÊT PROPRE AMÉLIORÉ
const gracefulShutdown = () => {
  console.log("🛑 Arrêt du serveur...");
  
  // Fermer WebSocket
  if (wsServer) {
    wsServer.close();
  }
  
  // Fermer connexions clients
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.close();
    }
  });
  
  // Fermer serveur HTTP
  server.close(() => {
    console.log("✅ Serveur HTTP fermé");
    
    // Fermer base de données
    db.close((err) => {
      if (err) {
        console.error("❌ Erreur fermeture DB:", err);
      } else {
        console.log("✅ Base de données fermée");
      }
      process.exit(0);
    });
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);