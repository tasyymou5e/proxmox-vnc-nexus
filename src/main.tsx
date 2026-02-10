import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Proxmox VNC Nexus - Connection Broker Application
// Build version injected at compile time by Vite (see vite.config.ts)
declare const __BUILD_VERSION__: string;
console.log(`Proxmox VNC Nexus v${__BUILD_VERSION__}`);

createRoot(document.getElementById("root")!).render(<App />);
