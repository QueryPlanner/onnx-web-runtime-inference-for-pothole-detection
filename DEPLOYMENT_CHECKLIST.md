# Deployment Checklist

## Pre-Deployment

### Code Review
- [ ] No console.error/console.log statements left in production code
- [ ] All environment variables properly configured
- [ ] No hardcoded API URLs (use environment variables)
- [ ] Error handling covers all edge cases
- [ ] No security vulnerabilities in dependencies
- [ ] TypeScript compilation without errors
- [ ] Python code passes linting (pylint/flake8)

### Testing
- [ ] Frontend loads successfully
- [ ] Image upload works with various formats (jpg, png, webp)
- [ ] GPS extraction works with EXIF data
- [ ] Detection runs without crashes
- [ ] API sends reports correctly
- [ ] Backend receives and stores reports
- [ ] Map generates without errors
- [ ] Database queries perform adequately
- [ ] Error messages are user-friendly
- [ ] API rate limiting considered

### Dependencies
- [ ] Frontend dependencies audited for vulnerabilities
  ```bash
  npm audit
  npm audit fix
  ```
- [ ] Python dependencies pinned to versions (not latest)
  ```bash
  pip check
  pip freeze > backend/requirements.txt
  ```
- [ ] No unused dependencies

## Frontend Deployment

### Build Optimization
```bash
# Build for production
npm run build

# Check build size
du -sh dist/
```

- [ ] Build completes without warnings
- [ ] Build size is reasonable (< 5MB)
- [ ] Source maps available for debugging
- [ ] Assets optimized (images, fonts)

### Deployment Options

#### Option 1: Vercel
```bash
npm i -g vercel
vercel --prod
```
- [ ] Configure environment variables if needed
- [ ] Set custom domain (if applicable)
- [ ] Enable auto-deployment from git

#### Option 2: Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```
- [ ] Connect GitHub repository
- [ ] Configure build command: `npm run build`
- [ ] Configure publish directory: `dist`

#### Option 3: Self-Hosted
- [ ] Server has Node.js or static hosting
- [ ] Serve `dist/` directory as static files
- [ ] Configure CDN for assets
- [ ] Set up SSL certificate

### Post-Deployment Frontend
- [ ] Site loads at custom domain
- [ ] All assets load correctly
- [ ] No CORS errors in console
- [ ] API proxy working (or production URL set)
- [ ] Performance acceptable (Lighthouse check)

## Backend Deployment

### Preparation
```bash
# Ensure requirements.txt is up to date
pip freeze > backend/requirements.txt

# Test startup locally
uvicorn main:app --host 0.0.0.0 --port 8001
```

- [ ] All dependencies documented in requirements.txt
- [ ] .env template documented (.env.example or README)
- [ ] No hardcoded database credentials
- [ ] Logging properly configured
- [ ] Error handling comprehensive

### Database Setup
- [ ] NeonDB account created and accessible
- [ ] Connection string verified (can connect locally)
- [ ] Database name is unique
- [ ] Schema created (pothole_reports table)
- [ ] Backups enabled in NeonDB
- [ ] Read replicas configured if needed

### Deployment Options

#### Option 1: Railway
1. Connect GitHub repository
2. Create new project
3. Add Python service
4. Set environment variables:
   - `NEON_DATABASE_URL`
   - `PORT=8001`
5. Deploy
   - [ ] Deployment succeeds
   - [ ] Health checks pass

#### Option 2: Render
1. Create new Web Service
2. Connect GitHub repository
3. Set Build Command: `pip install -r backend/requirements.txt`
4. Set Start Command: `uvicorn main:app --host 0.0.0.0 --port 10000`
5. Set environment variables
   - [ ] Deployment succeeds

#### Option 3: Self-Hosted (AWS/GCP/DigitalOcean)
```bash
# On server
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Create systemd service
sudo nano /etc/systemd/system/pothole-backend.service
```
- [ ] Service file created
- [ ] Reverse proxy configured (nginx/Apache)
- [ ] SSL certificate installed
- [ ] Service enabled and running

### Post-Deployment Backend
- [ ] API accessible at production URL
- [ ] Health check endpoint responds
- [ ] Database connection verified
- [ ] POST /api/report works with test data
- [ ] GET /api/map returns map HTML
- [ ] Logs are captured and searchable
- [ ] Error monitoring set up

