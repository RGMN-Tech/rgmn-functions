# Railway Deployment Guide

This document outlines the steps and configuration needed to deploy this Shopify app on Railway.

## Required Environment Variables

Configure these environment variables in your Railway project:

### Shopify Configuration
```bash
SHOPIFY_API_KEY=your_api_key_from_partner_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partner_dashboard  
SHOPIFY_APP_URL=https://your-railway-app.up.railway.app
SCOPES=read_products,write_products
```

### Database Configuration
```bash
# Railway automatically provides this for MySQL
DATABASE_URL=mysql://username:password@host:port/database
```

### Node Environment
```bash
NODE_ENV=production
```

## Database Setup

This app uses MySQL in production (Railway) and can use SQLite for local development.

### Production Database (Railway)
- Railway automatically provisions a MySQL database
- The `DATABASE_URL` environment variable is automatically set
- Database migrations run automatically during deployment via `docker-start` script

### Local Development Database  
For local development, you can use SQLite by temporarily changing the Prisma schema:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.sqlite"
}
```

## Deployment Process

1. **Connect your Railway project** to this repository
2. **Set environment variables** in Railway dashboard
3. **Deploy** - Railway will automatically:
   - Build the Docker image
   - Run database migrations
   - Start the application

## Troubleshooting Authentication Issues

If you experience 401 unauthorized errors when accessing the app through Shopify admin:

1. **Verify environment variables** are set correctly in Railway
2. **Check database connectivity** - ensure MySQL is provisioned and connected
3. **Verify app URL** matches the Railway deployment URL
4. **Check Shopify app configuration** in Partner Dashboard matches Railway URLs

## Railway-Specific Configuration

The app is configured for Railway deployment with:
- **Dockerfile** optimized for Railway
- **MySQL** database integration
- **Automatic migrations** on deployment
- **Environment-based configuration**

## App URLs to Configure in Shopify Partner Dashboard

Update your Shopify app configuration with these Railway URLs:

- **App URL**: `https://your-railway-app.up.railway.app`
- **Allowed redirection URLs**:
  - `https://your-railway-app.up.railway.app/auth/callback`
  - `https://your-railway-app.up.railway.app/auth/shopify/callback`
  - `https://your-railway-app.up.railway.app/api/auth/callback`

## Monitoring

Monitor your app's health using:
- Railway dashboard for deployment status
- Application logs for debugging
- Database connection status
- Shopify app analytics
