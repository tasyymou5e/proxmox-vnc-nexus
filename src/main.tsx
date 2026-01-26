import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Proxmox VNC Nexus - Connection Broker Application
// Build version for cache invalidation
const BUILD_VERSION = "2026-01-26T23:20:00Z";
console.log(`Proxmox VNC Nexus v${BUILD_VERSION}`);

createRoot(document.getElementById("root")!).render(<App />);
