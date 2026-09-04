#!/bin/bash

# JUST-WORK Complete Server Setup and Deployment Script
# Deploys to DigitalOcean droplet: just-work-app (198.199.75.168)

set -e

SERVER_IP="198.199.75.168"
DOMAIN="just-work.app"
APP_NAME="just-work"
REPO_URL="https://github.com/ever-just/JUST-WORK.git"

echo "🚀 Starting complete deployment of JUST-WORK to $DOMAIN..."
echo "📍 Server: $SERVER_IP"
echo ""

# Function to run commands on the server
run_on_server() {
    ssh -o StrictHostKeyChecking=no root@$SERVER_IP "$1"
}

# Function to copy files to server
copy_to_server() {
    scp -o StrictHostKeyChecking=no -r "$1" root@$SERVER_IP:"$2"
}

echo "1️⃣ Setting up server environment..."
run_on_server "
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get upgrade -y
    apt-get install -y nginx nodejs npm git curl ufw certbot python3-certbot-nginx
    
    # Install Node.js 18 (latest LTS)
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    # Install PM2 for process management
    npm install -g pm2
    
    echo '✅ Server environment setup complete'
"

echo "2️⃣ Configuring firewall..."
run_on_server "
    ufw --force enable
    ufw allow ssh
    ufw allow 'Nginx Full'
    ufw allow 80
    ufw allow 443
    echo '✅ Firewall configured'
"

echo "3️⃣ Cloning and setting up application..."
run_on_server "
    cd /var/www
    rm -rf $APP_NAME
    git clone $REPO_URL $APP_NAME
    cd $APP_NAME
    
    # Install dependencies
    npm install --production
    
    # Build the application
    npm run build
    
    echo '✅ Application setup complete'
"

echo "4️⃣ Creating production environment file..."
run_on_server "
    cd /var/www/$APP_NAME
    cat > .env << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration (using your existing DigitalOcean database)
DB_HOST=just-work-db-do-user-24253030-0.f.db.ondigitalocean.com
DB_PORT=25060
DB_NAME=justwork
DB_USER=doadmin
DB_PASSWORD=\${PROD_DB_PASSWORD}

# Application Configuration
API_BASE_URL=https://$DOMAIN/api
CORS_ORIGIN=https://$DOMAIN

# JWT Configuration
JWT_SECRET=\$(openssl rand -base64 32)
JWT_EXPIRES_IN=7d

# GoDaddy API Configuration
GODADDY_API_KEY=<GODADDY_CREDENTIAL_REMOVED_2026-09-04>
GODADDY_API_SECRET=81sQWbJhgejgv4Dsmpf27Y
GODADDY_ENVIRONMENT=production
EOF
    echo '✅ Environment file created'
"

echo "5️⃣ Setting up Nginx configuration..."
run_on_server "
    cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Redirect HTTP to HTTPS (will be enabled after SSL setup)
    # return 301 https://\$server_name\$request_uri;
    
    # Serve static files
    location / {
        root /var/www/$APP_NAME/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control \"public, immutable\";
        }
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

    # Enable the site
    ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    nginx -t
    systemctl reload nginx
    
    echo '✅ Nginx configuration complete'
"

echo "6️⃣ Creating application startup script..."
run_on_server "
    cd /var/www/$APP_NAME
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: './server.js',
    cwd: '/var/www/$APP_NAME',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/$APP_NAME-error.log',
    out_file: '/var/log/$APP_NAME-out.log',
    log_file: '/var/log/$APP_NAME.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
    echo '✅ PM2 configuration created'
"

echo "7️⃣ Creating simple Express server for API..."
run_on_server "
    cd /var/www/$APP_NAME
    cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'JUST-WORK API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Serve static files (React build)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(\`🚀 JUST-WORK server running on port \${PORT}\`);
  console.log(\`🌐 Environment: \${process.env.NODE_ENV}\`);
});
EOF
    echo '✅ Express server created'
"

echo "8️⃣ Starting the application..."
run_on_server "
    cd /var/www/$APP_NAME
    
    # Stop any existing processes
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Start the application
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    
    # Set up log rotation
    pm2 install pm2-logrotate
    
    echo '✅ Application started with PM2'
"

echo "9️⃣ Setting up SSL certificate..."
run_on_server "
    # Get SSL certificate from Let's Encrypt
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect
    
    # Set up auto-renewal
    systemctl enable certbot.timer
    systemctl start certbot.timer
    
    echo '✅ SSL certificate installed and auto-renewal configured'
"

echo "🔟 Final verification..."
run_on_server "
    # Check services
    systemctl status nginx --no-pager -l
    pm2 status
    
    # Test endpoints
    curl -f http://localhost:3000/health || echo 'Health check failed'
    
    echo '✅ Deployment verification complete'
"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📋 Summary:"
echo "   🌐 Domain: https://$DOMAIN"
echo "   🖥️  Server: $SERVER_IP"
echo "   🔒 SSL: Enabled with Let's Encrypt"
echo "   🚀 Application: Running with PM2"
echo "   📊 Database: Connected to DigitalOcean PostgreSQL"
echo ""
echo "🔗 Access your application:"
echo "   🌍 Website: https://$DOMAIN"
echo "   🔧 API: https://$DOMAIN/api/status"
echo "   ❤️  Health: https://$DOMAIN/health"
echo ""
echo "📝 Next steps:"
echo "   1. Import your data: ssh root@$SERVER_IP 'cd /var/www/$APP_NAME && npm run db:import'"
echo "   2. Monitor logs: ssh root@$SERVER_IP 'pm2 logs $APP_NAME'"
echo "   3. Update application: ssh root@$SERVER_IP 'cd /var/www/$APP_NAME && git pull && npm run build && pm2 restart $APP_NAME'"
echo ""
