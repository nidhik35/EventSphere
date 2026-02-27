# HTTP Request Flow Diagrams

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL NETWORK (Internet)                        │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                            HTTP Request on Port 80
                                        │
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOCKER CONTAINER NETWORK                                 │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  NGINX REVERSE PROXY (Port 80)                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │ REQUEST ROUTER                                                 │  │  │
│  │  │                                                                │  │  │
│  │  │ location / ──────────────> Static Files                        │  │  │
│  │  │ (HTML, CSS, JS)           /usr/share/nginx/html                │  │  │
│  │  │                                                                │  │  │
│  │  │ location ~ ^/(events|...) ──> Node.js Upstream                │  │  │
│  │  │ (API Endpoints)              http://app:3000                  │  │  │
│  │  │                                                                │  │  │
│  │  │ location ~/\. ────────────> DENY (403)                         │  │  │
│  │  │ (Hidden Files)                                                │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                         │  │
│  └──────────────────┬──────────────────────────────────┬──────────────────┘  │
│                     │                                  │                     │
│          Frontend Routes                    API Routes                      │
│                     │                                  │                     │
│                     ↓                                  ↓                     │
│          ┌─────────────────┐                ┌─────────────────────┐        │
│          │ /index.html     │                │ Node.js Express     │        │
│          │ /css/styles.css │    (cached)    │ (app:3000)          │        │
│          │ /js/main.js     │    (1 hour)    │ • GET /events       │ NO     │
│          └─────────────────┘                │ • POST /events      │ CACHE  │
│                                             │ • PUT /events/:id   │        │
│                                             │ • DELETE /events/:id│        │
│                                             │ • POST /register    │        │
│                                             │ • GET /registrations│        │
│                                             └────────┬────────────┘        │
│                                                      │                     │
│                                                      ↓                     │
│                                             ┌─────────────────┐           │
│                                             │ MongoDB         │           │
│                                             │ (mongo:27017)   │           │
│                                             │ Internal Only   │           │
│                                             └─────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Request Flows

### Flow 1: Static Frontend Asset Request

```
USER ACTION: Click on EventSphere link
             ↓
BROWSER:     GET http://localhost/
             Host: localhost
             User-Agent: Mozilla/5.0
             ↓
NETWORK:     Packet → Internet → Port 80
             ↓
NGINX:       Listen on 0.0.0.0:80
             ├─ Check location blocks
             └─ Match: location / (SPA frontend)
             ↓
NGINX:       Check try_files $uri $uri/ /index.html
             ├─ $uri = "/"
             ├─ Check: /usr/share/nginx/html/ (directory) ✓ FOUND
             └─ Serve: /usr/share/nginx/html/index.html
             ↓
NGINX:       Add Response Headers:
             ├─ HTTP/1.1 200 OK
             ├─ Cache-Control: public, max-age=3600
             ├─ Content-Type: text/html; charset=utf-8
             ├─ Content-Length: 5432
             ├─ X-Content-Type-Options: nosniff
             ├─ X-Frame-Options: SAMEORIGIN
             └─ X-XSS-Protection: 1; mode=block
             ↓
BROWSER:     Receives HTML (5432 bytes)
             ├─ Parse HTML
             ├─ Requests /css/styles.css
             ├─ Requests /js/main.js
             ├─ Requests /js/event.js
             ├─ Requests /js/admin.js
             └─ All return with 200 OK + cache headers
             ↓
BROWSER:     Renders UI
             ├─ CSS applied
             ├─ JavaScript executed
             └─ Page interactive

             [User sees: Event list, register button, etc.]
```

### Flow 2: API GET Request

