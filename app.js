/* Rang-e-Saleha storefront — renders from products.json and settings.json */
(async function(){
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => 'PKR ' + Math.round(Number(n)).toLocaleString('en-PK');
  const store = {
    get(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };
  const img = (u, w) => !u ? '' : (u.includes('images.unsplash.com') ? u + '&w=' + w : u);
  const v = Date.now();
  async function load(f){ try { const r = await fetch(f + '?v=' + v, {cache:'no-store'}); if(r.ok) return await r.json(); } catch(e){} return null; }
  const [P0, S0] = await Promise.all([load('products.json'), load('settings.json')]);
  const S = Object.assign({ whatsapp:'923299848040', phone:'0329 9848040', email:'rangesaleha@gmail.com', freeDeliveryAbove:15000, deliveryFee:350, promo:[], hero:{} }, S0 || {});
  const P = (P0 || []).filter(p => !p.hidden).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  const WA = S.whatsapp;
  const byId = id => P.find(p => p.id === id);
  const finalPrice = p => p.discount > 0 ? Math.round(p.price * (100 - p.discount) / 100) : p.price;
  const soldOut = p => p.status === 'sold_out';

  function toast(msg){
    let t = $('.toast'); if(!t){ t = document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2400);
  }

  /* ---------- settings into the page ---------- */
  $$('[data-setting]').forEach(el => { const k = el.dataset.setting; if(S[k]) el.textContent = S[k]; });
  if(S.promo && S.promo.filter(Boolean).length){
    const t = $('.promo-track'); if(t) t.innerHTML = S.promo.filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('');
  }
  if(S.sale && S.sale.enabled && S.sale.text){
    const bar = document.createElement('div'); bar.className = 'sale-bar'; bar.innerHTML = `<a href="shop.html?sale=1">${esc(S.sale.text)}</a>`;
    $('.site-header')?.before(bar);
  }

  /* ---------- product card ---------- */
  function card(p){
    const fp = finalPrice(p);
    let tag = '';
    if(soldOut(p)) tag = '<span class="card-tag sold">Sold out</span>';
    else if(p.discount > 0) tag = `<span class="card-tag sale">-${p.discount}%</span>`;
    else if(p.badge) tag = `<span class="card-tag">${esc(p.badge)}</span>`;
    const second = p.images && p.images[1] ? `<img class="alt" src="${img(p.images[1],700)}" alt="" loading="lazy">` : '';
    return `<article class="card" data-id="${esc(p.id)}">
<div class="card-media">
<a href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}"><img src="${img(p.images?.[0],700)}" alt="${esc(p.name)} by Rang-e-Saleha" loading="lazy" width="700" height="933">${second}</a>
${tag}<button class="wish" type="button" data-wish="${esc(p.id)}" aria-label="Save ${esc(p.name)} to wishlist" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9Z"/></svg></button>
${soldOut(p) ? '' : `<button class="btn btn-gold quick" type="button" data-quick-add="${esc(p.id)}">Quick add</button>`}
</div>
<p class="card-cat">${esc(p.category)}</p>
<h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
<p class="price" style="margin:0">${fmt(fp)}${p.discount > 0 ? `<s>${fmt(p.price)}</s>` : ''}</p>
</article>`;
  }
  const fill = (el, list, empty) => { if(!el) return; el.innerHTML = list.length ? list.map(card).join('') : (empty ? `<p class="empty" style="grid-column:1/-1">${empty}</p>` : ''); };

  /* ---------- counts ---------- */
  const cart = () => store.get('rs_cart', []).filter(i => byId(i.id));
  const wish = () => store.get('rs_wish', []);
  function counts(){
    const c = cart().reduce((a,i)=>a+i.qty,0), w = wish().filter(byId).length;
    $$('[data-cart-count]').forEach(b=>{ b.textContent = c || ''; b.dataset.n = c; });
    $$('[data-wish-count]').forEach(b=>{ b.textContent = w || ''; b.dataset.n = w; });
    $$('[data-wish]').forEach(b=>{ const on = wish().includes(b.dataset.wish); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  function addToCart(id, size, qty){
    const c = store.get('rs_cart', []); const f = c.find(i => i.id===id && i.size===size);
    if(f) f.qty += qty; else c.push({id, size, qty});
    store.set('rs_cart', c); counts(); toast('Added to bag');
  }
  function toggleWish(id){
    let w = wish(); w = w.includes(id) ? w.filter(x=>x!==id) : [...w, id];
    store.set('rs_wish', w); counts(); toast(w.includes(id) ? 'Saved to wishlist' : 'Removed from wishlist');
    if($('#wish-grid')) renderWish();
  }
  document.addEventListener('click', e => {
    const w = e.target.closest('[data-wish]'); if(w){ e.preventDefault(); toggleWish(w.dataset.wish); }
    const q = e.target.closest('[data-quick-add]'); if(q){ e.preventDefault(); const p = byId(q.dataset.quickAdd); addToCart(p.id, (p.sizes||[])[0] || 'One size', 1); }
  });

  /* ---------- header ---------- */
  const mt = $('.menu-toggle'), nav = $('.nav');
  if(mt) mt.addEventListener('click', ()=>{ const o = nav.classList.toggle('open'); mt.setAttribute('aria-expanded', o); });
  const st = $('[data-search-toggle]'), sp = $('.search-panel');
  if(st) st.addEventListener('click', ()=>{ const o = sp.classList.toggle('open'); st.setAttribute('aria-expanded', o); if(o) $('input', sp).focus(); });
  const track = $('.promo-track');
  if(track && track.children.length > 1){ let i=0; const n = track.children.length; setInterval(()=>{ i=(i+1)%n; track.style.transform = `translateY(-${i*18}px)`; }, 3800); }

  /* ---------- home ---------- */
  const hero = $('.hero');
  if(hero){
    const H = S.hero || {};
    if(H.eyebrow) $('.hero .eyebrow').textContent = H.eyebrow;
    if(H.title) $('.hero h1').textContent = H.title;
    if(H.subtitle) $('.hero-content > p:not(.eyebrow)').textContent = H.subtitle;
    if(H.images && H.images.filter(Boolean).length){
      const imgs = H.images.filter(Boolean);
      $$('.hero-slide, .hero-dots').forEach(x => x.remove());
      const dots = document.createElement('div'); dots.className = 'hero-dots'; dots.setAttribute('role','group'); dots.setAttribute('aria-label','Choose slide');
      imgs.forEach((u,i) => {
        const s = document.createElement('div'); s.className = 'hero-slide' + (i===0 ? ' active' : '');
        s.innerHTML = `<img src="${img(u,1800)}" alt="" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>`; hero.insertBefore(s, $('.hero-content'));
        dots.insertAdjacentHTML('beforeend', `<button type="button" aria-label="Slide ${i+1}" class="${i===0?'active':''}"></button>`);
      });
      if(imgs.length > 1) hero.appendChild(dots);
    }
    const slides = $$('.hero-slide'), hd = $$('.hero-dots button');
    if(slides.length > 1){
      let cur = 0;
      const go = n => { slides[cur].classList.remove('active'); hd[cur]?.classList.remove('active'); cur = n; slides[cur].classList.add('active'); hd[cur]?.classList.add('active'); };
      hd.forEach((d,i)=>d.addEventListener('click', ()=>go(i)));
      setInterval(()=>go((cur+1)%slides.length), 6000);
    }
    const groups = { best: P.filter(p => p.bestSeller), new: P.filter(p => p.newArrival), bridal: P.filter(p => p.category === 'Bridal') };
    const hg = $('#home-grid');
    const showTab = k => fill(hg, groups[k].slice(0,8), 'New designs coming soon.');
    showTab('best');
    $$('[data-tabs] .tab').forEach(t => t.addEventListener('click', () => { $$('[data-tabs] .tab').forEach(x => x.setAttribute('aria-selected', x===t)); showTab(t.dataset.tab); counts(); }));
    fill($('#unstitched-grid'), P.filter(p => p.category === 'Unstitched').slice(0,4));
  }

  /* ---------- category grids (e.g. wedding edit) ---------- */
  $$('[data-cat-grid]').forEach(g => fill(g, P.filter(p => p.category === g.dataset.catGrid)));

  /* ---------- shop ---------- */
  const shop = $('#shop-grid');
  if(shop){
    const params = new URLSearchParams(location.search);
    const cats = [...new Set(P.map(p => p.category))];
    const colors = [...new Set(P.map(p => p.color).filter(Boolean))].sort();
    $('#f-cat').innerHTML = cats.map(c => `<label><input type="checkbox" name="cat" value="${esc(c)}"> ${esc(c)}</label>`).join('');
    $('#f-color').innerHTML = colors.map(c => `<label><input type="checkbox" name="color" value="${esc(c)}"> ${esc(c)}</label>`).join('');
    const cat = params.get('cat'), q = (params.get('q')||'').toLowerCase().trim();
    if(cat){ const box = $(`input[name=cat][value="${CSS.escape(cat)}"]`); if(box) box.checked = true; }
    if(params.get('sale')) $('#f-sale').checked = true;
    if(q) $('#shop-title').firstChild.textContent = 'Search: “' + params.get('q') + '” · ';
    const apply = () => {
      const cs = $$('input[name=cat]:checked').map(i=>i.value);
      const cl = $$('input[name=color]:checked').map(i=>i.value);
      const price = ($('input[name=price]:checked')||{}).value || 'all';
      const sale = $('#f-sale').checked, sort = $('#sort').value;
      let list = P.filter(p => {
        const pr = finalPrice(p);
        let ok = (!cs.length || cs.includes(p.category)) && (!cl.length || cl.includes(p.color));
        if(price==='u25') ok = ok && pr < 25000; if(price==='25-100') ok = ok && pr>=25000 && pr<=100000; if(price==='o100') ok = ok && pr>100000;
        if(sale) ok = ok && p.discount > 0;
        if(q) ok = ok && `${p.name} ${p.category} ${p.color} ${p.fabric} ${p.description}`.toLowerCase().includes(q);
        return ok;
      });
      if(sort==='low') list.sort((a,b)=>finalPrice(a)-finalPrice(b)); else if(sort==='high') list.sort((a,b)=>finalPrice(b)-finalPrice(a));
      fill(shop, list); counts();
      $('#result-count').textContent = list.length + (list.length===1 ? ' design' : ' designs');
      $('#shop-empty').hidden = list.length > 0;
    };
    document.addEventListener('change', e => { if(e.target.closest('.filters') || e.target.id==='sort') apply(); });
    $('#clear-filters')?.addEventListener('click', ()=>{ $$('.filters input').forEach(i=>{ i.checked = i.value==='all'; }); apply(); });
    apply();
  }

  /* ---------- product page ---------- */
  const pdp = $('#pdp');
  if(pdp){
    const p = byId(new URLSearchParams(location.search).get('id'));
    if(!p){ pdp.innerHTML = `<div class="empty"><p>This design is no longer available.</p><a class="btn" href="shop.html">Browse the collection</a></div>`; }
    else {
      const fp = finalPrice(p), sizes = p.sizes && p.sizes.length ? p.sizes : ['One size'];
      document.title = `${p.name} | ${p.category} | Rang-e-Saleha`;
      const desc = `${p.name} – ${p.category} by Rang-e-Saleha. ${fmt(fp)}. ${p.description || ''}`.slice(0,158);
      $('meta[name=description]')?.setAttribute('content', desc);
      $('meta[property="og:title"]')?.setAttribute('content', document.title);
      $('meta[property="og:image"]')?.setAttribute('content', img(p.images?.[0],1200));
      const canon = $('link[rel=canonical]'); if(canon) canon.href = location.origin + location.pathname + '?id=' + encodeURIComponent(p.id);
      const ld = document.createElement('script'); ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify({"@context":"https://schema.org","@type":"Product","name":p.name,"image":(p.images||[]).map(u=>new URL(img(u,1200), location.href).href),"description":p.description,"sku":p.sku,"brand":{"@type":"Brand","name":"Rang-e-Saleha"},"category":p.category,"color":p.color,"material":p.fabric,
        "offers":{"@type":"Offer","url":location.href,"priceCurrency":"PKR","price":fp,"availability": soldOut(p) ? "https://schema.org/OutOfStock" : p.status==='made_to_order' ? "https://schema.org/PreOrder" : "https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition"}});
      document.head.appendChild(ld);
      const imgs = (p.images||[]).filter(Boolean);
      const statusText = soldOut(p) ? 'Sold out' : p.status==='made_to_order' ? `Made to order · ready in ${esc(p.leadTime || '2–4 weeks')}` : 'In stock · ships in 3–5 working days';
      pdp.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb" style="color:var(--muted);padding-top:24px"><a href="index.html">Home</a> / <a href="shop.html?cat=${encodeURIComponent(p.category)}">${esc(p.category)}</a> / ${esc(p.name)}</nav>
<div class="pdp">
<div><div class="gallery-main"><img src="${img(imgs[0],1100)}" alt="${esc(p.name)} by Rang-e-Saleha"></div>
<div class="thumbs">${imgs.length>1 ? imgs.map((u,i)=>`<button type="button" class="${i?'':'active'}" data-full="${img(u,1100)}" aria-label="View image ${i+1}"><img src="${img(u,200)}" alt=""></button>`).join('') : ''}</div></div>
<div>
<p class="card-cat" style="margin:0">${esc(p.category)}</p>
<h1>${esc(p.name)}</h1>
<p class="price" style="margin:0">${fmt(fp)}${p.discount>0 ? `<s>${fmt(p.price)}</s> <span class="save">Save ${p.discount}%</span>` : ''}</p>
<p class="sku">${p.sku ? 'SKU: ' + esc(p.sku) + ' · ' : ''}${esc(p.fabric||'')}</p>
<p class="stock ${soldOut(p)?'out':''}">${statusText}</p>
<p>${esc(p.description||'')}</p>
${p.colors && p.colors.length ? `<div class="opt-label"><span>Colour</span></div><div class="sizes" data-group="color">${p.colors.map((c,i)=>`<button type="button" data-val="${esc(c)}" aria-pressed="${i===0}">${esc(c)}</button>`).join('')}</div>` : ''}
<div class="opt-label"><span>Size</span><a href="help.html#size-guide">Size guide</a></div>
<div class="sizes" data-group="size">${sizes.map(s=>`<button type="button" data-val="${esc(s)}" aria-pressed="${sizes.length===1}">${esc(s)}</button>`).join('')}</div>
<p id="size-msg" role="alert" style="color:var(--maroon);margin:8px 0 0;min-height:1.2em"></p>
<div class="opt-label"><span>Quantity</span></div>
<div class="qty"><button type="button" data-qty="-" aria-label="Decrease quantity">−</button><input id="qty" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-qty="+" aria-label="Increase quantity">+</button></div>
<div class="pdp-actions"><button class="btn" type="button" id="add-bag" ${soldOut(p)?'disabled':''}>${soldOut(p)?'Sold out':'Add to bag'}</button><button class="wish-lg" type="button" data-wish="${esc(p.id)}" aria-label="Save to wishlist" aria-pressed="false"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9Z"/></svg></button></div>
<a class="btn btn-line btn-block" id="wa-order" href="https://wa.me/${WA}" target="_blank" rel="noopener" style="margin-top:10px">Order on WhatsApp</a>
<p class="notice">Free delivery above ${fmt(S.freeDeliveryAbove)} · Cash on delivery available · 7-day exchange</p>
<div class="acc">
<details open><summary>Details</summary><div class="acc-body"><ul>${p.fabric?`<li>Fabric: ${esc(p.fabric)}</li>`:''}${p.color?`<li>Colour: ${esc(p.color)}</li>`:''}${(p.details||'').split('\n').filter(Boolean).map(l=>`<li>${esc(l)}</li>`).join('')}</ul></div></details>
<details><summary>Care</summary><div class="acc-body"><ul><li>Dry clean recommended for embroidered pieces</li><li>Store in a muslin bag, away from direct sunlight</li><li>Iron on reverse at low heat</li></ul></div></details>
<details><summary>Delivery & exchange</summary><div class="acc-body"><p style="margin:0">Delivered across Pakistan. Exchange within 7 days for unworn items with tags. <a href="help.html#returns" style="text-decoration:underline">Read the policy</a>.</p></div></details>
</div></div></div>
<section style="padding-bottom:90px"><div class="section-head"><h2>You may also like</h2><div class="ornament"><i></i><b></b><i></i></div></div><div class="grid" id="related"></div></section>`;
      fill($('#related'), P.filter(x => x.category===p.category && x.id!==p.id).slice(0,4));
      $$('.thumbs button').forEach(b => b.addEventListener('click', () => { $('.gallery-main img').src = b.dataset.full; $$('.thumbs button').forEach(x=>x.classList.toggle('active', x===b)); }));
      $$('.sizes').forEach(g => $$('button', g).forEach(b => b.addEventListener('click', () => { $$('button', g).forEach(x=>x.setAttribute('aria-pressed', x===b)); $('#size-msg').textContent=''; })));
      const sel = g => ($(`.sizes[data-group="${g}"] button[aria-pressed="true"]`)||{}).dataset?.val;
      const qi = $('#qty');
      $('[data-qty="-"]').addEventListener('click', ()=>{ qi.value = Math.max(1, +qi.value-1); });
      $('[data-qty="+"]').addEventListener('click', ()=>{ qi.value = Math.min(10, +qi.value+1); });
      $('#add-bag').addEventListener('click', ()=>{
        const s = sel('size'); if(!s){ $('#size-msg').textContent = 'Please choose a size.'; return; }
        const c = sel('color'); addToCart(p.id, c ? `${s} · ${c}` : s, Math.max(1, +qi.value||1));
      });
      $('#wa-order').addEventListener('click', e=>{
        const s = sel('size') || 'to be confirmed', c = sel('color');
        e.currentTarget.href = `https://wa.me/${WA}?text=` + encodeURIComponent(`Assalam o Alaikum! I would like to order:\n${p.name}${p.sku?' ('+p.sku+')':''}\nSize: ${s}${c?'\nColour: '+c:''}\nQty: ${qi.value}\nPrice: ${fmt(fp)}\n${location.href}`);
      });
    }
  }

  /* ---------- cart ---------- */
  const cartList = $('#cart-list');
  function renderCart(){
    const c = cart();
    if(!c.length){ cartList.innerHTML = `<div class="empty"><p>Your bag is empty.</p><a class="btn" href="shop.html">Continue shopping</a></div>`; $('#cart-summary').hidden = true; return; }
    $('#cart-summary').hidden = false;
    cartList.innerHTML = c.map((i,idx)=>{ const p = byId(i.id); return `
      <div class="cart-item">
        <a href="product.html?id=${encodeURIComponent(p.id)}"><img src="${img(p.images?.[0],240)}" alt="${esc(p.name)}"></a>
        <div><h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3><small>${esc(p.category)} · ${esc(i.size)}</small>
          <div style="display:flex;align-items:center;gap:16px;margin-top:10px">
            <div class="qty"><button type="button" aria-label="Decrease" data-cq="${idx}" data-d="-1">−</button><input aria-label="Quantity" value="${i.qty}" readonly><button type="button" aria-label="Increase" data-cq="${idx}" data-d="1">+</button></div>
            <button class="link-btn" type="button" data-rm="${idx}">Remove</button>
          </div></div>
        <div class="price">${fmt(finalPrice(p)*i.qty)}</div>
      </div>`; }).join('');
    const sub = c.reduce((a,i)=>a+finalPrice(byId(i.id))*i.qty,0);
    const ship = sub >= S.freeDeliveryAbove ? 0 : S.deliveryFee;
    $('#sub').textContent = fmt(sub); $('#ship').textContent = ship ? fmt(ship) : 'Free'; $('#total').textContent = fmt(sub+ship);
    $('#free-note').textContent = `Free delivery on orders above ${fmt(S.freeDeliveryAbove)}.`;
    $('#order-details').value = c.map(i=>{ const p=byId(i.id); return `${p.name}${p.sku?' ('+p.sku+')':''} – ${i.size} x${i.qty} = ${fmt(finalPrice(p)*i.qty)}`; }).join('\n') + `\nSubtotal: ${fmt(sub)}\nDelivery: ${ship?fmt(ship):'Free'}\nTotal: ${fmt(sub+ship)}`;
  }
  if(cartList){
    store.set('rs_cart', cart()); renderCart();
    const u = store.get('rs_user', null);
    if(u){ $('#co-name').value = u.name; $('#co-email').value = u.email; if(u.phone) $('#co-phone').value = u.phone; }
    cartList.addEventListener('click', e=>{
      const c = cart();
      const q = e.target.closest('[data-cq]'); if(q){ const i=+q.dataset.cq; c[i].qty = Math.max(1, Math.min(10, c[i].qty + +q.dataset.d)); store.set('rs_cart', c); renderCart(); counts(); }
      const r = e.target.closest('[data-rm]'); if(r){ c.splice(+r.dataset.rm,1); store.set('rs_cart', c); renderCart(); counts(); }
    });
    $('#checkout').addEventListener('submit', e=>{
      const f = e.target;
      if(e.submitter && e.submitter.value==='whatsapp'){
        e.preventDefault();
        if(!f.reportValidity()) return;
        const msg = `New order – Rang-e-Saleha\n\n${$('#order-details').value}\n\nName: ${f.name.value}\nPhone: ${f.phone.value}\nCity: ${f.city.value}\nAddress: ${f.address.value}\nPayment: ${f.payment.value}\nNotes: ${f.notes.value||'-'}`;
        window.open(`https://wa.me/${WA}?text=` + encodeURIComponent(msg), '_blank', 'noopener');
      }
    });
  }

  /* ---------- wishlist ---------- */
  function renderWish(){
    const list = wish().map(byId).filter(Boolean);
    fill($('#wish-grid'), list); $('#wish-empty').hidden = list.length > 0; counts();
  }
  if($('#wish-grid')) renderWish();

  /* ---------- account (saved in this browser) ---------- */
  const auth = $('.auth');
  async function hash(s){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
  if(auth){
    const tabs = $$('.tab', auth);
    const show = name => { tabs.forEach(t=>t.setAttribute('aria-selected', t.dataset.tab===name)); $$('.auth-panel', auth).forEach(p=>p.hidden = p.id !== 'panel-'+name); };
    tabs.forEach(t=>t.addEventListener('click', ()=>show(t.dataset.tab)));
    if(location.hash==='#signup') show('signup');
    const renderUser = () => {
      const u = store.get('rs_user', null);
      $('#auth-forms').hidden = !!u; $('#profile').hidden = !u;
      if(u){ $('#p-name').textContent = u.name; $('#p-email').textContent = u.email; $('#p-phone').textContent = u.phone || '—'; }
    };
    $('#form-signup').addEventListener('submit', async e=>{
      e.preventDefault(); const f = e.target, msg = $('#signup-msg');
      if(f.password.value.length < 6){ msg.textContent = 'Password must be at least 6 characters.'; return; }
      if(f.password.value !== f.confirm.value){ msg.textContent = 'Passwords do not match.'; return; }
      const users = store.get('rs_users', {}); const email = f.email.value.trim().toLowerCase();
      if(users[email]){ msg.textContent = 'An account with this email already exists. Please sign in.'; return; }
      users[email] = { name: f.name.value.trim(), email, phone: f.phone.value.trim(), pw: await hash(f.password.value) };
      store.set('rs_users', users); store.set('rs_user', { name: users[email].name, email, phone: users[email].phone });
      toast('Welcome to Rang-e-Saleha'); renderUser();
    });
    $('#form-signin').addEventListener('submit', async e=>{
      e.preventDefault(); const f = e.target, msg = $('#signin-msg');
      const users = store.get('rs_users', {}); const u = users[f.email.value.trim().toLowerCase()];
      if(!u || u.pw !== await hash(f.password.value)){ msg.textContent = 'Email or password is incorrect.'; return; }
      store.set('rs_user', { name: u.name, email: u.email, phone: u.phone }); toast('Signed in'); renderUser();
    });
    $('#forgot').addEventListener('click', ()=>{ $('#signin-msg').textContent = `Message us on WhatsApp at ${S.phone} and we will help you reset it.`; });
    $('#signout').addEventListener('click', ()=>{ localStorage.removeItem('rs_user'); toast('Signed out'); renderUser(); });
    renderUser();
  }

  if(new URLSearchParams(location.search).get('sent')) toast('Thank you! We will be in touch soon.');
  counts();
})();
