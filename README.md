# 🔐 Security Vulnerability Scanning System

A complete **Vulns detection solution** for automated vulnerability scanning with a modern dashboard, backend API, and CI/CD integration.  
The system scans GitHub repositories in real-time, aggregates vulnerabilities from **Trivy** and **Snyk**, and provides a web interface for managing and exporting results.

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
- Runs locally on **port 3001** (exposed via **ngrok** for webhook callbacks)

### 🤖 GitHub Actions Pipeline
- Multi-tool security scanning:
  - **Trivy** → OS, dependencies, configs, secrets  
  - **Snyk** → application dependencies  
- Automated detection across repositories
- Intelligent caching for faster runs
- Results delivered back to backend via webhook callbacks

---

## 🔄 Workflow

1. User enters a GitHub repository URL in the **frontend**.  
2. The **backend** triggers the GitHub Actions workflow.  
3. GitHub Actions runs security scans (Trivy + Snyk).  
4. Results are sent back to the backend via webhook.  
5. Backend stores vulnerabilities in the SQLite database.  
6. Frontend displays:
   - Real-time progress updates  
   - Final vulnerability reports  
   - Filtering, grouping, and export options  

---

## 🛠️ Tech Stack

- **Frontend:** React, Tailwind, WebSockets  
- **Backend:** Node.js, Express, SQLite, ngrok  
- **CI/CD:** GitHub Actions  
- **Security Tools:** Trivy, Snyk  

---

## 📦 Deployment

### 1️⃣ Backend
```bash
git clone <this-repo>
cd backend
npm install
node server.js
```
The backend runs on **port 3001**.  
If testing locally, expose it with **ngrok** before node server.js then put the URL gaven on the .env file :
```bash
ngrok http 3001
```

### 2️⃣ Frontend
```bash
cd frontend
npm install
npm run dev
```
The dashboard runs on **http://localhost:3000** by default.

### 3️⃣ GitHub Actions
- Add these secrets in your repository:
  - `SNYK_TOKEN` → for Snyk authentication  
  - `GITHUB_TOKEN` → (default GitHub token, provided automatically)  
- The pipeline will run automatically when triggered by the backend.

---
---

## 📊 Roadmap
- [ ] Add role-based access control (RBAC)  
- [ ] Multi-repo batch scanning  
- [ ] Dashboard analytics & charts  
- [ ] More export formats (PDF, Excel)  

---

## 🤝 Contributing
Contributions are welcome!  
Please open an issue or submit a pull request if you’d like to improve the system.

---

## 📜 License
MIT License — feel free to use, modify, and distribute this project.
