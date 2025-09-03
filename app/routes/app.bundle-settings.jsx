import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useSubmit } from "@remix-run/react";
import { Page, Layout, Card, Text, TextField, Button, Select, InlineStack, BlockStack, Modal, ResourceList, ResourceItem, Thumbnail, Checkbox } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import React from "react";

// ---- Loader: read metafield and get products
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  // Get bundle configuration
  const configQuery = `#graphql
    query {
      shop {
        metafield(namespace:"$app:rgmn-bundle", key:"function-configuration"){ id value }
      }
    }`;
  
  // Get products for pickers
  const productsQuery = `#graphql
    query {
      products(first: 100) {
        edges {
          node {
            id
            title
            handle
            featuredMedia {
              ... on MediaImage {
                image {
                  url
                  altText
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }`;

  const [configRes, productsRes] = await Promise.all([
    admin.graphql(configQuery),
    admin.graphql(productsQuery)
  ]);

  const configData = await configRes.json();
  const productsData = await productsRes.json();
  
  const current = configData?.data?.shop?.metafield?.value ? JSON.parse(configData.data.shop.metafield.value) : null;
  const products = productsData?.data?.products?.edges?.map(edge => edge.node) || [];

  return json({ current, products });
}

// ---- Action: save metafield (JSON)
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();

  const config = JSON.parse(form.get("config_json"));

  // First get the shop ID
  const shopQuery = `#graphql
    query {
      shop {
        id
      }
    }`;

  const shopResult = await admin.graphql(shopQuery);
  const shopData = await shopResult.json();
  const shopId = shopData.data.shop.id;

  // Upsert shop metafield (owner = shop)
  const mutation = `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors { 
          field 
          message 
        }
      }
    }`;

  const variables = {
    metafields: [{
      namespace: "$app:rgmn-bundle",
      key: "function-configuration",
      type: "json",
      value: JSON.stringify(config),
      ownerId: shopId
    }]
  };

  const result = await admin.graphql(mutation, { variables });
  const data = await result.json();
  
  // Log any errors for debugging
  if (data.data?.metafieldsSet?.userErrors?.length > 0) {
    console.error('Metafield save errors:', data.data.metafieldsSet.userErrors);
  }
  
  return redirect("/app/bundle-settings?saved=1");
}

