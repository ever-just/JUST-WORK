# DigitalOcean API Troubleshooting - RAPID EXECUTION PROMPT

## ROLE & CONTEXT
You are an expert DevOps engineer. You prioritize SPEED and RESULTS over perfect analysis. You make quick decisions and execute immediately.

## MISSION STATEMENT
**OBJECTIVE**: Fix the 502 Bad Gateway error on https://just-work.app/api/* endpoints in **15 MINUTES MAX** using rapid execution methodology.

**PROBLEM DEFINITION**: 
- Frontend loads correctly (HTML/CSS/JS served properly)
- ALL API endpoints return 502 Bad Gateway errors
- This prevents the React frontend from loading company data
- Local development environment works perfectly (localhost:5173 + localhost:3001)

**TECHNICAL CONTEXT**:
- **Platform**: DigitalOcean Droplet (Ubuntu)
- **Frontend**: React + Vite (served via nginx)
- **Backend**: Node.js ES modules + Express
- **Database**: PostgreSQL (DigitalOcean managed)
- **Process Manager**: PM2
- **Reverse Proxy**: nginx
- **SSL**: Let's Encrypt

## RAPID EXECUTION FRAMEWORK

**APPROACH**: Skip analysis, execute most likely fixes immediately, test after each.

**MOST LIKELY CAUSES** (in order):
1. **Process hanging** (database connection blocking startup)
2. **Process not running** (crashed during startup)
3. **Wrong port** (not listening on 3000)

## 15-MINUTE EXECUTION PLAN

### STEP 1: RAPID DIAGNOSIS (2 minutes)
```bash
ssh root@198.199.75.168 'echo "=== PM2 STATUS ===" && pm2 status && echo "=== PORT CHECK ===" && netstat -tlnp | grep :3000 && echo "=== CURL TEST ===" && timeout 5 curl -s http://localhost:3000/api/companies?limit=1 || echo "CURL FAILED"'
```

### STEP 2: IMMEDIATE FIX (5 minutes)
**Don't analyze - just execute the most likely fix:**
```bash
# Nuclear restart - kill everything and restart clean
ssh root@198.199.75.168 'pm2 delete all; pkill -f node; sleep 3; cd /var/www/just-work && PORT=3000 pm2 start server/index.js --name just-work-api'
```

### STEP 3: INSTANT TEST (1 minute)
```bash
ssh root@198.199.75.168 'sleep 8 && curl -s http://localhost:3000/api/companies?limit=1 | head -c 100'
```

### STEP 4: IF STILL BROKEN - DATABASE FIX (5 minutes)
```bash
# Create minimal test server without database
ssh root@198.199.75.168 'cat > /var/www/just-work/test-server.js << EOF
import express from "express";
const app = express();
app.get("/api/test", (req, res) => res.json({status: "working", time: new Date()}));
app.listen(3000, () => console.log("Test server running"));
EOF'

# Start test server
ssh root@198.199.75.168 'pm2 delete all && cd /var/www/just-work && pm2 start test-server.js --name test-api'

# Test it
ssh root@198.199.75.168 'sleep 5 && curl http://localhost:3000/api/test'
```

### STEP 5: FINAL VALIDATION (2 minutes)
```bash
# Test live API
curl -s "https://just-work.app/api/companies?limit=1" | head -c 200
```

### PHASE 2: HYPOTHESIS TESTING (10 minutes)
**REASONING**: Test each hypothesis systematically using evidence from Phase 1.

#### A. HYPOTHESIS 1: Process Issues
**TEST**: Verify if the Node.js process is actually responding
```bash
# Test if process responds to basic HTTP requests
ssh root@198.199.75.168 'curl -v --connect-timeout 5 http://localhost:3000/api/companies?limit=1'
ssh root@198.199.75.168 'curl -v --connect-timeout 5 http://localhost:3000/health || echo "NO HEALTH ENDPOINT"'
```
**EXPECTED**: If process is healthy, should return JSON or 404. If hanging, will timeout.

#### B. HYPOTHESIS 2: Port Conflicts  
**TEST**: Verify what's actually listening on port 3000
```bash
ssh root@198.199.75.168 'netstat -tlnp | grep :3000'
ssh root@198.199.75.168 'lsof -i :3000'
```
**EXPECTED**: Should show node process listening on 3000. If empty, process isn't binding to port.

#### C. HYPOTHESIS 3: nginx Misconfiguration
**TEST**: Verify nginx proxy configuration
```bash
ssh root@198.199.75.168 'nginx -t && cat /etc/nginx/sites-enabled/just-work.app | grep -A 10 -B 5 proxy_pass'
```
**EXPECTED**: Should show proxy_pass pointing to localhost:3000 or backend upstream.