```
USER ACTION: Click "View Events" button
             ↓
JAVASCRIPT:  fetch('http://localhost/events')
             .then(r => r.json())
             .then(data => updateUI(data))
             ↓
BROWSER:     GET http://localhost/events
             Host: localhost
             Accept: application/json
             Origin: http://localhost  ← CORS header
             ↓
NETWORK:     Packet → (local network) → Port 80
             ↓
NGINX:       Listen on 0.0.0.0:80
             ├─ Check location blocks
             └─ Match: location ~ ^/(events|register|registrations|health)
             ↓
NGINX:       Check if OPTIONS (CORS preflight)?
             └─ No, it's GET request
             ↓
NGINX:       Prepare proxy request to upstream 'eventsphere_app'
             ├─ Add header: X-Real-IP: 127.0.0.1
             ├─ Add header: X-Forwarded-For: 127.0.0.1
             ├─ Add header: X-Forwarded-Proto: http
             └─ Forward to: http://app:3000/events
             ↓
DOCKER DNS: Resolve 'app' → 172.20.0.3 (app container IP)
             ↓
TCP:         Connect from Nginx to app:3000 (keep-alive pooled)
             ↓
EXPRESS:     Receive GET /events
             ├─ Route handler: app.use('/events', eventsRouter)
             ├─ routes/events.js: GET / → listEvents()
             ├─ Query MongoDB: db.events.find({})
             └─ Return: [ {_id, title, date, ...}, {...}, ... ]
             ↓
MONGOOSE:    Convert MongoDB documents to JSON
             ↓
EXPRESS:     Send Response:
             ├─ HTTP/1.1 200 OK
             ├─ Content-Type: application/json
             ├─ Content-Length: 1024
             └─ Body: [{"_id": "507f...", "title": "Event 1", ...}, ...]
             ↓
NGINX:       Receive response from app:3000
             ├─ Add headers:
             │  ├─ Access-Control-Allow-Origin: *
             │  ├─ Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
             │  ├─ Access-Control-Allow-Headers: Content-Type, Authorization
             │  ├─ Cache-Control: no-cache, no-store, must-revalidate
             │  ├─ X-Content-Type-Options: nosniff
             │  ├─ X-Frame-Options: SAMEORIGIN
             │  └─ X-XSS-Protection: 1; mode=block
             └─ Forward to browser
             ↓
BROWSER:     Receive full response (1024 bytes + headers)
             ├─ Check CORS headers: ✓ Access allowed
             ├─ Parse JSON
             └─ Call: updateUI(data)
             ↓
JAVASCRIPT:  Update DOM
             ├─ Create event list items
             ├─ Insert into DOM
             └─ Apply CSS classes
             ↓
BROWSER:     Re-render page
             └─ User sees: Updated event list

             [Display: "Robotics Challenge 2026", "AI Hackathon", etc.]
```

### Flow 3: API POST Request (Create Event)

```
USER ACTION: Click "Add Event" → Submit form
             ↓
FORM DATA:   {
               title: "New Event",
               date: "2026-03-15",
               location: "Hall A",
               description: "Tech Summit"
             }
             ↓
JAVASCRIPT:  const options = {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify(formData)
             }
             fetch('http://localhost/events', options)
             ↓
BROWSER:     Issues CORS preflight first
             (See Flow 4 below)
             ↓
BROWSER:     After preflight approval, sends POST
             ├─ POST http://localhost/events
             ├─ Content-Type: application/json
             ├─ Content-Length: 87
             ├─ Origin: http://localhost
             └─ Body: {"title": "New Event", ...}
             ↓
NGINX:       Listen on 0.0.0.0:80
             ├─ Match: location ~ ^/(events|...)
             └─ Forward to: http://app:3000/events
             ↓
EXPRESS:     Receive POST /events
             ├─ Body parser: Parse JSON → JavaScript object
             ├─ Route handler: routes/events.js: POST /
             ├─ Validation: title, date, location, description
             │  └─ Check all required fields present
             │
             └─ Create Model:
                ├─ new Event({
                │    title: "New Event",
                │    date: new Date("2026-03-15"),
                │    location: "Hall A",
                │    description: "Tech Summit"
                │  })
                │
                └─ Save to database:
                   ↓
MONGODB:     Save document
             ├─ Generate ObjectId: 507f1f77bcf86cd799439011
             ├─ Insert: {_id: ObjectId(...), title, date, location, ...}
             ├─ Write acknowledgement
             └─ Return document with _id
             ↓
EXPRESS:     Build response
             ├─ HTTP/1.1 201 Created
             ├─ Content-Type: application/json
             ├─ Location: /events/507f1f77bcf86cd799439011
             └─ Body: {...full event object with _id...}
             ↓
NGINX:       Add CORS + cache headers
             ├─ Access-Control-Allow-Origin: *
             └─ Cache-Control: no-cache, no-store
             ↓
BROWSER:     Receive 201 Created + event object
             ├─ JavaScript processes response
             ├─ Add new event to page
             ├─ Clear form
             └─ Show success message
             ↓
USER SEES:   "Event created successfully!"
             New event appears in the list
```

### Flow 4: CORS Preflight (OPTIONS) Request

