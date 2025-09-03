// Direct Shopify API helper for custom apps
// This provides direct API access using the custom app's access token

import { ApiVersion } from "@shopify/shopify-app-remix/server";

/**
 * Create a direct GraphQL client for custom app API calls
 * This bypasses the session-based auth and uses the direct access token
 */
export function createDirectGraphQLClient() {
  const shop = process.env.SHOP_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  
  if (!shop || !accessToken) {
    throw new Error("Missing SHOP_URL or SHOPIFY_ACCESS_TOKEN environment variables");
  }

  return {
    async query(query, variables = {}) {
      const response = await fetch(`https://${shop}/admin/api/${ApiVersion.January25}/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      return result.data;
    }
  };
}

/**
 * Create a direct REST API client for custom app API calls
 */
export function createDirectRestClient() {
  const shop = process.env.SHOP_URL;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  
  if (!shop || !accessToken) {
    throw new Error("Missing SHOP_URL or SHOPIFY_ACCESS_TOKEN environment variables");
  }

  return {
    async get(path) {
      const response = await fetch(`https://${shop}/admin/api/${ApiVersion.January25}${path}`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      });

      if (!response.ok) {
        throw new Error(`REST request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },

    async post(path, data) {
      const response = await fetch(`https://${shop}/admin/api/${ApiVersion.January25}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`REST request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },

    async put(path, data) {
      const response = await fetch(`https://${shop}/admin/api/${ApiVersion.January25}${path}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`REST request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },

    async delete(path) {
      const response = await fetch(`https://${shop}/admin/api/${ApiVersion.January25}${path}`, {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      });

      if (!response.ok) {
        throw new Error(`REST request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    }
  };
}

/**
 * Validate that custom app environment variables are configured
 */
export function validateCustomAppConfig() {
  const required = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'SHOPIFY_ACCESS_TOKEN', 'SHOP_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}
