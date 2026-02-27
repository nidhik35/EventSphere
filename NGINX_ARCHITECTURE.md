# EventSphere Reverse Proxy & Security Architecture

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [HTTP Routing Flow](#http-routing-flow)
3. [Server Block Configuration](#server-block-configuration)
4. [Port Exposure Decisions](#port-exposure-decisions)
5. [Firewall Rules](#firewall-rules)
6. [Security Hardening](#security-hardening)

---

## Architecture Overview

The EventSphere application uses a **reverse proxy pattern** with Nginx as the entry point. This design provides:

- **Single point of entry**: All external traffic flows through port 80
- **Request routing**: Nginx intelligently routes requests to the appropriate backend
- **Static file serving**: Frontend assets served efficiently from Nginx
- **API proxying**: Dynamic API requests forwarded to Node.js/Express backend
- **Security isolation**: Internal services hidden from direct external access

### System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL NETWORK                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ Port 80 (HTTP)
                             │ 0.0.0.0:80 → nginx:80
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX REVERSE PROXY                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Port 80 Listening (default_server)                        │ │
│  │  Server Name: _ (catch-all)                                │ │
│  └────────────────┬─────────────────────────────────────────┘ │
│                   │ HTTP Request Router                         │
│    ┌──────────────┼──────────────┐                             │
│    │              │              │                             │
│    ↓              ↓              ↓                             │
│  /static  /events, /register   /health                         │
│   /css    /registrations        checks                         │
│   /js                                                           │
│   │              │              │                             │
│    ↓              ↓              ↓                             │
│  [Serve from]    [Proxy to]    [Proxy to]                      │
│  /usr/share/     app:3000      app:3000                        │
│  nginx/html                                                    │
└─────────────────────────────────────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ↓                ↓                ↓
      ┌─────────┐      ┌─────────────┐  ┌──────────┐
      │  Nginx  │      │   Node.js   │  │ MongoDB  │
      │ Service │      │   Express   │  │ Service  │
      │(Port 80)│      │(Port 3000)  │  │(Port     │
      └─────────┘      │(Internal)   │  │ 27017)   │
                       └─────────────┘  │(Internal)│
                                        └──────────┘
   ↑                      ↑               ↑
   │ exposed             hidden from     hidden from
   │ only               external access  external access
```

---

## HTTP Routing Flow

### Complete Request/Response Cycle

#### Scenario 1: Frontend Asset Request (e.g., `GET /index.html`)

```
1. CLIENT REQUEST
   ┌─────────────────────────────────────────┐
   │ GET / HTTP/1.1                          │
   │ Host: localhost:80                      │
   │ User-Agent: Mozilla/5.0                 │
   └─────────────────────────────────────────┘
                  ↓
2. NGINX RECEIVES (Port 80)
   ├─ Matches location / (frontend routing)
   └─ Checks file system: /usr/share/nginx/html/index.html
                  ↓
3. FILE FOUND
   ├─ Apply cache headers (Cache-Control: max-age=3600)
   └─ Apply security headers (X-Content-Type-Options: nosniff, etc.)
                  ↓
4. NGINX RESPONSE
   ┌─────────────────────────────────────────┐
   │ HTTP/1.1 200 OK                         │
   │ Cache-Control: max-age=3600             │
   │ X-Content-Type-Options: nosniff         │
   │ Content-Length: 5432                    │
   │ Content-Type: text/html                 │
   │                                         │
   │ <!DOCTYPE html>                         │
   │ <html>                                  │
   │ ...                                     │
   └─────────────────────────────────────────┘
                  ↓
5. BROWSER RENDERS
   ├─ Parses HTML (index.html)
   ├─ Loads CSS from /css/styles.css
   ├─ Loads JS from /js/main.js
   └─ JavaScript takes over client-side routing
```

#### Scenario 2: API Request (e.g., `POST /events`)

```
1. CLIENT REQUEST (from JavaScript)
   ┌──────────────────────────────────────────────┐
   │ POST /events HTTP/1.1                        │
   │ Host: localhost:80                           │
   │ Content-Type: application/json               │
   │ Content-Length: 234                          │
   │                                              │
   │ {"title": "Tech Summit", "date": "..."}      │
   └──────────────────────────────────────────────┘
                  ↓
2. NGINX RECEIVES + ROUTE DECISION
   ├─ Checks location blocks in order:
   │  ├─ location / ? → No (not /events)
   │  └─ location ~ ^/(events|...)? → YES
   │
   ├─ Prepares proxy request:
   │  ├─ Set X-Real-IP: <client-ip>
   │  ├─ Set X-Forwarded-For: <client-ip>
   │  └─ Set X-Forwarded-Proto: http
   └─ Forward to upstream 'eventsphere_app'
                  ↓
3. CONNECT TO BACKEND
   ├─ Target: http://app:3000 (internal Docker network)
   ├─ HTTP/1.1 with Connection pooling
   └─ TCP connection reused if possible
                  ↓
4. NODE.JS EXPRESS RECEIVES
   └─ app.js::app.use('/events', eventsRouter)
      └─ routes/events.js::POST /events
         └─ Create new Event in MongoDB
            └─ Return: { _id, title, date, ... }
                  ↓
5. BACKEND RESPONSE
   ┌──────────────────────────────────────────────┐
   │ HTTP/1.1 201 Created                         │
   │ Content-Type: application/json               │
   │ Content-Length: 342                          │
   │                                              │
   │ {"_id": "507f...", "title": "Tech Summit"... │
   └──────────────────────────────────────────────┘
                  ↓
6. NGINX ADDS HEADERS + PROXIES BACK
   ├─ Adds CORS headers (Access-Control-Allow-Origin: *)
   ├─ Adds cache control (no-cache, no-store)
   └─ Forward response to client
                  ↓
7. CLIENT RESPONSE
   ┌──────────────────────────────────────────────┐
   │ HTTP/1.1 201 Created                         │
   │ Access-Control-Allow-Origin: *               │
   │ Cache-Control: no-cache, no-store            │
   │ X-Content-Type-Options: nosniff              │
   │ X-Frame-Options: SAMEORIGIN                  │
   │                                              │
   │ {"_id": "507f...", "title": "Tech Summit"... │
   └──────────────────────────────────────────────┘
                  ↓
8. JAVASCRIPT PROCESSES
   └─ Receives response, updates UI
      └─ Displays new event in the list
```

#### Scenario 3: CORS Preflight Request (e.g., `OPTIONS /events`)

```
Browser automatically sends OPTIONS before POST/PUT/DELETE to different origins:

1. BROWSER SENDS PREFLIGHT
   ┌──────────────────────────────────────────────┐
   │ OPTIONS /events HTTP/1.1                     │
   │ Host: localhost:80                           │
   │ Origin: http://localhost:3000                │
   │ Access-Control-Request-Method: POST          │
   │ Access-Control-Request-Headers: content-type │
   └──────────────────────────────────────────────┘
                  ↓
2. NGINX MATCHES
   └─ Regex: ~ ^/(events|register|registrations|health)
      └─ Detects $request_method = OPTIONS
                  ↓
3. NGINX RESPONSES IMMEDIATELY (no backend call)
   ┌──────────────────────────────────────────────┐
   │ HTTP/1.1 204 No Content                      │
   │ Access-Control-Allow-Origin: *               │
   │ Access-Control-Allow-Methods: GET, POST, ...  │
   │ Access-Control-Allow-Headers: Content-Type   │
   │ Content-Length: 0                            │
   └──────────────────────────────────────────────┘
                  ↓
4. BROWSER CHECKS ALLOWED
   └─ CORS headers permit POST? YES
      └─ Browser sends actual POST request
```

---

## Server Block Configuration

The Nginx configuration is structured into logical blocks:

### Block 1: Upstream Definition
```nginx
upstream eventsphere_app {
  server app:3000;           # Internal DNS to Node.js service
  keepalive 16;              # Connection pool size for efficiency
}
```
**Purpose**: Define how Nginx connects to the backend. Uses Docker's internal DNS (`app` resolves to the app service). Connection pooling reduces TCP handshake overhead.

### Block 2: Main Server Block
```nginx
server {
  listen 80 default_server;        # Listen on all IPs, port 80
  listen [::]:80 default_server;   # Also listen on IPv6
  server_name _;                   # Catch-all hostname
```
**Purpose**: Accept HTTP traffic on port 80. The `_` hostname means this server handles any request that doesn't match other server blocks.

### Block 3: Global Security Headers
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```
**Purpose**: Applied to ALL responses (frontend and API).
- `X-Content-Type-Options: nosniff` – Prevents MIME-type sniffing attacks
- `X-Frame-Options: SAMEORIGIN` – Prevents clickjacking (don't embed in iframes)
- `X-XSS-Protection` – Legacy XSS filter (modern browsers use CSP instead)
- `Referrer-Policy` – Control what referrer info is sent to other sites

### Block 4: Frontend Location (/)
```nginx
location / {
  root /usr/share/nginx/html;
  try_files $uri $uri/ /index.html;   # SPA fallback
  expires 1h;
  add_header Cache-Control "public, max-age=3600, must-revalidate";
}
```

**Request Flow**:
1. Request: `GET /page/about`
2. Check: Does `/page/about` exist as a file? No
3. Check: Does `/page/about/` exist as a directory? No
4. Fallback: Serve `/index.html` (the SPA entry point)
5. Browser: JavaScript frontend handles `/page/about` routing

**Why `/index.html` fallback?** 
- Modern SPAs (React, Vue, Angular) handle all routing in JavaScript
- Nginx can't know about JavaScript routes, so anything not found → fallback to index.html
- The client-side app then routes based on the URL

**Cache Headers**:
- `public`: Proxies and browsers can cache
- `max-age=3600`: Cache for 1 hour (3600 seconds)
- `must-revalidate`: After 1h, browser must check with server before using cached version

### Block 5: API Location (Regex Pattern)
```nginx
location ~ ^/(events|register|registrations|health) {
  proxy_pass http://eventsphere_app;
  proxy_http_version 1.1;
  proxy_set_header Connection "";    # Enable keep-alive
  
  # Forward client info to backend
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  
  # CORS headers
  add_header 'Access-Control-Allow-Origin' '*' always;
  
  # No caching for API
  add_header Cache-Control "no-cache, no-store, must-revalidate" always;
  
  # Handle CORS preflight
  if ($request_method = 'OPTIONS') { return 204; }
}
```

**Regex Details**:
- `~` means regex match (case-sensitive)
- `^` means start of string
- `/(events|register|registrations|health)` matches any of these paths
- This pattern catches all API-related requests

**Proxy Headers**:
- `X-Real-IP`: Tells backend the client's real IP (not Nginx's)
- `X-Forwarded-For`: Adds client IP to a list (useful when proxies are chained)
- `X-Forwarded-Proto`: Tells backend the original protocol (http vs https)

**Why empty `Connection` header?**
- Removes the `Connection: close` that would normally be sent
- Allows keep-alive to work, reusing TCP connections
- Improves performance for > sequential API requests

### Block 6: Security (Block Sensitive Files)
```nginx
location ~ /\. {
  deny all;
  access_log off;
}

location ~ /(node_modules|\.env|package\.json) {
  deny all;
  access_log off;
}
```
**Purpose**: Prevent accidental exposure of:
- Hidden files (`.git`, `.env`, `.htaccess`, etc.)
- Node.js dependencies (`node_modules`)
- Configuration files (`package.json`, `Dockerfile`)
- Seed scripts

---

## Port Exposure Decisions

### Port 80 (HTTP) - EXPOSED ✅

| Aspect | Decision | Justification |
|--------|----------|---------------|
| **Exposed** | YES | Only port users interact with |
| **External** | YES | Internet traffic accepted here |
| **Protocol** | HTTP | Non-encrypted (use HTTPS in production) |
| **Why only this?** | Single responsibility | All traffic flows through one point |

**Use Cases**:
- Direct browser access: `http://localhost/`
- API calls from frontend JavaScript
- External API clients (if applicable)
- Load balancer health checks

**Security Implications**:
- HTTP traffic is unencrypted (plaintext)
- No authentication at Nginx level (deferred to application)
- HTTPS should be added for production

---

### Port 3000 (Node.js) - HIDDEN ✅

| Aspect | Decision | Justification |
|--------|----------|---------------|
| **Exposed** | NO | Not in docker-compose ports mapping |
| **External** | NO | Only accessible within Docker network |
| **Protocol** | HTTP | Internal only |
| **Accessible From** | Only Nginx container |  N/A from host or internet |

**Why hide it?**
- Direct access bypasses Nginx routing and security headers
- No CORS handling if client connects directly
- Prevents users from accidentally accessing unstable backend API
- Security: Backend implementation details hidden

---

### Port 27017 (MongoDB) - HIDDEN ✅

| Aspect | Decision | Justification |
|--------|----------|---------------|
| **Exposed** | NO | Not in docker-compose ports mapping |
| **External** | NO | Only accessible within Docker network |
| **Authentication** | None configured | Internal-only is sufficient for demo |
| **Why hide?** | Database should never be directly accessible |  Prevents data theft, injection attacks |

**Security**: In production, you'd encrypt with username/password.

---

## Firewall Rules

### Windows Firewall Configuration

#### Rule 1: Allow HTTP (Port 80) - Inbound

```powershell
# PowerShell (Admin) to allow port 80
New-NetFirewallRule -DisplayName "Allow HTTP (EventSphere)" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 80 `
  -Profile Domain,Private,Public `
  -Description "Allow inbound HTTP traffic for EventSphere Nginx"

# Verify
Get-NetFirewallRule -DisplayName "Allow HTTP (EventSphere)" | Get-NetFirewallPortFilter
```

**Justification**:
- Necessary for external access to the web application
- Nginx listens on 0.0.0.0:80 (all interfaces)
- Users expect port 80 for HTTP
- HTTPS (port 443) should be added in production

---

#### Rule 2: Block Port 3000 - Inbound ✅

```powershell
# Block external access to Node.js port
New-NetFirewallRule -DisplayName "Block Node.js Backend (EventSphere)" `
  -Direction Inbound `
  -Action Block `
  -Protocol TCP `
  -LocalPort 3000 `
  -Profile Domain,Private,Public `
  -Description "Block inbound traffic to Node.js backend"

# Verify
Get-NetFirewallRule -DisplayName "Block Node.js Backend (EventSphere)"
```

**Justification**:
- Docker exposes 3000 to localhost only in compose file
- Firewall rule provides additional defense-in-depth
- Prevents bypass if Nginx crashes
- Forces all traffic through Nginx proxy

---

#### Rule 3: Block Port 27017 (MongoDB) - Inbound ✅

```powershell
# Block external access to MongoDB
New-NetFirewallRule -DisplayName "Block MongoDB (EventSphere)" `
  -Direction Inbound `
  -Action Block `
  -Protocol TCP `
  -LocalPort 27017 `
  -Profile Domain,Private,Public `
  -Description "Block inbound traffic to MongoDB database"

# Verify
Get-NetFirewallRule -DisplayName "Block MongoDB (EventSphere)"
```

**Justification**:
- Databases should NEVER be directly accessible from the internet
- Even with auth disabled, prevents data exfiltration
- Prevents injection attacks directly against database
- Defense-in-depth security principle

---

#### Rule 4: Allow Docker to Docker Communication (Optional)

```powershell
# If Docker runs elevated, allow internal communication
New-NetFirewallRule -DisplayName "Allow Docker Internal (EventSphere)" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 3000,27017 `
  -LocalAddress 127.0.0.1 `
  -Profile Domain,Private `
  -Description "Allow localhost-only access to backend services"
```

**Justification**:
- Docker containers on Windows run in Hyper-V VM
- Internal communication from localhost is safe
- Allows `docker-compose exec` commands to work

---

### Linux/Production Firewall (iptables/ufw)

If deploying on Linux:

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 80/tcp comment "HTTP - Nginx" sudo ufw allow 443/tcp comment "HTTPS - Nginx"
sudo ufw deny 3000/tcp comment "Node.js backend"
sudo ufw deny 27017/tcp comment "MongoDB database"
sudo ufw default deny incoming
sudo ufw enable

# Or using iptables
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j DROP
sudo iptables -A INPUT -p tcp --dport 27017 -j DROP
```

---

## Security Hardening

### 1. Reverse Proxy Benefits

| Benefit | How Nginx Provides It |
|---------|----------------------|
| **Single entry point** | All traffic on port 80 only |
| **Hide backend topology** | Internal services not exposed |
| **SSL termination** | HTTPS encryption in Nginx (if configured) |
| **Load balancing** | Can route to multiple backends (future) |
| **Request filtering** | Block malicious requests before backend |
| **Compression** | gzip responses to reduce bandwidth |

---

### 2. Security Headers Explained

```nginx
# Prevents browser from changing Content-Type (prevents MIME sniffing)
# Example: don't treat .js as .html
add_header X-Content-Type-Options "nosniff" always;

# Prevents embedding this site in <iframe> on other domains
# Stops clickjacking attacks
add_header X-Frame-Options "SAMEORIGIN" always;

# Legacy XSS protection (modern browsers use CSP)
# Tells IE/older Chrome to block suspected XSS
add_header X-XSS-Protection "1; mode=block" always;

# Controls referrer information sent to other sites
# "strict-origin-when-cross-origin" = only send origin on same-site
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

### 3. File Access Control

```nginx
# Deny all requests to hidden files (., .env, .git)
location ~ /\. {
  deny all;
  access_log off;
  log_not_found off;
}

# Deny access to source files and config
location ~ /(node_modules|\.env|package\.json|Dockerfile|seed\.js) {
  deny all;
  access_log off;
  log_not_found off;
}
```

**Why**:
- `.env` contains database credentials – must not be accessible
- `seed.js` contains sample data – prevents bulk operations
- `Dockerfile` reveals infrastructure – prevents reconnaissance
- `package.json` reveals dependencies – prevents vulnerability targeting

---

### 4. CORS Configuration

```nginx
# Allow any origin (permissive, for development)
add_header 'Access-Control-Allow-Origin' '*' always;

# In production, restrict to known domains:
# add_header 'Access-Control-Allow-Origin' 'https://yourdomain.com' always;

# Specific methods allowed
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;

# Specific headers clients can send
add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
```

---

### 5. Cache Control

| Resource Type | Cache Policy | Reason |
|---------------|--------------|--------|
| HTML/CSS/JS | 1 hour | Assets change less frequently, but do change |
| API responses | No cache | Data is dynamic, must be fresh |
| Images | 1 day | Static images can be cached longer |
| Health checks | No cache | Status checks must be current |

---

## Production Checklist

- [ ] Add HTTPS (TLS/SSL certificate)
  ```nginx
  listen 443 ssl http2;
  ssl_certificate /etc/nginx/certs/cert.pem;
  ssl_certificate_key /etc/nginx/certs/key.pem;
  ```

- [ ] Change CORS from `*` to specific domain
  ```nginx
  add_header 'Access-Control-Allow-Origin' 'https://yourdomain.com' always;
  ```

- [ ] Add rate limiting to prevent DDoS
  ```nginx
  limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
  limit_req zone=api burst=20 nodelay;
  ```

- [ ] Enable gzip compression
  ```nginx
  gzip on;
  gzip_types text/plain text/css application/json;
  gzip_min_length 1000;
  ```

- [ ] Add authentication headers for sensitive endpoints
  ```nginx
  # If needed for admin endpoints
  auth_basic "Restricted Area";
  auth_basic_user_file /etc/nginx/.htpasswd;
  ```

- [ ] Configure firewall rules (see Firewall Rules section above)

- [ ] Set environment variable `MONGO_URL` to production database

- [ ] Remove development volume mounts from docker-compose.yml

- [ ] Enable access/error logging and monitoring

---

## Summary: HTTP Routing Decision Tree

```
REQUEST ARRIVES ON PORT 80
    │
    ├─── Is it a file request (/, /css, /js, /index.html)?
    │    Yes → Serve from /usr/share/nginx/html + cache (1h)
    │    No ↓
    │
    ├─── Does path match ^/(events|register|registrations|health)?
    │    Yes → Proxy to app:3000 (Node.js) + no cache
    │    No ↓
    │
    ├─── Is it an OPTIONS request (CORS preflight)?
    │    Yes → Return 204 with CORS headers (no backend call)
    │    No ↓
    │
    ├─── Does path contain hidden files (/.*, /node_modules, /.env)?
    │    Yes → Return 403 Forbidden + block logging
    │    No ↓
    │
    └─── Default fallback
         → Try to serve as static file from /usr/share/nginx/html
         → If not found → serve /index.html (SPA routing)
```

---

**Last Updated**: February 27, 2026
