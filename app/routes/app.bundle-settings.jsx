import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { Page, Layout, Card, Text, TextField, Button, Select, InlineStack, BlockStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import React from "react";

// ---- Loader: read metafield
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const query = `#graphql
    query {
      shop {
        metafield(namespace:"$app:rgmn-bundle", key:"function-configuration"){ id value }
      }
    }`;
  const res = await admin.graphql(query);
  const data = await res.json();
  const current = data?.data?.shop?.metafield?.value ? JSON.parse(data.data.shop.metafield.value) : null;
  return json({ current });
}

// ---- Action: save metafield (JSON)
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();

  const config = JSON.parse(form.get("config_json"));

  // Upsert shop metafield (owner = shop)
  const mutation = `#graphql
    mutation metafieldsSet($val: JSON!) {
      metafieldsSet(metafields: [{
        namespace:"$app:rgmn-bundle",
        key:"function-configuration",
        type:"json",
        ownerId:"gid://shopify/Shop/1",  # ownerId can be omitted; shop-scoped token infers shop
        value:$val
      }]) {
        userErrors { field message }
      }
    }`;

  await admin.graphql(mutation, { variables: { val: JSON.stringify(config) } });
  return redirect("/app/bundle-settings?saved=1");
}

export default function BundleSettings() {
  const { current } = useLoaderData();
  const nav = useNavigation();
  
  // Initialize form state
  const [bundleTitle, setBundleTitle] = React.useState(current?.bundleTitle || "Complete Kit");
  const [bundleVariantId, setBundleVariantId] = React.useState(current?.bundleVariantId || "");
  const [components, setComponents] = React.useState(current?.components || []);
  const [uiCopy, setUiCopy] = React.useState(current?.uiCopy || {
    cta: "Replace {sets} individual item(s) with the {bundle} and save?",
    ctaSubscribe: "Subscribe & save",
    confirmBtn: "Yes, upgrade to bundle",
    oneTimeLabel: "One-time purchase"
  });
  const [showJsonEditor, setShowJsonEditor] = React.useState(false);

  const addComponent = () => {
    setComponents([...components, {
      key: `component_${Date.now()}`,
      label: "New Component",
      required: 1,
      variantIds: []
    }]);
  };

  const updateComponent = (index, field, value) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    setComponents(updated);
  };

  const removeComponent = (index) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const config = {
      bundleVariantId,
      bundleTitle,
      bundleSellingPlans: current?.bundleSellingPlans || [],
      components,
      uiCopy,
      defaults: current?.defaults || { subscriptionMode: "match-components", subscribeDefaultPlanId: null }
    };
    
    // Create a form and submit it
    const form = document.createElement('form');
    form.method = 'post';
    form.style.display = 'none';
    
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'config_json';
    input.value = JSON.stringify(config);
    
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  };

  const currentJson = JSON.stringify({
    bundleVariantId,
    bundleTitle,
    bundleSellingPlans: current?.bundleSellingPlans || [],
    components,
    uiCopy,
    defaults: current?.defaults || { subscriptionMode: "match-components", subscribeDefaultPlanId: null }
  }, null, 2);

  return (
    <Page 
      title="Bundle Settings"
      primaryAction={{
        content: "Save Bundle",
        onAction: handleSave,
        loading: nav.state !== "idle"
      }}
      secondaryActions={[
        {
          content: showJsonEditor ? "Hide JSON" : "Show JSON",
          onAction: () => setShowJsonEditor(!showJsonEditor)
        }
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Basic Settings</Text>
              
              <TextField
                label="Bundle Title"
                value={bundleTitle}
                onChange={setBundleTitle}
                helpText="The display name for your bundle offer"
              />
              
              <TextField
                label="Bundle Product Variant ID"
                value={bundleVariantId}
                onChange={setBundleVariantId}
                helpText="The Shopify variant ID of the bundle product (e.g., gid://shopify/ProductVariant/123456)"
                placeholder="gid://shopify/ProductVariant/"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Bundle Components</Text>
                <Button onClick={addComponent}>Add Component</Button>
              </InlineStack>
              
              {components.length === 0 ? (
                <Text as="p" tone="subdued">
                  No components added yet. Components define which individual products can be bundled together.
                </Text>
              ) : (
                <BlockStack gap="300">
                  {components.map((component, index) => (
                    <Card key={component.key} background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <InlineStack align="space-between">
                          <Text as="h3" variant="headingSm">Component {index + 1}</Text>
                          <Button 
                            onClick={() => removeComponent(index)}
                            variant="plain"
                            tone="critical"
                          >
                            Remove
                          </Button>
                        </InlineStack>
                        
                        <InlineStack gap="300">
                          <TextField
                            label="Component Key"
                            value={component.key}
                            onChange={(value) => updateComponent(index, 'key', value)}
                            helpText="Unique identifier"
                          />
                          <TextField
                            label="Label"
                            value={component.label}
                            onChange={(value) => updateComponent(index, 'label', value)}
                            helpText="Display name"
                          />
                          <TextField
                            label="Required Qty"
                            type="number"
                            value={component.required?.toString() || "1"}
                            onChange={(value) => updateComponent(index, 'required', parseInt(value) || 1)}
                            helpText="How many needed"
                          />
                        </InlineStack>
                        
                        <TextField
                          label="Variant IDs (comma-separated)"
                          value={(component.variantIds || []).join(', ')}
                          onChange={(value) => updateComponent(index, 'variantIds', 
                            value.split(',').map(id => id.trim()).filter(id => id)
                          )}
                          helpText="Product variant IDs that belong to this component"
                          placeholder="gid://shopify/ProductVariant/123, gid://shopify/ProductVariant/456"
                          multiline={2}
                        />
                      </BlockStack>
                    </Card>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Customer-Facing Text</Text>
              
              <TextField
                label="Bundle Offer Message"
                value={uiCopy.cta}
                onChange={(value) => setUiCopy({...uiCopy, cta: value})}
                helpText="Use {sets} for quantity and {bundle} for bundle name"
                multiline={2}
              />
              
              <InlineStack gap="300">
                <TextField
                  label="One-time Label"
                  value={uiCopy.oneTimeLabel}
                  onChange={(value) => setUiCopy({...uiCopy, oneTimeLabel: value})}
                />
                <TextField
                  label="Subscribe Label"
                  value={uiCopy.ctaSubscribe}
                  onChange={(value) => setUiCopy({...uiCopy, ctaSubscribe: value})}
                />
              </InlineStack>
              
              <TextField
                label="Confirm Button Text"
                value={uiCopy.confirmBtn}
                onChange={(value) => setUiCopy({...uiCopy, confirmBtn: value})}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {showJsonEditor && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">JSON Preview</Text>
                <Text as="p" tone="subdued">
                  This is the JSON that will be saved. You can copy this for backup or advanced editing.
                </Text>
                <TextField
                  value={currentJson}
                  multiline={15}
                  readOnly
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}