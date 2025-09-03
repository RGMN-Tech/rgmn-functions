export async function run(input) {
    // This function now only handles manual bundle upgrades when specifically requested
    const applyAttr = input.cart?.attribute?.value ?? "";
    const match = /^manual_bundle_upgrade:(.+)$/.exec(applyAttr || "");
    if (!match) return { operations: [] };

    const requestData = JSON.parse(match[1]);
    const { bundleVariantId, itemsToRemove, subscriptionPlanId } = requestData;

    if (!bundleVariantId || !itemsToRemove || itemsToRemove.length === 0) {
        return { operations: [] };
    }

    const operations = [];

    // Remove the individual items that are being bundled
    for (const item of itemsToRemove) {
        operations.push({
            update: {
                cartLineId: item.cartLineId,
                quantity: Math.max(0, item.currentQuantity - item.quantityToRemove)
            }
        });
    }

    // Add the bundle as a subscription
    operations.push({
        add: {
            variantId: bundleVariantId,
            quantity: 1,
            sellingPlanId: subscriptionPlanId
        }
    });

    return { operations };
}