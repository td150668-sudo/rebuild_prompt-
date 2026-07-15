/**
 * Web UI HTML page for UniTool Proxy
 */
export function renderDashboard(port: number, uptime: number, version: string): string {
  const uptimeStr = formatUptime(uptime);
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UniTool Proxy Dashboard</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Kanit', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
  color: #333;
}
.container { max-width: 900px; margin: 0 auto; }
.header {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  margin-bottom: 20px;
  text-align: center;
}
.logo {
  font-size: 48px;
  margin-bottom: 8px;
}
.title {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}
.subtitle {
  color: #666;
  font-size: 14px;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #10b981;
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  margin-top: 12px;
}
.status-dot {
  width: 8px; height: 8px;
  background: white;
  border-radius: 50%;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%,100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}
.card:hover { transform: translateY(-2px); }
.card-icon { font-size: 32px; margin-bottom: 12px; }
.card-label { color: #666; font-size: 13px; margin-bottom: 4px; }
.card-value { font-size: 22px; font-weight: 700; color: #1f2937; }
.section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}
.section-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}
.endpoint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 10px;
  margin-bottom: 8px;
  transition: background 0.2s;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}
.endpoint:hover { background: #f3f4f6; }
.endpoint-method {
  background: #10b981;
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  font-family: monospace;
  margin-right: 12px;
}
.endpoint-path {
  font-family: 'SF Mono', Monaco, monospace;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
}
.endpoint-desc {
  font-size: 12px;
  color: #6b7280;
  margin-left: 12px;
}
.arrow { color: #9ca3af; }
.footer {
  text-align: center;
  color: white;
  opacity: 0.8;
  font-size: 13px;
  margin-top: 20px;
}
.footer a { color: white; }
.devices-empty {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
}
.devices-empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
.btn {
  display: inline-block;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 10px 20px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn:hover { opacity: 0.9; }
.info-note {
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: #78350f;
  margin-top: 16px;
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">🚀</div>
    <div class="title">UniTool Proxy</div>
    <div class="subtitle">iOS WebKit Debug Proxy Server</div>
    <div class="status-badge">
      <span class="status-dot"></span>
      Server Running
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-icon">⚡</div>
      <div class="card-label">Version</div>
      <div class="card-value">v${version}</div>
    </div>
    <div class="card">
      <div class="card-icon">⏱️</div>
      <div class="card-label">Uptime</div>
      <div class="card-value">${uptimeStr}</div>
    </div>
    <div class="card">
      <div class="card-icon">🔌</div>
      <div class="card-label">Port</div>
      <div class="card-value">${port}</div>
    </div>
    <div class="card">
      <div class="card-icon">📱</div>
      <div class="card-label">Connected Devices</div>
      <div class="card-value" id="device-count">—</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📡 API Endpoints</div>
    <a href="/api/status" class="endpoint">
      <span class="endpoint-method">GET</span>
      <span class="endpoint-path">/api/status</span>
      <span class="endpoint-desc">Server status</span>
      <span class="arrow">→</span>
    </a>
    <a href="/json" class="endpoint">
      <span class="endpoint-method">GET</span>
      <span class="endpoint-path">/json</span>
      <span class="endpoint-desc">List targets</span>
      <span class="arrow">→</span>
    </a>
    <a href="/json/list" class="endpoint">
      <span class="endpoint-method">GET</span>
      <span class="endpoint-path">/json/list</span>
      <span class="endpoint-desc">Same as /json</span>
      <span class="arrow">→</span>
    </a>
    <a href="/json/version" class="endpoint">
      <span class="endpoint-method">GET</span>
      <span class="endpoint-path">/json/version</span>
      <span class="endpoint-desc">Version info</span>
      <span class="arrow">→</span>
    </a>
    <a href="/refresh" class="endpoint">
      <span class="endpoint-method">GET</span>
      <span class="endpoint-path">/refresh</span>
      <span class="endpoint-desc">Force refresh</span>
      <span class="arrow">→</span>
    </a>
  </div>

  <div class="section">
    <div class="section-title">📱 Connected iOS Devices</div>
    <div id="devices-list" class="devices-empty">
      <div class="devices-empty-icon">📱</div>
      <div>ยังไม่มี iOS device เชื่อมต่อ</div>
      <div style="font-size: 12px; margin-top: 8px;">
        Proxy server รอรับการเชื่อมต่อจาก ios_webkit_debug_proxy
      </div>
    </div>
    <div class="info-note">
      💡 <strong>หมายเหตุ:</strong> Server นี้เป็น proxy relay สำหรับ Chrome DevTools ↔ iOS WebKit
      ต้องรันบน computer ที่เสียบ iPhone/iPad ผ่าน USB ถึงจะเห็น device
      <br>เมื่อ deploy บน Cloud (Render) จะทำงานเป็น API server ได้ แต่ไม่มี iOS device ให้ debug
    </div>
  </div>

  <div class="footer">
    UniTool Proxy · Rebuilt from recovered sources
    <br>
    <a href="https://github.com/td150668-sudo/rebuild_prompt-" target="_blank">📦 GitHub Repository</a>
  </div>
</div>

<script>
// Fetch device count on load
fetch('/json')
  .then(r => r.json())
  .then(devices => {
    document.getElementById('device-count').textContent = devices.length || 0;
    if (devices.length > 0) {
      const list = document.getElementById('devices-list');
      list.className = '';
      list.innerHTML = devices.map(d =>
        '<div class="endpoint"><span class="endpoint-path">' +
        (d.deviceName || d.id || 'Unknown') +
        '</span><span class="endpoint-desc">iOS ' + (d.version || '?') +
        '</span></div>'
      ).join('');
    }
  })
  .catch(() => {
    document.getElementById('device-count').textContent = '0';
  });

// Auto-refresh every 30s
setInterval(() => {
  fetch('/api/status').then(r => r.json()).then(s => {
    if (s.uptime) {
      document.querySelectorAll('.card-value')[1].textContent =
        Math.floor(s.uptime / 60) + 'm ' + (s.uptime % 60) + 's';
    }
  });
}, 30000);
</script>
</body>
</html>`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return seconds + 's';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return m + 'm ' + s + 's';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}