```
BROWSER:     Detects cross-origin POST request
             ├─ Is it simple request? No
             ├─ Method is POST? Yes
             ├─ Custom headers? Yes (Content-Type)
             └─ → Must send preflight
             ↓
BROWSER:     Send automatic OPTIONS request
             ├─ OPTIONS http://localhost/events
             ├─ Host: localhost
             ├─ Origin: http://localhost
             ├─ Access-Control-Request-Method: POST
             ├─ Access-Control-Request-Headers: content-type
             └─ No body
             ↓
NGINX:       Listen on 0.0.0.0:80
             ├─ Match: location ~ ^/(events|...)
             ├─ Check: $request_method = OPTIONS
             └─ YES → Handle immediately
             ↓
NGINX:       Return preflight response
             ├─ HTTP/1.1 204 No Content
             │  (204 = success, no content)
             │
             ├─ Headers:
             │  ├─ Access-Control-Allow-Origin: *
             │  ├─ Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
             │  ├─ Access-Control-Allow-Headers: Content-Type, Authorization
             │  └─ Content-Length: 0 (no body)
             │
             └─ NO BACKEND CALL (fast, direct from Nginx!)
             ↓
BROWSER:     Receive preflight response
             ├─ Check CORS headers:
             │  ├─ Origin allowed? ✓ Yes (*)
             │  ├─ Method allowed? ✓ Yes (POST in list)
             │  └─ Headers allowed? ✓ Yes (Content-Type in list)
             │
             └─ → Preflight PASSED
             ↓
BROWSER:     Now allowed to send actual POST
             └─ Proceed with original request (Flow 3)

NOTE: For simple requests (GET with no custom headers),
      no OPTIONS preflight is needed - browser sends directly.
```

### Flow 5: Hidden File Blocking

```
ATTACKER:    curl http://localhost/.env
             GET /.env
             ↓
NGINX:       Listen on 0.0.0.0:80
             ├─ Check location blocks:
             │  ├─ location / ? → No
             │  ├─ location ~ ^/(events|...) ? → No
             │  └─ location ~ /\. ? → YES (regex match)
             │       (/ followed by dot)
             │
             ├─ Action: deny all
             └─ Response: HTTP/1.1 403 Forbidden
             ↓
ATTACKER:    Receives:
             ├─ 403 Forbidden
             ├─ Body: empty (or "403 Forbidden")
             └─ Logging disabled (no record)
             ↓
RESULT:      ".env file not accessible"
             (Credentials safe ✓)

SIMILARLY:   
             curl http://localhost/node_modules/package.json
             ├─ Match: location ~ /(node_modules|\.env|package\.json)
             ├─ Action: deny all
             └─ Response: 403 Forbidden
             ↓
RESULT:      "Dependency information safe" ✓
```

---

## Request Path Decision Tree

```
REQUEST ARRIVES ON PORT 80
│
├─ HTTP Method & Path
│
├─→ GET /
│   ├─ Location match: location /
│   ├─ Action: Serve /usr/share/nginx/html/index.html
│   ├─ Cache: 1 hour
│   └─ Response: 200 OK + HTML

├─→ GET /css/styles.css
│   ├─ Location match: location /
│   ├─ Action: Serve /usr/share/nginx/html/css/styles.css
│   ├─ Cache: 1 hour
│   └─ Response: 200 OK + CSS

├─→ GET /js/main.js
│   ├─ Location match: location /
│   ├─ Action: Serve /usr/share/nginx/html/js/main.js
│   ├─ Cache: 1 hour
│   └─ Response: 200 OK + JavaScript

├─→ GET /events
│   ├─ Location match: location ~ ^/(events|...)
│   ├─ Method is OPTIONS? No
│   ├─ Action: proxy_pass http://app:3000
│   ├─ Cache: None
│   └─ Response: 200 OK + JSON (+ CORS headers)

├─→ POST /events
│   ├─ Preflight (OPTIONS)? → Send 204 (see Flow 4)
│   ├─ Location match: location ~ ^/(events|...)
│   ├─ Action: proxy_pass http://app:3000
│   ├─ Cache: None
│   └─ Response: 201 Created + JSON (+ CORS headers)

├─→ OPTIONS /events (preflight)
│   ├─ Location match: location ~ ^/(events|...)
│   ├─ Check: $request_method = OPTIONS
│   ├─ Action: Return 204 immediately
│   ├─ Backend: NO CALL (stays in Nginx)
│   └─ Response: 204 No Content + CORS headers

├─→ GET /.env
│   ├─ Location match: location ~ /\.
│   ├─ Action: deny all
│   ├─ Logging: Off (not recorded)
│   └─ Response: 403 Forbidden

├─→ GET /node_modules/index.js
│   ├─ Location match: location ~ /(node_modules|...)
│   ├─ Action: deny all
│   ├─ Logging: Off
│   └─ Response: 403 Forbidden

└─→ GET /unknown-path
   ├─ Location match: location / (fallback)
   ├─ try_files checks
   │  ├─ File exists? No
   │  ├─ Directory exists? No
   │  └─ Fallback: /index.html
   │
   ├─ Action: Serve /usr/share/nginx/html/index.html
   ├─ Cache: 1 hour
   ├─ Browser: JavaScript router handles /unknown-path
   └─ Response: 200 OK + HTML (SPA handles routing)
```

