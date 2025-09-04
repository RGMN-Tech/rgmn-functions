export async function run(input) {
    console.log('🔧 Cart Transform Function called with input:', JSON.stringify(input, null, 2));
    
    // This function now only handles manual bundle upgrades when specifically requested
    const applyAttr = input.cart?.attribute?.value ?? "";
    console.log('🔍 Cart attribute value:', applyAttr);
    
    const match = /^manual_bundle_upgrade:(.+)$/.exec(applyAttr || "");
    if (!match) {
        console.log('❌ No manual bundle upgrade attribute found, returning empty operations');
        return { operations: [] };
    }

    const requestData = JSON.parse(match[1]);
    console.log('📦 Parsed request data:', requestData);
    
    const { bundleVariantId, itemsToRemove, subscriptionPlanId, itemsToAdd = [] } = requestData;

    if (!bundleVariantId || !itemsToRemove || itemsToRemove.length === 0) {
        console.log('❌ Invalid request data, returning empty operations');
        return { operations: [] };
    }

    const operations = [];

    // Remove/reduce the individual items that are being bundled (preserve excess quantities)
    for (const item of itemsToRemove) {
        operations.push({
            update: {
                cartLineId: item.cartLineId,
                quantity: Math.max(0, item.currentQuantity - item.quantityToRemove)
            }
        });
    }

    // Add any missing items that were already added to cart by the frontend
    // Note: The frontend handles adding missing items, so we don't need to do it here
    // This is just for reference in case we need to handle it server-side in the future

    // Add the bundle as a subscription
    operations.push({
        add: {
            variantId: bundleVariantId,
            quantity: 1,
            sellingPlanId: subscriptionPlanId
        }
    });

    console.log('✅ Generated operations:', operations);
    return { operations };
}