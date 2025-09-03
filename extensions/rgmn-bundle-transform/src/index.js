export async function run(input) {
    const applyAttr = input.cart?.attribute?.value ?? "";
    const match = /^one_time:(\d+)$/.exec(applyAttr || "");
    if (!match) return { operations: [] };

    // Selling plans present? bail (Shopify rejects merge/expand w/ plans)
    if (input.cart.lines.some(l => !!l.sellingPlanAllocation)) return { operations: [] };

    const setsRequested = Math.max(0, Number(match[1] || 0));
    if (!setsRequested) return { operations: [] };

    const cfgRaw = input.cartTransform?.config?.value;
    if (!cfgRaw) return { operations: [] };
    const config = JSON.parse(cfgRaw);
    const components = config.components || [];

    // Build pools of lines per component
    const pools = new Map(components.map(c => [c.key, []]));
    for (const line of input.cart.lines) {
      const vId = line.merchandise?.id;
      const comp = components.find(c => (c.variantIds || []).includes(vId));
      if (comp) pools.get(comp.key).push({ id: line.id, qty: line.quantity });
    }

    // Compute max sets available
    const maxSets = Math.min(
      ...components.map(c => {
        const total = (pools.get(c.key) || []).reduce((s, l) => s + l.qty, 0);
        return Math.floor(total / (c.required || 1));
      })
    );

    const sets = Math.min(setsRequested, maxSets);
    if (!Number.isFinite(sets) || sets <= 0) return { operations: [] };

    const ops = [];
    for (let s = 0; s < sets; s++) {
      const cartLines = [];
      for (const c of components) {
        let need = c.required || 1;
        const bucket = pools.get(c.key);
        while (need > 0 && bucket.length) {
          const l = bucket[0];
          const take = Math.min(need, l.qty);
          cartLines.push({ cartLineId: l.id, quantity: take });
          l.qty -= take;
          if (l.qty === 0) bucket.shift();
          need -= take;
        }
      }
      ops.push({
        linesMerge: {
          attributes: [],
          cartLines,
          parentVariantId: config.bundleVariantId,
          title: null,
          image: null,
          price: null
        }
      });
    }

    return { operations: ops };
}