export default function BundleSettings() {
  const { current, products } = useLoaderData();
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

  // Update form state when loader data changes (after save/reload)
  React.useEffect(() => {
    if (current) {
      setBundleTitle(current.bundleTitle || "Complete Kit");
      setBundleVariantId(current.bundleVariantId || "");
      setComponents(current.components || []);
      setUiCopy(current.uiCopy || {
        cta: "Replace {sets} individual item(s) with the {bundle} and save?",
        ctaSubscribe: "Subscribe & save", 
        confirmBtn: "Yes, upgrade to bundle",
        oneTimeLabel: "One-time purchase"
      });
    }
  }, [current]);
  const [showJsonEditor, setShowJsonEditor] = React.useState(false);
  const [showProductPicker, setShowProductPicker] = React.useState(false);
  const [editingComponentIndex, setEditingComponentIndex] = React.useState(-1);

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

  const openProductPicker = (componentIndex) => {
    setEditingComponentIndex(componentIndex);
    setShowProductPicker(true);
  };

  const handleProductSelection = (selectedVariants) => {
    if (editingComponentIndex >= 0) {
      const updated = [...components];
      updated[editingComponentIndex].variantIds = selectedVariants;
      setComponents(updated);
    }
    setShowProductPicker(false);
    setEditingComponentIndex(-1);
  };

  // Get bundle product options for the main bundle selector
  const bundleProductOptions = [
    { label: "Select a bundle product...", value: "" },
    ...products.flatMap(product => 
      product.variants.edges.map(variant => ({
        label: `${product.title} - ${variant.node.title} ($${variant.node.price})`,
        value: variant.node.id
      }))
    )
  ];

  const submit = useSubmit();
  
  const handleSave = () => {
    const config = {
      bundleVariantId,
      bundleTitle,
      bundleSellingPlans: current?.bundleSellingPlans || [],
      components,
      uiCopy,
      defaults: current?.defaults || { subscriptionMode: "match-components", subscribeDefaultPlanId: null }
    };
    
    const formData = new FormData();
    formData.append('config_json', JSON.stringify(config));
    submit(formData, { method: 'post' });
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
        {!current && (
          <Layout.Section>
            <Card>
              <Text as="p" tone="subdued">
                ℹ️ No bundle configuration found. Creating new bundle configuration with default values.
              </Text>
            </Card>
          </Layout.Section>
        )}
        
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
              
              <Select
                label="Bundle Product Variant"
                options={bundleProductOptions}
                value={bundleVariantId}
                onChange={setBundleVariantId}
                helpText="Select the product variant that customers will receive when they accept the bundle offer"
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
                            label="Component Name"
                            value={component.label}
                            onChange={(value) => updateComponent(index, 'label', value)}
                            helpText="What to call this component (e.g., 'Main Product', 'Add-on')"
                          />
                          <TextField
                            label="Required Quantity"
                            type="number"
                            value={component.required?.toString() || "1"}
                            onChange={(value) => updateComponent(index, 'required', parseInt(value) || 1)}
                            helpText="How many of this component are needed for the bundle"
                          />
                        </InlineStack>
                        
                        <InlineStack align="space-between">
                          <Text as="p" tone="subdued">
                            {(component.variantIds || []).length} variant{(component.variantIds || []).length !== 1 ? 's' : ''} selected
                          </Text>
                          <Button 
                            onClick={() => openProductPicker(index)}
                            size="sm"
                          >
                            {(component.variantIds || []).length > 0 ? 'Edit Products' : 'Select Products'}
                          </Button>
                        </InlineStack>
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
              <Text as="h2" variant="headingMd">Subscription Plans</Text>
              <Text as="p" tone="subdued">
                Bundles are always subscription-based products. Configure the available subscription plans for your bundle.
              </Text>
              
              {(current?.bundleSellingPlans || []).length === 0 ? (
                <Text as="p" tone="critical">
                  ⚠️ No subscription plans configured. You need to set up selling plans for your bundle product in Shopify admin first.
                </Text>
              ) : (
                <Text as="p" tone="success">
                  ✓ {(current?.bundleSellingPlans || []).length} subscription plan{(current?.bundleSellingPlans || []).length !== 1 ? 's' : ''} available
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Customer-Facing Text</Text>
              
              <TextField
                label="Upgrade Banner Message"
                value={uiCopy.cta || "You have items that can be bundled! Upgrade to {bundle} subscription and save."}
                onChange={(value) => setUiCopy({...uiCopy, cta: value})}
                helpText="Message shown when bundle components are detected. Use {bundle} for bundle name."
                multiline={2}
              />
              
              <TextField
                label="Upgrade Button Text"
                value={uiCopy.confirmBtn}
                onChange={(value) => setUiCopy({...uiCopy, confirmBtn: value})}
                helpText="Text for the upgrade button"
              />
              
              <TextField
                label="Modal Title Prefix"
                value={uiCopy.ctaSubscribe || "Upgrade to"}
                onChange={(value) => setUiCopy({...uiCopy, ctaSubscribe: value})}
                helpText="Prefix for the modal title (e.g., 'Upgrade to [Bundle Name]')"
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

      {/* Product Picker Modal */}
      <ProductPickerModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={handleProductSelection}
        products={products}
        selectedVariantIds={editingComponentIndex >= 0 ? components[editingComponentIndex]?.variantIds || [] : []}
        title={`Select Products for ${editingComponentIndex >= 0 ? components[editingComponentIndex]?.label || 'Component' : 'Component'}`}
      />
    </Page>
  );
}

// Product Picker Modal Component
function ProductPickerModal({ isOpen, onClose, onSelect, products, selectedVariantIds, title }) {
  const [selectedIds, setSelectedIds] = React.useState(new Set(selectedVariantIds));

  React.useEffect(() => {
    setSelectedIds(new Set(selectedVariantIds));
  }, [selectedVariantIds]);

  const handleVariantToggle = (variantId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(variantId)) {
        newSet.delete(variantId);
      } else {
        newSet.add(variantId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (productVariants, select) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      productVariants.forEach(variant => {
        if (select) {
          newSet.add(variant.id);
        } else {
          newSet.delete(variant.id);
        }
      });
      return newSet;
    });
  };

  const handleConfirm = () => {
    onSelect(Array.from(selectedIds));
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={title}
      primaryAction={{
        content: `Select ${selectedIds.size} variant${selectedIds.size !== 1 ? 's' : ''}`,
        onAction: handleConfirm,
        disabled: selectedIds.size === 0
      }}
      secondaryActions={[{
        content: "Cancel",
        onAction: onClose
      }]}
      large
    >
      <Modal.Section>
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {products.map(product => {
            const variants = product.variants.edges.map(edge => edge.node);
            const productSelectedCount = variants.filter(v => selectedIds.has(v.id)).length;
            const allSelected = productSelectedCount === variants.length;

            return (
              <Card key={product.id} sectioned>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <InlineStack gap="300">
                      {product.featuredMedia?.image && (
                        <Thumbnail
                          source={product.featuredMedia.image.url}
                          alt={product.featuredMedia.image.altText || product.title}
                          size="small"
                        />
                      )}
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">{product.title}</Text>
                        <Text as="p" tone="subdued" variant="bodySm">
                          {variants.length} variant{variants.length !== 1 ? 's' : ''}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                    
                    <Button
                      size="sm"
                      onClick={() => handleSelectAll(variants, !allSelected)}
                    >
                      {allSelected ? "Deselect All" : "Select All"}
                    </Button>
                  </InlineStack>

                  <div style={{ paddingLeft: '52px' }}>
                    <BlockStack gap="200">
                      {variants.map(variant => (
                        <InlineStack key={variant.id} align="space-between">
                          <InlineStack gap="300">
                            <Checkbox
                              checked={selectedIds.has(variant.id)}
                              onChange={() => handleVariantToggle(variant.id)}
                            />
                            <BlockStack gap="050">
                              <Text as="p" variant="bodyMd">
                                {variant.title}
                              </Text>
                              <Text as="p" tone="subdued" variant="bodySm">
                                ${variant.price} {variant.sku && `• SKU: ${variant.sku}`}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  </div>
                </BlockStack>
              </Card>
            );
          })}
        </div>
      </Modal.Section>
    </Modal>
  );
}