#### D. HYPOTHESIS 4: Database Connection Issues
**TEST**: Verify database connectivity independently
```bash
ssh root@198.199.75.168 'cd /var/www/just-work && timeout 10 node -e "
import pg from \"pg\";
const { Pool } = pg;
const pool = new Pool({
  user: \"doadmin\",
  host: \"just-work-db-do-user-24253030-0.f.db.ondigitalocean.com\",
  database: \"justwork\",
  password: \"REDACTED_PASSWORD\",
  port: 25060,
  ssl: { rejectUnauthorized: false }
});
pool.query(\"SELECT COUNT(*) FROM companies LIMIT 1\").then(r => {console.log(\"DB OK:\", r.rows[0]); process.exit(0);}).catch(e => {console.log(\"DB ERROR:\", e.message); process.exit(1);});
"'
```
**EXPECTED**: Should return company count or specific error message. Timeout indicates hanging connection.

#### E. HYPOTHESIS 5: ES Modules Issues
**TEST**: Check if ES modules are causing startup failures
```bash
ssh root@198.199.75.168 'cd /var/www/just-work && cat package.json | grep -E "(type|module)"'
ssh root@198.199.75.168 'cd /var/www/just-work && node --version && npm --version'
```
**EXPECTED**: Should show "type": "module" and compatible Node.js version (14+).

### PHASE 3: ROOT CAUSE ANALYSIS (5 minutes)
**REASONING**: Analyze evidence from Phase 2 to identify the primary failure point.

#### DECISION TREE:
Based on Phase 2 results, follow this decision path:

**IF** Process timeout on curl test:
→ **ROOT CAUSE**: Process hanging (likely database connection issue)
→ **GO TO**: Fix Attempt 3 (Database Connection)

**IF** No process listening on port 3000:
→ **ROOT CAUSE**: Process not binding to port (startup failure)
→ **GO TO**: Fix Attempt 1 (Process Restart)

**IF** nginx config shows wrong proxy_pass:
→ **ROOT CAUSE**: nginx misconfiguration
→ **GO TO**: Fix Attempt 4 (nginx Configuration)

**IF** Database test fails/timeouts:
→ **ROOT CAUSE**: Database connectivity blocking startup
→ **GO TO**: Fix Attempt 3 (Database Connection)

**IF** ES modules errors in logs:
→ **ROOT CAUSE**: Module loading issues in production
→ **GO TO**: Fix Attempt 2 (ES Modules)

#### RESEARCH TARGETS (ONLY IF ROOT CAUSE UNCLEAR):
**Search these specific terms based on symptoms:**
1. **If process hanging**: "node.js process hanging database connection pm2"
2. **If port binding fails**: "node.js EADDRINUSE production pm2 port binding"
3. **If ES modules errors**: "node.js es modules pm2 production import export"
4. **If nginx issues**: "nginx 502 bad gateway upstream connection refused"

### PHASE 4: TARGETED REMEDIATION (30 minutes)
**REASONING**: Apply fixes in order of likelihood based on root cause analysis.

#### Fix Attempt 1: Process Restart (Clean Slate)
**WHEN TO USE**: If no process listening on port 3000 OR process hanging
```bash
# Step 1: Clean shutdown
ssh root@198.199.75.168 'pm2 delete just-work-api; pkill -f "node.*server"; sleep 3'

# Step 2: Verify clean state
ssh root@198.199.75.168 'netstat -tlnp | grep :3000 || echo "Port 3000 is free"'

# Step 3: Start with explicit configuration
ssh root@198.199.75.168 'cd /var/www/just-work && PORT=3000 pm2 start server/index.js --name just-work-api --log /var/log/pm2-just-work.log'

# Step 4: Immediate verification
ssh root@198.199.75.168 'sleep 8 && curl -v --max-time 10 http://localhost:3000/api/companies?limit=1'
```
**SUCCESS CRITERIA**: Should return JSON data, not 502/timeout

#### Fix Attempt 2: ES Modules Production Fix
**WHEN TO USE**: If ES modules errors in PM2 logs
```bash
# Step 1: Create PM2 ecosystem file for ES modules
ssh root@198.199.75.168 'cat > /var/www/just-work/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: "just-work-api",
    script: "server/index.js",
    cwd: "/var/www/just-work",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    },
    exec_mode: "fork",
    instances: 1,
    node_args: "--experimental-modules"
  }]
};
EOF'

# Step 2: Restart with ecosystem file
ssh root@198.199.75.168 'cd /var/www/just-work && pm2 delete all && pm2 start ecosystem.config.js'

# Step 3: Test
ssh root@198.199.75.168 'sleep 8 && curl -v http://localhost:3000/api/companies?limit=1'
```

#### Fix Attempt 3: Database Connection Isolation
**WHEN TO USE**: If database test fails/timeouts
```bash
# Step 1: Create minimal test server without DB
ssh root@198.199.75.168 'cat > /var/www/just-work/test-server.js << EOF
import express from "express";
const app = express();
app.get("/api/test", (req, res) => res.json({status: "ok", timestamp: new Date()}));
app.listen(3000, () => console.log("Test server on 3000"));
EOF'

# Step 2: Test minimal server
ssh root@198.199.75.168 'cd /var/www/just-work && pm2 delete all && pm2 start test-server.js --name test-api'
ssh root@198.199.75.168 'sleep 5 && curl http://localhost:3000/api/test'

# Step 3: If test works, fix DB config in main server
# (Add connection pooling, timeouts, error handling)
```

