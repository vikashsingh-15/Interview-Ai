# Deployment Guide

## Prerequisites

- Node.js 18+
- MongoDB (Atlas recommended for production)
- Redis (optional but recommended)
- Docker (optional)
- Domain name (for production)

## Production Environment Variables

Create `.env.production`:

```env
# Server
NODE_ENV=production
PORT=3001

# Database - MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/interview-prep?retryWrites=true&w=majority

# Authentication
JWT_SECRET=<generate-with-openssl-rand-hex-64>
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Cookie Security
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=strict

# Email
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@yourdomain.com
SENDGRID_API_KEY=<your-sendgrid-api-key>

# AI Providers
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_MODEL=gpt-4
AI_DEFAULT_PROVIDER=openai

# Redis
REDIS_URL=redis://:<password>@<redis-host>:6379

# Features
VECTOR_SEARCH_ENABLED=true
EMAIL_VERIFICATION_ENABLED=true
NOTIFICATIONS_ENABLED=true

# URLs
FRONTEND_URL=https://app.yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Configure Docker environment**:
```bash
cp docker/.env.example docker/.env
# Edit docker/.env with production values
```

2. **Build and start**:
```bash
docker-compose -f docker/docker-compose.prod.yml up -d --build
```

3. **Seed the database**:
```bash
docker-compose -f docker/docker-compose.prod.yml exec backend npm run seed
```

### Option 2: Manual Deployment

#### Backend

1. **Build**:
```bash
cd backend
npm run build
```

2. **Start with PM2**:
```bash
npm install -g pm2
pm2 start dist/index.js --name interview-prep-api
pm2 save
pm2 startup
```

3. **Or with systemd**:
```bash
# Create service file
sudo nano /etc/systemd/system/interview-prep.service
```

```ini
[Unit]
Description=Interview Prep API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/interview-prep/backend
ExecStart=/usr/bin/node dist/index.js
Environment=NODE_ENV=production
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable interview-prep
sudo systemctl start interview-prep
```

#### Frontend (Next.js)

1. **Build**:
```bash
cd frontend
npm run build
```

2. **Serve with PM2**:
```bash
npm install -g pm2
pm2 start npm --name interview-prep-web -- start
```

3. **Or use Vercel** (recommended for Next.js):
- Connect your GitHub repo
- Configure environment variables
- Deploy

### Option 3: Platform-as-a-Service

#### Render
1. Connect GitHub repo
2. Configure:
   - Environment: Node
   - Build Command: `npm install && cd frontend && npm install && cd ../backend && npm install`
   - Start Command: `cd backend && npm start`
3. Add environment variables
4. Set up MongoDB Atlas database

#### Railway
1. Connect GitHub repo
2. Add MongoDB service
3. Add Redis service (optional)
4. Configure environment variables
5. Deploy

#### AWS

1. **ECS/Fargate**:
   - Create task definition
   - Create services for backend, frontend
   - Set up ALB
   - Configure environment variables

2. **Elastic Beanstalk**:
   - Create Node.js environment
   - Configure environment properties
   - Deploy

## Database Setup

### MongoDB Atlas (Recommended)

1. **Create cluster** at mongodb.com/cloud/atlas
2. **Create database user**:
   - Username and password
   - Role: readWrite @ interview-prep
3. **Create database**:
   - Database name: interview-prep
4. **Configure network access**:
   - Add your server IP or 0.0.0.0/0 (with proper security)
5. **Get connection string**:
   - mongodb+srv://user:pass@cluster.mongodb.net/interview-prep

### Self-Hosted MongoDB

1. **Install MongoDB** (Ubuntu):
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

2. **Configure**:
```bash
sudo nano /etc/mongod.conf
```

```yaml
storage:
  dbPath: /var/lib/mongodb
net:
  port: 27017
  bindIp: 127.0.0.1
security:
  authorization: enabled
```

3. **Create admin user**:
```bash
mongosh
use admin
db.createUser({
  user: 'admin',
  pwd: 'secure-password',
  roles: [{ role: 'root', db: 'admin' }]
})
```

4. **Create application database**:
```bash
mongosh -u admin -p secure-password --authenticationDatabase admin
use interview-prep
db.createUser({
  user: 'appuser',
  pwd: 'app-password',
  roles: [{ role: 'readWrite', db: 'interview-prep' }]
})
```

## SSL/TLS Setup

### Let's Encrypt (Recommended)

1. **Install Certbot**:
```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. **Get certificate**:
```bash
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

3. **Auto-renewal** (usually configured automatically)

### Nginx Configuration

Create `/etc/nginx/sites-available/interview-prep`:

```nginx
# Frontend
server {
    listen 80;
    server_name app.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring

### Health Checks

Backend exposes `/health` endpoint. Configure monitoring:

```bash
# Uptime monitoring
curl -f http://localhost:3001/health

# PM2 monitoring
pm2 monit
pm2 logs interview-prep-api
```

### Logging

Logs are written to console in JSON format. For production:

1. **Configure log aggregation** (CloudWatch, Datadog, etc.)
2. **Set LOG_LEVEL=info** in production
3. **Configure log rotation**

## Backup Strategy

### MongoDB Backup

1. **Automated backups** (MongoDB Atlas handles this)
2. **Manual backup**:
```bash
mongodump --uri="mongodb+srv://user:pass@cluster/db" --out=/backup/mongodb/$(date +%Y%m%d)
```

### File Storage
- Uploaded resumes stored on disk
- Backup the uploads directory
- Or use S3-compatible storage

## Scaling

### Horizontal Scaling

1. **Load Balancer**: Put Nginx or cloud LB in front
2. **Multiple backends**: Scale backend instances
3. **Redis**: Use for session sharing across instances
4. **Database**: MongoDB replica sets for HA

### Vertical Scaling
- Increase server resources (CPU, RAM)
- Good for early-stage growth

## CI/CD

### GitHub Actions Example

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy
        run: |
          # Push to server and restart
          rsync -avz --exclude node_modules . user@server:/opt/interview-prep
          ssh user@server "cd /opt/interview-prep && npm ci --production && pm2 restart interview-prep-api"
        env:
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
```

## Troubleshooting

### Common Issues

1. **Application won't start**:
   - Check logs: `pm2 logs` or `docker-compose logs`
   - Verify environment variables
   - Check MongoDB connection

2. **Database connection failed**:
   - Verify MongoDB URI
   - Check network access (IP whitelist)
   - Verify credentials

3. **Frontend can't reach API**:
   - Check CORS configuration
   - Verify API_URL in frontend
   - Check that backend is running

4. **File upload fails**:
   - Check upload directory permissions
   - Verify file size limits
   - Check file type validation

## Post-Deployment Checklist

- [ ] Database seeded with topics, questions, coding problems
- [ ] SSL certificates configured
- [ ] Environment variables set correctly
- [ ] Rate limiting configured
- [ ] Email service working
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Backups configured
- [ ] Log aggregation working
- [ ] Load testing completed (if needed)