## Integration Testing

### API Integration
- [ ] Frontend can reach backend API
- [ ] CORS headers correct
- [ ] Image upload works end-to-end
- [ ] GPS data persists correctly
- [ ] Map displays all reports

### User Workflow
- [ ] User uploads image with GPS
- [ ] Potholes detected automatically
- [ ] Report sent to backend
- [ ] No errors in console
- [ ] Report visible on map

### Error Scenarios
- [ ] Image without GPS: Shows error message
- [ ] Network timeout: Graceful error handling
- [ ] Database unavailable: Returns 500 with message
- [ ] Invalid image format: Rejected gracefully
- [ ] Concurrent uploads: No race conditions

## Performance & Monitoring

### Frontend
- [ ] Lighthouse score > 80
- [ ] Core Web Vitals acceptable
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 3.5s

### Backend
- [ ] API response time < 500ms (excluding image processing)
- [ ] Database queries optimized
- [ ] Connection pool sized appropriately
- [ ] Memory usage stable
- [ ] No memory leaks after hours

### Monitoring Setup
- [ ] Error tracking (Sentry/Rollbar)
  ```bash
  pip install sentry-sdk
  ```
- [ ] Performance monitoring (New Relic/DataDog)
- [ ] Uptime monitoring (Pingdom/UptimeRobot)
- [ ] Database monitoring (Neon dashboard)
- [ ] Log aggregation (ELK/Splunk)

## Security

### Frontend
- [ ] HTTPS only (automatic on Vercel/Netlify)
- [ ] No sensitive data in localStorage
- [ ] Input validation before sending to API
- [ ] API error messages don't expose internals

### Backend
- [ ] HTTPS/TLS enabled
- [ ] Environment variables never logged
- [ ] SQL injection prevention (using parameterized queries ✓)
- [ ] Input validation on all endpoints
- [ ] Rate limiting implemented
  ```python
  from slowapi import Limiter
  ```
- [ ] CORS properly configured
- [ ] Database credentials never in code
- [ ] Regular dependency updates scheduled

### Data Protection
- [ ] Database backups automated (NeonDB)
- [ ] Backup retention policy defined
- [ ] Disaster recovery plan documented
- [ ] GDPR compliance reviewed (if applicable)

## Documentation

- [ ] README updated with production URLs
- [ ] API documentation current
- [ ] Environment variables documented
- [ ] Deployment instructions clear
- [ ] Runbooks for common issues
- [ ] Contact/support information provided

## Post-Deployment Validation

### Within 1 Hour
- [ ] Site loads
- [ ] No critical errors in logs
- [ ] Database functioning
- [ ] API responding

### Within 24 Hours
- [ ] Monitor for anomalies
- [ ] Check error tracking dashboard
- [ ] Verify all endpoints working
- [ ] Performance metrics acceptable

### Within 1 Week
- [ ] Gather user feedback
- [ ] Address any issues
- [ ] Optimize based on real-world usage
- [ ] Update documentation

## Rollback Plan

If deployment fails:

### Frontend
```bash
# Vercel: Previous deployment automatically available
vercel --prod --confirm

# Netlify: Automatic rollback or deploy previous version
```

### Backend
```bash
# Railway/Render: Previous deployment still running
# Switch traffic back with UI

# Self-hosted: Restart previous version
systemctl restart pothole-backend
git checkout previous_commit
systemctl start pothole-backend
```

- [ ] Rollback procedure tested
- [ ] Communication plan for users
- [ ] Post-mortem scheduled if needed

## Sign-Off

- [ ] Project Lead: ___________________ Date: ___
- [ ] QA Lead: _______________________ Date: ___
- [ ] DevOps Lead: ____________________ Date: ___
- [ ] Project Manager: _________________ Date: ___

## Post-Launch

### Week 1
- [ ] Monitor error rates (target: < 1%)
- [ ] Monitor performance metrics
- [ ] Address any critical issues
- [ ] Gather user feedback

### Month 1
- [ ] Review analytics
- [ ] Optimize based on usage patterns
- [ ] Plan next feature release
- [ ] Document lessons learned

### Ongoing
- [ ] Weekly security updates check
- [ ] Monthly performance review
- [ ] Quarterly disaster recovery drill
- [ ] Continuous improvement cycle
