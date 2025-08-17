import axios from "axios";

const API_BASE = "http://localhost:5000";

// Add axios configuration for browser
const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const startScan = async (repoUrl) => {
  const res = await axiosInstance.post('/start-scan', { repo_url: repoUrl });
  return res.data;
};

export const getScanResults = async (scanId) => {
  const res = await axiosInstance.get(`/scan-status/${scanId}`);
  return res.data;
};
