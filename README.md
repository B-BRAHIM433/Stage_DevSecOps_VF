# 🔐 Security Vulnerability Scanning System

A complete **Vulns detection solution** for automated vulnerability scanning with a modern dashboard, backend API, and CI/CD integration.  
The system scans GitHub repositories in real-time, aggregates vulnerabilities from multiple tools, and provides a rich web interface for managing and exporting results.

---

## 🚀 Features

### 🌐 Frontend (React Dashboard)
- Real-time scanning interface with GitHub repository input
- Live scan status tracking (polling + WebSocket updates)
- Vulnerability management:
  - Detailed views
  - Grouping & filtering
  - CSV export
- Dark/light theme support
- Notifications system
- Scan history with advanced search & management

### ⚙️ Backend (Node.js + Express)
- SQLite database storing scans & vulnerabilities
- GitHub Actions integration to trigger scans remotely
- WebSocket support for real-time updates
- RESTful API:
  - Scans
  - Vulnerabilities
  - Stats
  - CSV/JSON exports
- Webhook callback system to receive GitHub Actions results

### 🤖 GitHub Actions Pipeline
- Multi-tool security scanning:
  - **Trivy**
  - **Snyk**
- Automated detection across:
  - Dependencies
  - Source code
  - Config files
  - Secrets
- Intelligent caching for faster runs
- Results delivered back to backend via webhook callbacks

---

## 🔄 Workflow

1. User enters a GitHub repository URL in the **frontend**.  
2. The **backend** triggers the GitHub Actions workflow.  
3. GitHub Actions runs security scans (Trivy, Snyk).  
4. Results are sent back to the backend via webhook.  
5. Backend stores vulnerabilities in the SQLite database.  
6. Frontend shows:
   - Real-time progress updates  
   - Final vulnerability reports  
   - Filtering, grouping, and export options  

---

## 🛠️ Tech Stack

- **Frontend:** React + Tailwind + WebSockets  
- **Backend:** Node.js, Express, SQLite, ngrok (for local webhook exposure on port **3001**)  
- **CI/CD:** GitHub Actions  
- **Security Tools:** Trivy, Snyk  

---

## 📦 Deployment


### 1️⃣ Backend
```bash
git clone <this-repo>
cd backend
npm install
ngrok 3001 http (Then Add the URL to the .env file)
node server.js

### Frontend
cd frontend
npm install 
npm run dev
