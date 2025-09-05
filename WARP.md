# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Setup & Installation
```bash
npm install
npm run setup  # Generates Prisma client and runs database migrations
```

### Development
```bash
npm run dev         # Start Shopify app development server
npm run build       # Build the app for production
npm start          # Start the production server
```

### Database Operations
```bash
npx prisma generate        # Generate Prisma client
npx prisma migrate deploy  # Deploy database migrations
npx prisma studio         # Open Prisma Studio for database management
```

### Code Quality
```bash
npm run lint              # Run ESLint
npm run graphql-codegen   # Generate GraphQL types and operations
```

### Shopify CLI Operations
```bash
npm run generate    # Generate Shopify app extensions/functionality
npm run deploy      # Deploy app to Shopify
npm run config:link # Link app configuration
npm run config:use  # Use specific app configuration
npm run env         # Manage environment variables
```

## Architecture Overview

This is a **Shopify Remix App** using a modern tech stack:

### Core Framework
- **Remix**: Full-stack React framework handling routing, SSR, and data loading
- **Vite**: Build tool and development server
- **TypeScript**: Primary language (though some files use .jsx/.js extensions)

### Shopify Integration
- **@shopify/shopify-app-remix**: Main Shopify app framework providing authentication, GraphQL client, and webhook handling
- **@shopify/polaris**: Shopify's React component library for consistent UI
- **@shopify/app-bridge-react**: Embeds the app within Shopify Admin interface
- **Scopes**: Currently configured with `write_products` scope

### Database & Storage
- **Prisma**: ORM with SQLite database (dev.sqlite file)
- **PrismaSessionStorage**: Handles Shopify app session storage
- **Session Model**: Stores shop authentication data, tokens, and user information

### Key Configuration Files
- `shopify.app.toml`: App-level configuration including scopes and webhooks
- `shopify.web.toml`: Web-specific deployment configuration  
- `app/shopify.server.js`: Central Shopify configuration and authentication setup
- `prisma/schema.prisma`: Database schema definition
- `vite.config.js`: Build configuration with Shopify-specific tweaks

### Route Structure
- `/app/_index`: Landing page route (outside admin)
- `/app.*`: Admin-embedded app routes
- `/auth.*`: OAuth authentication flow
- `/webhooks.*`: Webhook handlers for app lifecycle events

### Authentication Flow
The app uses Shopify's embedded authentication with:
- OAuth handled via `/auth` routes
- Admin API access through `authenticate.admin(request)`
- Session storage via Prisma
- JWT-based token management

### GraphQL Integration
- Admin API version: `January25` (2025-01)
- GraphQL codegen for type safety
- Example mutations for product creation and management
- Configured for Shopify Admin GraphQL API in `.graphqlrc.js`

## Important Development Considerations

### Environment Variables
Required environment variables:
- `SHOPIFY_API_KEY`: App's API key
- `SHOPIFY_API_SECRET`: App's API secret
- `SHOPIFY_APP_URL`: App's URL (set automatically by CLI)
- `SCOPES`: Comma-separated OAuth scopes
- `DATABASE_URL`: Database connection string (PostgreSQL for production, SQLite for dev)

### Database Configuration
- **Production (Railway)**: Uses PostgreSQL with automatic DATABASE_URL provisioning
- **Development**: Can use SQLite with `DATABASE_URL="file:./dev.sqlite"`
- Always run `npx prisma generate` after schema changes
- Use `npx prisma migrate dev` for development migrations
- Production deployments use `npx prisma migrate deploy` (handled automatically)

### Embedded App Constraints
- Use Remix's `Link` component, not `<a>` tags
- Use `redirect` helper from `authenticate.admin`, not `@remix-run/node`
- Use Remix's `Form` component, not lowercase `<form>`

### Webhook Configuration
- App-specific webhooks are defined in `shopify.app.toml`
- Webhook handlers are in `/app/routes/webhooks.*` files
- Currently configured for `app/uninstalled` and `app/scopes_update`

### Development Workflow
1. Changes to GraphQL queries trigger codegen
2. Database schema changes require Prisma regeneration
3. Shopify configuration changes may require redeploy via `npm run deploy`
4. App scope changes require OAuth re-authentication

### Extension Development
- Extensions are stored in `extensions/` directory
- Use `npm run generate` to create new extensions
- Workspace configuration allows multiple extensions