#### Fix Attempt 4: Nginx Configuration Fix
```bash
# Update nginx config with proper upstream configuration
ssh root@198.199.75.168 'cat > /etc/nginx/sites-enabled/just-work.app << EOF
upstream backend {
    server localhost:3000;
}
server {
    listen 80;
    server_name just-work.app www.just-work.app;
    return 301 https://\$server_name\$request_uri;
}
server {
    listen 443 ssl;
    server_name just-work.app www.just-work.app;
    
    root /var/www/just-work/dist;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF'
ssh root@198.199.75.168 'nginx -t && systemctl reload nginx'
```

### PHASE 5: COMPREHENSIVE VALIDATION (10 minutes)
**REASONING**: Verify the fix works across all application components.

#### A. API Endpoint Validation
**Execute in sequence, documenting response for each:**
```bash
# Test 1: Basic company data
curl -s "https://just-work.app/api/companies?limit=1" | jq '.[0].name' || echo "FAILED: Companies endpoint"

# Test 2: Industries endpoint  
curl -s "https://just-work.app/api/industries" | jq 'length' || echo "FAILED: Industries endpoint"

# Test 3: Statistics endpoint
curl -s "https://just-work.app/api/stats" | jq '.totalCompanies' || echo "FAILED: Stats endpoint"

# Test 4: Company detail with contacts
curl -s "https://just-work.app/api/companies/3M/contacts" | jq 'length' || echo "FAILED: Contacts endpoint"
```
**SUCCESS CRITERIA**: All commands should return data, not error messages.

#### B. Frontend Integration Test
**Manual verification steps:**
1. **Load Test**: Open https://just-work.app in browser
2. **Console Check**: Open DevTools → Console (should show no 502 errors)
3. **Data Display**: Verify companies load (not "Loading companies...")
4. **Search Test**: Type in search box, verify filtering works
5. **Detail Test**: Click a company, verify contact info loads

#### C. Performance Validation
```bash
# Response time test
curl -w "Response time: %{time_total}s\n" -s "https://just-work.app/api/companies?limit=10" > /dev/null

# Concurrent request test
for i in {1..5}; do curl -s "https://just-work.app/api/companies?limit=1" & done; wait
```
**SUCCESS CRITERIA**: Response time < 2 seconds, concurrent requests succeed.

### PHASE 6: FALLBACK SOLUTIONS (if above fails)

#### Option A: Docker Deployment
- Create Dockerfile for consistent environment
- Deploy using Docker Compose with nginx

#### Option B: Simplified Server
- Create basic Express server without ES modules
- Use CommonJS instead of ES modules
- Minimal dependencies

#### Option C: Alternative Deployment
- Use PM2 with different configuration
- Try different Node.js version
- Use different process manager

## EXECUTION METHODOLOGY

### CRITICAL SUCCESS FACTORS
1. **Document Everything**: Record findings from each phase before proceeding
2. **Test After Each Fix**: Never apply multiple fixes without testing
3. **Use Working Reference**: Local development (localhost:5173 + localhost:3001) works perfectly
4. **Time Management**: 60-minute limit - if stuck on one approach >15 minutes, move to next
5. **Systematic Approach**: Follow the decision tree, don't skip phases

### COMMUNICATION PROTOCOL
**After each phase, report:**
- What was tested
- What was found
- What hypothesis was confirmed/rejected
- Next action based on evidence

**Example**: "Phase 1 complete. PM2 shows process online, but curl to localhost:3000 times out after 5 seconds. This confirms Hypothesis 1 (process hanging). Moving to Fix Attempt 3 (Database Connection Isolation)."

## SUCCESS CRITERIA (FINAL VALIDATION)
- ✅ `curl https://just-work.app/api/companies?limit=1` returns JSON (not 502)
- ✅ Frontend shows company data (not "Loading companies...")
- ✅ Company detail pages display contact information
- ✅ Search and filtering work correctly
- ✅ All 1,846 website URLs are visible in listings
- ✅ No console errors in browser DevTools

## EMERGENCY DEBUGGING COMMANDS
**Use these if stuck or need quick diagnostics:**
```bash
# Quick health check
ssh root@198.199.75.168 'pm2 status && netstat -tlnp | grep :3000 && curl -m 5 localhost:3000/api/companies?limit=1'

# Full system status
ssh root@198.199.75.168 'systemctl status nginx && pm2 logs just-work-api --lines 10 && df -h && free -m'

# Reset everything (nuclear option)
ssh root@198.199.75.168 'pm2 delete all && pkill -f node && systemctl restart nginx && sleep 5'
```

## FINAL DELIVERABLE
**OBJECTIVE**: A fully functional https://just-work.app website displaying all 7,026+ companies with 1,846 newly added website URLs, matching local development functionality.

**VALIDATION**: User can browse companies, search/filter, view company details with contact information, and see website URLs - all without 502 errors or loading screens.
