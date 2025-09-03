import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { Page, Layout, Card, Text, TextField, Button, Select, InlineStack, BlockStack } from "@shopify/polaris";
import { createDirectGraphQLClient } from "../utils/shopify-api.server.js";
import React from "react";

// Example route showing how to use direct API access for custom apps
// This bypasses the session-based authentication and uses direct API tokens

// ---- Loader: read metafield using direct API access
export async function loader({ context }) {
  try {
    // Option 1: Use the regular authentication (still works with custom apps)
    if (context?.admin) {
      const admin = context.admin;
      const query = `#graphql
        query {
          shop {
            metafield(namespace:"$app:rgmn-bundle", key:"function-configuration"){ id value }
          }
        }`;
      const res = await admin.graphql(query);
      const data = await res.json();
      const current = data?.data?.shop?.metafield?.value ? JSON.parse(data.data.shop.metafield.value) : null;
      return json({ current, method: "session-based" });
    }
    
    // Option 2: Use direct API access (useful for background jobs, webhooks, etc.)
    const directClient = createDirectGraphQLClient();
    const query = `
      query {
        shop {
          metafield(namespace:"$app:rgmn-bundle", key:"function-configuration"){ id value }
        }
      }`;
    
    const data = await directClient.query(query);
    const current = data?.shop?.metafield?.value ? JSON.parse(data.shop.metafield.value) : null;
    return json({ current, method: "direct-api" });
    
  } catch (error) {
    console.error("Error loading bundle settings:", error);
    return json({ current: null, error: error.message, method: "error" });
  }
}

// ---- Action: save metafield using direct API access
export async function action({ request, context }) {
  try {
    const form = await request.formData();
    const config = JSON.parse(form.get("config_json"));

    // Option 1: Use regular authentication if available
    if (context?.admin) {
      const admin = context.admin;
      const mutation = `#graphql
        mutation metafieldsSet($val: JSON!) {
          metafieldsSet(metafields: [{
            namespace:"$app:rgmn-bundle",
            key:"function-configuration",
            type:"json",
            ownerId:"gid://shopify/Shop/1",
            value:$val
          }]) {
            userErrors { field message }
          }
        }`;

      await admin.graphql(mutation, { variables: { val: JSON.stringify(config) } });
      return redirect("/app/bundle-settings-direct?saved=1&method=session");
    }

    // Option 2: Use direct API access
    const directClient = createDirectGraphQLClient();
    const mutation = `
      mutation metafieldsSet($val: JSON!) {
        metafieldsSet(metafields: [{
          namespace:"$app:rgmn-bundle",
          key:"function-configuration",
          type:"json",
          ownerId:"gid://shopify/Shop/1",
          value:$val
        }]) {
          userErrors { field message }
        }
      }`;

    await directClient.query(mutation, { val: JSON.stringify(config) });
    return redirect("/app/bundle-settings-direct?saved=1&method=direct");
    
  } catch (error) {
    console.error("Error saving bundle settings:", error);
    return json({ error: error.message }, { status: 500 });
  }
}

export default function BundleSettingsDirect() {
  const { current, method, error } = useLoaderData();
  const nav = useNavigation();

  const [jsonText, setJsonText] = React.useState(JSON.stringify(current ?? {
    bundleVariantId: "",
    bundleTitle: "Full Kit",
    bundleSellingPlans: [],
    components: [],
    uiCopy: { cta: "", ctaSubscribe: "", confirmBtn: "", planLabel: "", oneTimeLabel: "" },
    defaults: { subscriptionMode: "match-components", subscribeDefaultPlanId: null }
  }, null, 2));

  return (
    <Page title="Bundle Settings (Direct API Demo)">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="p">
                This page demonstrates both session-based and direct API access for custom apps.
                Current method: <strong>{method}</strong>
              </Text>
              
              {error && (
                <Text as="p" tone="critical">
                  Error: {error}
                </Text>
              )}
              
              <Text as="p">
                Edit your configuration JSON below. This demonstrates how custom apps can use direct API access.
              </Text>
              
              <TextField
                label="Config JSON"
                value={jsonText}
                onChange={setJsonText}
                multiline={20}
                autoComplete="off"
              />
              
              <Form method="post">
                <input type="hidden" name="config_json" value={jsonText} />
                <InlineStack gap="300">
                  <Button submit loading={nav.state !== "idle"} variant="primary">
                    Save Configuration
                  </Button>
                </InlineStack>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
        
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">API Access Methods</Text>
              <Text as="p">
                <strong>Session-based:</strong> Uses the standard Shopify app authentication flow. 
                Works with both public and custom apps.
              </Text>
              <Text as="p">
                <strong>Direct API:</strong> Uses the custom app's access token directly. 
                Useful for background jobs, webhooks, and server-side operations.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
