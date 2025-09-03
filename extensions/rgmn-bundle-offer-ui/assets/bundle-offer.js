async function getCart() {
  const r = await fetch('/cart.js', { credentials: 'same-origin' });
  return r.json();
}
function parseConfig() {
  const el = document.querySelector('[data-rgmn-bundle-config]');
  return el ? JSON.parse(el.textContent || '{}') : {};
}
function computeSets(cart, config) {
  if (!config.components?.length) return { sets: 0 };
  const bundleNum = Number((config.bundleVariantId || '').split('/').pop());
  if (cart.items.some(i => i.variant_id === bundleNum)) return { sets: 0 };
  const counts = Object.fromEntries(config.components.map(c => [c.key, 0]));
  for (const item of cart.items) {
    const gid = `gid://shopify/ProductVariant/${item.variant_id}`;
    const comp = config.components.find(c => (c.variantIds || []).includes(gid));
    if (comp) counts[comp.key] += item.quantity;
  }
  const sets = Math.min(...config.components.map(c => Math.floor((counts[c.key] || 0) / (c.required || 1))));
  return { sets: Number.isFinite(sets) ? sets : 0 };
}
function cartHasAnySellingPlan(cart) {
  return cart.items.some(i => !!i.selling_plan_allocation || !!i.selling_plan);
}
function buildDecrements(cart, config, sets) {
  const decrements = {};
  const byKey = new Map(config.components.map(c => [c.key, []]));
  for (const line of cart.items) {
    const gid = `gid://shopify/ProductVariant/${line.variant_id}`;
    const comp = config.components.find(c => (c.variantIds || []).includes(gid));
    if (comp) byKey.get(comp.key).push(line);
  }
  for (const c of config.components) {
    let need = (c.required || 1) * sets;
    const pool = byKey.get(c.key) || [];
    for (const line of pool) {
      if (need <= 0) break;
      const take = Math.min(need, line.quantity);
      decrements[line.key] = line.quantity - take;
      need -= take;
    }
  }
  return decrements;
}
async function applyOneTimeViaFunction(sets) {
  await fetch('/cart/update.js', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ attributes: { rgmn_bundle_apply: `one_time:${sets}` } }) });
  await fetch('/cart/update.js', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ attributes: { rgmn_bundle_apply: '0' } }) });
  location.reload();
}
async function applySubscriptionViaAjax({ sets, bundleVariantId, bundlePlanId, decrements }) {
  await fetch('/cart/update.js', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ updates: decrements }) });
  await fetch('/cart/add.js', {
    method: 'POST', headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ items: [{ id: Number(bundleVariantId.split('/').pop()), quantity: sets, selling_plan: bundlePlanId }] })
  });
  location.reload();
}
function renderCTA({ sets, config, hasSubs }) {
  const el = document.getElementById('rgmn-bundle-offer');
  if (!el) return;
  const copy = config.uiCopy || {};
  const bundleName = config.bundleTitle || 'Bundle';
  const cta = (copy.cta || 'Replace {sets} set(s) with the {bundle} and save?').replace('{sets}', sets).replace('{bundle}', bundleName);
  
  // Enhanced UI with better styling
  el.innerHTML = `
    <div class="rgmn-offer">
      <div class="rgmn-offer-header">
        <div class="rgmn-offer-icon">🎁</div>
        <div class="rgmn-offer-content">
          <h3 class="rgmn-offer-title">Bundle Offer Available!</h3>
          <p class="rgmn-offer-description">${cta}</p>
        </div>
      </div>
      
      <div class="rgmn-offer-controls">
        <div class="rgmn-purchase-options">
          <div class="rgmn-option">
            <label class="rgmn-radio-label">
              <input type="radio" name="rgmn-mode" value="one-time" ${hasSubs ? '' : 'checked'}>
              <span class="rgmn-radio-custom"></span>
              <div class="rgmn-option-details">
                <span class="rgmn-option-title">${copy.oneTimeLabel || 'One-time purchase'}</span>
                <span class="rgmn-option-subtitle">No commitment</span>
              </div>
            </label>
          </div>
          
          ${(config.bundleSellingPlans || []).length > 0 ? `
          <div class="rgmn-option">
            <label class="rgmn-radio-label">
              <input type="radio" name="rgmn-mode" value="subscribe" ${hasSubs ? 'checked' : ''}>
              <span class="rgmn-radio-custom"></span>
              <div class="rgmn-option-details">
                <span class="rgmn-option-title">${copy.ctaSubscribe || 'Subscribe & save'}</span>
                <span class="rgmn-option-subtitle">Get it delivered regularly</span>
              </div>
            </label>
          </div>
          ` : ''}
        </div>
        
        <select id="rgmn-plan" class="rgmn-plan-selector" style="display:none">
          <option value="">Select delivery frequency...</option>
        </select>
        
        <div class="rgmn-offer-actions">
          <button id="rgmn-apply" class="rgmn-apply-btn">
            <span class="rgmn-btn-text">${copy.confirmBtn || 'Yes, upgrade to bundle'}</span>
            <span class="rgmn-btn-icon">→</span>
          </button>
          <button id="rgmn-dismiss" class="rgmn-dismiss-btn">
            No thanks
          </button>
        </div>
      </div>
    </div>`;

  // Add enhanced styling
  if (!document.getElementById('rgmn-bundle-styles')) {
    const styles = document.createElement('style');
    styles.id = 'rgmn-bundle-styles';
    styles.textContent = `
      .rgmn-offer {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 12px;
        padding: 20px;
        margin: 16px 0;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .rgmn-offer-header {
        display: flex;
        align-items: center;
        margin-bottom: 20px;
      }
      
      .rgmn-offer-icon {
        font-size: 32px;
        margin-right: 16px;
      }
      
      .rgmn-offer-title {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
      }
      
      .rgmn-offer-description {
        margin: 0;
        opacity: 0.9;
        font-size: 16px;
        line-height: 1.4;
      }
      
      .rgmn-purchase-options {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      
      .rgmn-option {
        flex: 1;
        min-width: 200px;
      }
      
      .rgmn-radio-label {
        display: flex;
        align-items: center;
        background: rgba(255,255,255,0.1);
        border: 2px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      .rgmn-radio-label:hover {
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.4);
      }
      
      .rgmn-radio-label input:checked + .rgmn-radio-custom + .rgmn-option-details {
        opacity: 1;
      }
      
      .rgmn-radio-label input:checked ~ * {
        opacity: 1;
      }
      
      .rgmn-radio-label input {
        display: none;
      }
      
      .rgmn-radio-custom {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255,255,255,0.6);
        border-radius: 50%;
        margin-right: 12px;
        position: relative;
        transition: all 0.3s ease;
      }
      
      .rgmn-radio-label input:checked + .rgmn-radio-custom {
        border-color: white;
        background: white;
      }
      
      .rgmn-radio-label input:checked + .rgmn-radio-custom::after {
        content: '';
        width: 8px;
        height: 8px;
        background: #667eea;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      
      .rgmn-option-details {
        opacity: 0.7;
        transition: opacity 0.3s ease;
      }
      
      .rgmn-option-title {
        display: block;
        font-weight: 600;
        margin-bottom: 4px;
      }
      
      .rgmn-option-subtitle {
        font-size: 14px;
        opacity: 0.8;
      }
      
      .rgmn-plan-selector {
        width: 100%;
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        background: rgba(255,255,255,0.9);
        color: #333;
        font-size: 16px;
        margin-bottom: 16px;
      }
      
      .rgmn-offer-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      
      .rgmn-apply-btn {
        flex: 1;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 8px;
        padding: 16px 24px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.3s ease;
      }
      
      .rgmn-apply-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      
      .rgmn-dismiss-btn {
        background: none;
        border: 2px solid rgba(255,255,255,0.3);
        color: white;
        border-radius: 8px;
        padding: 12px 20px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
      }
      
      .rgmn-dismiss-btn:hover {
        background: rgba(255,255,255,0.1);
        border-color: rgba(255,255,255,0.5);
      }
      
      @media (max-width: 768px) {
        .rgmn-purchase-options {
          flex-direction: column;
        }
        
        .rgmn-option {
          min-width: auto;
        }
        
        .rgmn-offer-actions {
          flex-direction: column;
        }
        
        .rgmn-apply-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  const modeRadios = el.querySelectorAll('input[name="rgmn-mode"]');
  const planSel = el.querySelector('#rgmn-plan');
  const dismissBtn = el.querySelector('#rgmn-dismiss');
  
  const showPlans = () => {
    const mode = [...modeRadios].find(r => r.checked)?.value;
    if (mode === 'subscribe' && (config.bundleSellingPlans || []).length > 0) {
      planSel.innerHTML = [
        '<option value="">Select delivery frequency...</option>',
        ...(config.bundleSellingPlans || []).map(p => 
          `<option value="${p.id}">${p.label || `Every ${p.count} ${p.interval}${p.count !== 1 ? 's' : ''}`}</option>`
        )
      ].join('');
      planSel.style.display = 'block';
    } else {
      planSel.style.display = 'none';
    }
  };
  
  modeRadios.forEach(r => r.addEventListener('change', showPlans));
  showPlans();
  
  // Add dismiss functionality
  dismissBtn.addEventListener('click', () => {
    el.style.display = 'none';
    // Store dismissal in sessionStorage to avoid showing again in this session
    sessionStorage.setItem('rgmn-bundle-dismissed', 'true');
  });
  el.querySelector('#rgmn-apply').addEventListener('click', async () => {
    const cart = await getCart();
    const { sets } = computeSets(cart, config);
    if (sets <= 0) return;
    const selectedMode = [...modeRadios].find(r => r.checked)?.value;
    if (selectedMode === 'one-time' && !cartHasAnySellingPlan(cart)) {
      await applyOneTimeViaFunction(sets);
    } else {
      // subscription path (or mixed cart)
      const decrements = buildDecrements(cart, config, sets);
      const planId = selectedMode === 'subscribe'
        ? Number(planSel.value)
        : (config?.defaults?.subscribeDefaultPlanIds || config?.bundleSellingPlans?.[0]?.id);
      await applySubscriptionViaAjax({ sets, bundleVariantId: config.bundleVariantId, bundlePlanId: planId, decrements });
    }
  });
}
(async () => {
  try {
    // Check if user has dismissed the offer in this session
    if (sessionStorage.getItem('rgmn-bundle-dismissed') === 'true') {
      return;
    }

    const config = parseConfig();
    if (!config.components?.length) return;
    const cart = await getCart();
    const { sets } = computeSets(cart, config);
    if (sets > 0) renderCTA({ sets, config, hasSubs: cartHasAnySellingPlan(cart) });
  } catch {}
})();