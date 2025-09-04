// RGMN Bundle Offer - Manual Upgrade System
// Shows upgrade button when bundle components are detected
// Opens modal for user to manually confirm bundle upgrade

function parseConfig() {
  const el = document.querySelector('script[data-rgmn-bundle-config]');
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

async function getCart() {
  const res = await fetch('/cart.js');
  return res.json();
}

function findBundleComponents(cart, config) {
  const components = config.components || [];
  const bundleItems = [];
  const componentCounts = new Map();
  
  // Initialize component counts
  components.forEach(comp => componentCounts.set(comp.key, 0));
  
  for (const line of cart.items) {
    const vId = line.variant_id ? `gid://shopify/ProductVariant/${line.variant_id}` : "";
    const comp = components.find(c => (c.variantIds || []).includes(vId));
    if (comp) {
      bundleItems.push({
        cartLineId: line.key,
        variantId: vId,
        productTitle: line.product_title,
        variantTitle: line.variant_title,
        quantity: line.quantity,
        price: line.price,
        image: line.image,
        component: comp
      });
      componentCounts.set(comp.key, componentCounts.get(comp.key) + line.quantity);
    }
  }
  
  // Check if we have at least one of each required component
  const hasAllComponents = components.every(comp => 
    componentCounts.get(comp.key) >= (comp.required || 1)
  );
  
  // Find missing components and their details
  const missingComponents = components.filter(comp => 
    componentCounts.get(comp.key) < (comp.required || 1)
  ).map(comp => ({
    ...comp,
    needed: (comp.required || 1) - componentCounts.get(comp.key),
    hasAny: componentCounts.get(comp.key) > 0
  }));
  
  return { 
    hasAnyComponent: bundleItems.length > 0,
    hasAllComponents,
    bundleItems,
    componentCounts,
    missingComponents
  };
}

function renderUpgradeButton({ bundleComponents, config }) {
  const el = document.getElementById('rgmn-bundle-offer');
  if (!el) return;
  
  const { hasAnyComponent, hasAllComponents, bundleItems, missingComponents } = bundleComponents;
  
  if (!hasAnyComponent) {
    el.style.display = 'none';
    return;
  }

  const copy = config.uiCopy || {};
  const bundleName = config.bundleTitle || 'Bundle';
  
  // Always show upgrade option when any component is present
  let message, buttonText, buttonEnabled;
  
  if (hasAllComponents) {
    message = `You have all items for the ${bundleName}! Upgrade to subscription and save.`;
    buttonText = "Upgrade & Save";
    buttonEnabled = true;
  } else {
    const missingCount = missingComponents.reduce((sum, comp) => sum + comp.needed, 0);
    message = `Start your ${bundleName} subscription! We'll add ${missingCount} missing item${missingCount !== 1 ? 's' : ''} to complete your bundle.`;
    buttonText = "Complete Bundle";
    buttonEnabled = true;
  }

  el.innerHTML = `
    <div class="rgmn-upgrade-banner">
      <div class="rgmn-upgrade-content">
        <div class="rgmn-upgrade-icon">🎁</div>
        <div class="rgmn-upgrade-text">
          <h3>${message}</h3>
          <p>${bundleItems.length} bundle item${bundleItems.length !== 1 ? 's' : ''} in your cart${!hasAllComponents ? ` • ${missingComponents.length} component${missingComponents.length !== 1 ? 's' : ''} needed` : ''}</p>
        </div>
        <button id="rgmn-upgrade-btn" class="rgmn-upgrade-button" ${!buttonEnabled ? 'disabled' : ''}>
          ${buttonText}
        </button>
      </div>
    </div>`;

  // Add styling
  addUpgradeStyles();
  
  // Add click handler
  document.getElementById('rgmn-upgrade-btn').addEventListener('click', () => {
    showUpgradeModal(bundleComponents, config);
  });
}

function addUpgradeStyles() {
  if (document.getElementById('rgmn-upgrade-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'rgmn-upgrade-styles';
  styles.textContent = `
    .rgmn-upgrade-banner {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .rgmn-upgrade-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .rgmn-upgrade-icon {
      font-size: 32px;
      flex-shrink: 0;
    }
    
    .rgmn-upgrade-text {
      flex: 1;
    }
    
    .rgmn-upgrade-text h3 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 600;
    }
    
    .rgmn-upgrade-text p {
      margin: 0;
      opacity: 0.9;
      font-size: 14px;
    }
    
    .rgmn-upgrade-button {
      background: white;
      color: #667eea;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    
    .rgmn-upgrade-button:hover:not(:disabled) {
      transform: translateY(-2px);
    }
    
    .rgmn-upgrade-button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    
    .rgmn-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .rgmn-modal {
      background: white;
      border-radius: 12px;
      max-width: 500px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .rgmn-modal-header {
      padding: 24px 24px 16px;
      border-bottom: 1px solid #e5e5e5;
    }
    
    .rgmn-modal-body {
      padding: 24px;
    }
    
    .rgmn-modal-footer {
      padding: 16px 24px 24px;
      border-top: 1px solid #e5e5e5;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    
    .rgmn-bundle-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    
    .rgmn-bundle-item img {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 4px;
    }
    
    .rgmn-item-details {
      flex: 1;
    }
    
    .rgmn-item-details h4 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
    }
    
    .rgmn-item-details p {
      margin: 0;
      font-size: 12px;
      color: #666;
    }
    
    .rgmn-bundle-item-missing {
      background: #f0f9ff;
      border-color: #0369a1;
    }
    
    .rgmn-item-icon {
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0369a1;
      color: white;
      border-radius: 4px;
      font-size: 24px;
      font-weight: bold;
    }
    
    .rgmn-btn-primary {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 12px 24px;
      font-weight: 600;
      cursor: pointer;
    }
    
    .rgmn-btn-secondary {
      background: #f5f5f5;
      color: #333;
      border: none;
      border-radius: 6px;
      padding: 12px 24px;
      cursor: pointer;
    }
    
    @media (max-width: 768px) {
      .rgmn-upgrade-content {
        flex-direction: column;
        text-align: center;
        gap: 12px;
      }
      
      .rgmn-upgrade-button {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(styles);
}

function showUpgradeModal(bundleComponents, config) {
  const { bundleItems, hasAllComponents, missingComponents, componentCounts } = bundleComponents;
  const bundleName = config.bundleTitle || 'Bundle';
  const components = config.components || [];
  
  // Show what missing components will be included in the bundle
  const missingItemsHtml = missingComponents.length > 0 ? `
    <h3>Missing components included in your ${bundleName}:</h3>
    ${missingComponents.map(comp => {
      return `
        <div class="rgmn-bundle-item rgmn-bundle-item-missing">
          <div class="rgmn-item-icon">📦</div>
          <div class="rgmn-item-details">
            <h4>${comp.label}</h4>
            <p>Qty: ${comp.needed} • Included in your bundle subscription</p>
          </div>
        </div>
      `;
    }).join('')}
  ` : '';
  
  const modalHtml = `
    <div class="rgmn-modal-overlay" id="rgmn-modal">
      <div class="rgmn-modal">
        <div class="rgmn-modal-header">
          <h2>Complete Your ${bundleName}</h2>
          <p>Switch to a subscription and save on your regular order</p>
        </div>
        
        <div class="rgmn-modal-body">
          <h3>Items currently in your cart:</h3>
          ${bundleItems.map(item => {
            const bundleQty = Math.min(item.quantity, item.component.required || 1);
            const excessQty = item.quantity - bundleQty;
            
            return `
              <div class="rgmn-bundle-item">
                <img src="${item.image}" alt="${item.productTitle}">
                <div class="rgmn-item-details">
                  <h4>${item.productTitle}</h4>
                  <p>${item.variantTitle} • Bundle: ${bundleQty}${excessQty > 0 ? ` • Remaining: ${excessQty}` : ''} • $${(item.price / 100).toFixed(2)}</p>
                </div>
              </div>
            `;
          }).join('')}
          
          ${missingItemsHtml}
          
          ${hasAllComponents ? `
            <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h4 style="margin: 0 0 8px 0; color: #0369a1;">✓ Ready to bundle!</h4>
              <p style="margin: 0; color: #0369a1;">You have all the items needed. Upgrade to subscription and save!</p>
            </div>
          ` : `
            <div style="background: #e0f2fe; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h4 style="margin: 0 0 8px 0; color: #0277bd;">📦 Bundle Upgrade</h4>
              <p style="margin: 0; color: #0277bd;">Your ${bundleName} subscription includes all components shown above. Any extra quantities will remain as one-time purchases.</p>
            </div>
          `}
        </div>
        
        <div class="rgmn-modal-footer">
          <button class="rgmn-btn-secondary" onclick="closeUpgradeModal()">
            Close
          </button>
          <button class="rgmn-btn-primary" onclick="confirmBundleUpgrade()">
            ${hasAllComponents ? 'Upgrade to Subscription' : 'Complete Bundle Subscription'}
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Store data for upgrade
  window.rgmnBundleData = { bundleComponents, config };
}

function closeUpgradeModal() {
  const modal = document.getElementById('rgmn-modal');
  if (modal) {
    modal.remove();
  }
  delete window.rgmnBundleData;
}

async function confirmBundleUpgrade() {
  const { bundleComponents, config } = window.rgmnBundleData;
  const { bundleItems, missingComponents } = bundleComponents;
  
  console.log('🎯 Bundle upgrade started:', {
    bundleItems,
    missingComponents,
    config
  });
  
  // Get the first selling plan ID (assuming bundle has subscription plans)
  const subscriptionPlanId = config.bundleSellingPlans?.[0]?.id;
  if (!subscriptionPlanId) {
    alert('No subscription plan configured for this bundle. Please contact support or configure selling plans for your bundle product in Shopify admin.');
    return;
  }
  
  // Prepare items to remove (only the quantities needed for the bundle)
  const itemsToRemove = bundleItems.map(item => ({
    cartLineId: item.cartLineId,
    currentQuantity: item.quantity,
    quantityToRemove: Math.min(item.quantity, item.component.required || 1)
  }));
  
  // No need to add individual components - the bundle product contains everything
  const itemsToAdd = [];
  
  try {
    await applyBundleUpgrade(config.bundleVariantId, itemsToRemove, subscriptionPlanId, itemsToAdd);
  } catch (error) {
    console.error('Bundle upgrade failed:', error);
    alert('Sorry, there was an error upgrading your bundle. Please try again.');
  }
}

async function applyBundleUpgrade(bundleVariantId, itemsToRemove, subscriptionPlanId, itemsToAdd = []) {
  const upgradeData = {
    bundleVariantId,
    itemsToRemove,
    subscriptionPlanId,
    itemsToAdd
  };
  
  try {
    console.log('📤 Starting bundle upgrade process:', upgradeData);
    
    // Extract numeric ID from GraphQL ID for cart API
    const numericVariantId = bundleVariantId.replace('gid://shopify/ProductVariant/', '');
    const numericSellingPlanId = subscriptionPlanId.replace('gid://shopify/SellingPlan/', '');
    
    // Step 1: Add the bundle product to cart
    console.log('🛒 Step 1: Adding bundle product to cart...', { numericVariantId, numericSellingPlanId });
    const addResponse = await fetch('/cart/add.js', {
      method: 'POST', 
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ 
        id: numericVariantId,
        quantity: 1,
        selling_plan: numericSellingPlanId
      })
    });
    
    console.log('📥 Add bundle response:', addResponse.status, addResponse.statusText);
    
    if (!addResponse.ok) {
      const responseText = await addResponse.text();
      console.error('❌ Add bundle failed:', responseText);
      throw new Error(`Add bundle failed: ${addResponse.status}`);
    }
    
    console.log('✅ Bundle added successfully');
    
    // Step 2: Remove individual items from cart
    console.log('🗑️ Step 2: Removing individual items from cart...');
    for (const item of itemsToRemove) {
      console.log('Removing item:', item.cartLineId, 'quantity:', item.quantityToRemove);
      
      const removeResponse = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.cartLineId,
          quantity: item.currentQuantity - item.quantityToRemove
        })
      });
      
      if (!removeResponse.ok) {
        const responseText = await removeResponse.text();
        console.error('❌ Remove item failed:', responseText);
        throw new Error(`Remove item failed: ${removeResponse.status}`);
      }
      
      console.log('✅ Item removed successfully');
    }
    
    console.log('🎉 Bundle upgrade completed successfully!');
    // To do: handle the cart update response and trigger a cart update event
    location.reload();
  } catch (error) {
    console.error('Bundle upgrade error:', error);
    throw error;
  }
}

// Initialize the system
(async () => {
  try {
    // Check if user has dismissed the offer in this session
    if (sessionStorage.getItem('rgmn-bundle-dismissed') === 'true') {
      return;
    }

    const config = parseConfig();
    if (!config || !config.components?.length) return;
    
    const cart = await getCart();
    const bundleComponents = findBundleComponents(cart, config);
    
    if (bundleComponents.hasAnyComponent) {
      renderUpgradeButton({ bundleComponents, config });
    }
  } catch (error) {
    console.error('RGMN Bundle error:', error);
  }
})();