---

## Port Usage Summary

```
┌───────────────────────────────────────────────────────────────┐
│ PORT 80 (HTTP)                                                │
├───────────────────────────────────────────────────────────────┤
│ Service:  Nginx Reverse Proxy                                 │
│ Exposed:  YES (0.0.0.0:80)                                    │
│ External: YES                                                 │
│ Users:    External clients, browsers, API tools              │
│ Traffic:  ← Inbound requests → Outbound responses             │
└───────────────────────────────────────────────────────────────┘
                        ↓ proxy_pass
┌───────────────────────────────────────────────────────────────┐
│ PORT 3000 (HTTP Internal)                                     │
├───────────────────────────────────────────────────────────────┤
│ Service:  Node.js Express Application                         │
│ Exposed:  NO (internal Docker only)                           │
│ External: NO (firewall blocks)                                │
│ Users:    Nginx only (via Docker DNS 'app')                   │
│ Traffic:  ← Requests from Nginx → JSON responses              │
│           (Firewall rule: Block port 3000)                    │
└───────────────────────────────────────────────────────────────┘
                        ↓ MongoDB driver
┌───────────────────────────────────────────────────────────────┐
│ PORT 27017 (BSON Internal)                                    │
├───────────────────────────────────────────────────────────────┤
│ Service:  MongoDB Database                                    │
│ Exposed:  NO (internal Docker only)                           │
│ External: NO (firewall blocks)                                │
│ Users:    Node.js app only (via Docker DNS 'mongo')           │
│ Traffic:  ← BSON queries → Document responses                 │
│           (Firewall rule: Block port 27017)                   │
└───────────────────────────────────────────────────────────────┘
```

---

## Security Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                    THE INTERNET                         │
└─────────────────────────────────────────────────────────┘
                      ↑ ↓ Port 80
        ××××××××××××××FIREWALL××××××××××××××
              Allow: Port 80
              Block: Port 3000
              Block: Port 27017
        ××××××××××××××BOUNDARY××××××××××××××
│
├─ ┌─────────────────────────────────────────────────────┐
│  │  Host Computer (Docker Host)                        │
│  │                                                     │
│  │  ┌────────────────────────────────────────────────┐ │
│  │  │  Docker Container Network (isolated)           │ │
│  │  │                                                │ │
│  │  │  [Nginx] ← Accessible from outside  port 80   │ │
│  │  │     ↓                                          │ │
│  │  │  [App (Node.js)] ← Hidden from outside port→  │ │
│  │  │  (communication via internal Docker DNS)      │ │
│  │  │     ↓                                          │ │
│  │  │  [MongoDB] ← Hidden from outside         ↓    │ │
│  │  │  (communication via internal container)       │ │
│  │  │                                                │ │
│  │  │  Only Nginx can receive external traffic      │ │
│  │  │  Only Nginx can talk to App                   │ │
│  │  │  Only App can talk to MongoDB                 │ │
│  │  │                                                │ │
│  │  └────────────────────────────────────────────────┘ │
│  │                                                     │
│  └─────────────────────────────────────────────────────┘
│
└─ Windows Firewall prevents direct access to ports 3000, 27017
```

---

## Performance Characteristics

```
REQUEST TYPE          HANDLER    CACHING     BACKEND CALL   LATENCY
─────────────────────────────────────────────────────────────────────
GET /                 Nginx      1 hour      No             <10ms
GET /css/styles.css   Nginx      1 hour      No             <1ms
GET /js/main.js       Nginx      1 hour      No             <1ms

GET /events           Nginx+App  None        Yes (MongoDB)  5-50ms
POST /events          Nginx+App  None        Yes (MongoDB)  10-100ms
PUT /events/:id       Nginx+App  None        Yes (MongoDB)  10-100ms
DELETE /events/:id    Nginx+App  None        Yes (MongoDB)  10-100ms

OPTIONS /events       Nginx      N/A         No             <1ms
(CORS Preflight)      (only)     (cached)    (Nginx only)   (super fast!)

GET /.env             Nginx      —           No             <1ms
(blocked)             (deny)     (N/A)       (blocked)      (firewall)
```

---

**Last Updated**: February 27, 2026
