/* Rang-e-Saleha store admin — saves to the website's GitHub repository */
(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => 'PKR ' + Math.round(Number(n)||0).toLocaleString('en-PK');
  const final = p => p.discount > 0 ? Math.round(p.price * (100 - p.discount) / 100) : p.price;
  const SIZE_SET = ['XS','S','M','L','XL','XXL','Custom','3-Piece','2-Piece','One size'];
  const SIZE_EXTRA = { 'Footwear':['36','37','38','39','40','41'], 'Bras':['32B','34B','36B','38B','34C','36C','38C'] };
  const DEPT = {'Ready to Wear':'Women','Luxury Prêt':'Women','Formal':'Women','Unstitched':'Women','Bottoms':'Women','Bridal':'Bridal','Bags & Clutches':'Accessories','Jewellery':'Accessories','Footwear':'Accessories','Shawls & Wraps':'Accessories','Camisoles & Slips':'Innerwear','Bras':'Innerwear','Nightwear':'Innerwear'};
  const STATIC_PAGES = ['', 'shop.html','wedding-edit.html','journal.html','about.html','contact.html','help.html','privacy.html','journal-choosing-your-bridal-lehenga.html','journal-mehndi-outfit-ideas.html','journal-lawn-care-guide.html'];

  let cfg = null, products = [], settings = {}, sha = {}, dirty = { products:false, settings:false }, editing = null, draft = null, pendingUploads = 0;
  const local = new Map(); // repo path -> object URL preview (until GitHub Pages rebuilds)

  function toast(m, ms=3200){ let t = $('.toast'); if(!t){ t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role','status'); document.body.appendChild(t); } t.textContent = m; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(()=>t.hidden = true, ms); }
  const imgSrc = (u, w=300) => !u ? '' : local.get(u) || (u.includes('images.unsplash.com') ? u + '&w=' + w : u);

  /* ---------- GitHub API ---------- */
  async function gh(path, opts={}){
    const r = await fetch('https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + path, { ...opts, headers: { 'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? {'Content-Type':'application/json'} : {}) } });
    if(!r.ok){ const e = new Error((await r.json().catch(()=>({}))).message || ('GitHub error ' + r.status)); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  }
  const b64FromBytes = bytes => { let s = ''; for(let i=0; i<bytes.length; i+=0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000)); return btoa(s); };
  const b64FromText = t => b64FromBytes(new TextEncoder().encode(t));
  const textFromB64 = b => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g,'')), c => c.charCodeAt(0)));
  async function getJSON(path){
    try { const f = await gh('/contents/' + path + '?ref=main&t=' + Date.now()); sha[path] = f.sha; return JSON.parse(textFromB64(f.content)); }
    catch(e){ if(e.status === 404) return null; throw e; }
  }
  async function put(path, b64, message){
    const body = { message, content: b64, branch: 'main' }; if(sha[path]) body.sha = sha[path];
    try { const r = await gh('/contents/' + path, { method:'PUT', body: JSON.stringify(body) }); sha[path] = r.content.sha; return r; }
    catch(e){
      if(e.status === 409 || e.status === 422){ // file changed elsewhere: refresh sha and retry once
        try { const f = await gh('/contents/' + path + '?ref=main&t=' + Date.now()); sha[path] = f.sha; body.sha = f.sha; } catch(_){ delete body.sha; }
        const r = await gh('/contents/' + path, { method:'PUT', body: JSON.stringify(body) }); sha[path] = r.content.sha; return r;
      }
      throw e;
    }
  }

  /* ---------- login ---------- */
  function loadCfg(){ try { return JSON.parse(localStorage.getItem('rs_admin') || sessionStorage.getItem('rs_admin')); } catch(e){ return null; } }
  async function start(c){
    cfg = c;
    try {
      const repo = await gh('');
      if(!repo.permissions || !repo.permissions.push) throw new Error('This key can view but not edit the website. Give it "Contents: Read and write".');
      const [p, s] = await Promise.all([getJSON('products.json'), getJSON('settings.json')]);
      products = (p || []).map((x,i) => ({ order:i, ...x })).sort((a,b) => a.order - b.order);
      settings = s || {};
      $('#login-view').hidden = true; $('#app-view').hidden = false; $('#top-actions').hidden = false;
      renderAll(); return true;
    } catch(e){
      cfg = null;
      $('#login-msg').textContent = e.status === 401 ? 'That access key is not valid or has expired.' : e.status === 404 ? 'Website repository not found, or the key has no access to it.' : e.message;
      return false;
    }
  }
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault(); $('#login-msg').textContent = 'Checking…';
    const c = { token: $('#tok').value.trim(), owner: $('#owner').value.trim(), repo: $('#repo').value.trim() };
    if(await start(c)){ ($('#remember').checked ? localStorage : sessionStorage).setItem('rs_admin', JSON.stringify(c)); $('#tok').value = ''; $('#login-msg').textContent = ''; }
  });
  $('#logout').addEventListener('click', () => {
    if((dirty.products || dirty.settings) && !window.confirm('You have changes that are not published. Log out anyway?')) return;
    localStorage.removeItem('rs_admin'); sessionStorage.removeItem('rs_admin'); location.reload();
  });
  window.addEventListener('beforeunload', e => { if(dirty.products || dirty.settings || pendingUploads){ e.preventDefault(); e.returnValue = ''; } });

  /* ---------- tabs ---------- */
  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.setAttribute('aria-selected', x===b));
    ['products','offers','settings'].forEach(v => $('#v-' + v).hidden = v !== b.dataset.view);
  }));

  function markDirty(k){ dirty[k] = true; updateStatus(); }
  function updateStatus(){
    const d = dirty.products || dirty.settings;
    $('#dot').classList.toggle('dirty', d);
    $('#status-text').textContent = pendingUploads ? 'Uploading photos…' : d ? 'Unpublished changes' : 'All changes published';
    $('#publish').disabled = !d || pendingUploads > 0;
  }

  /* ---------- products list ---------- */
  const cats = () => [...new Set(products.map(p => p.category).filter(Boolean))];
  function renderAll(){ renderRows(); renderSettings(); updateStatus(); }
  function renderRows(){
    const q = $('#search').value.toLowerCase().trim(), fc = $('#fcat').value;
    const cs = cats();
    $('#fcat').innerHTML = '<option value="">All categories</option>' + cs.map(c => `<option ${c===fc?'selected':''}>${esc(c)}</option>`).join('');
    $('#bulk-cat').innerHTML = '<option value="">All products</option>' + cs.map(c => `<option>${esc(c)}</option>`).join('');
    $('#cat-list').innerHTML = [...new Set([...cs,...Object.keys(DEPT)])].map(c => `<option value="${esc(c)}">`).join('');
    $('#color-list').innerHTML = [...new Set([...products.map(p=>p.color).filter(Boolean),'Red','Maroon','Pink','Ivory','White','Black','Blue','Green','Emerald','Purple','Yellow','Gold','Grey','Peach'])].map(c => `<option value="${esc(c)}">`).join('');
    $('#st-total').textContent = products.length;
    $('#st-live').textContent = products.filter(p => !p.hidden).length;
    $('#st-sale').textContent = products.filter(p => p.discount > 0).length;
    $('#st-out').textContent = products.filter(p => p.status === 'sold_out').length;
    const list = products.filter(p => (!fc || p.category === fc) && (!q || `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q)));
    $('#rows').innerHTML = list.length ? list.map(p => {
      const i = products.indexOf(p);
      const st = p.hidden ? '<span class="pill hid">Hidden</span>' : p.status === 'sold_out' ? '<span class="pill out">Sold out</span>' : p.status === 'made_to_order' ? '<span class="pill mto">Made to order</span>' : '<span class="pill in">In stock</span>';
      return `<tr>
<td><img src="${imgSrc(p.images?.[0], 120)}" alt=""></td>
<td><div class="name">${esc(p.name)}</div><div class="hint">${esc(p.sku||'')}${p.badge ? ' · ' + esc(p.badge) : ''}${p.bestSeller ? ' · Best seller' : ''}${p.newArrival ? ' · New' : ''}</div></td>
<td>${esc(p.category)}<div class="hint">${esc(p.department || DEPT[p.category] || '')}</div></td>
<td class="price">${fmt(final(p))}${p.discount > 0 ? `<s>${fmt(p.price)}</s><div class="hint">-${p.discount}%</div>` : ''}</td>
<td>${st}</td>
<td><div class="row-actions">
<button class="btn line small" type="button" data-move="${i}" data-d="-1" aria-label="Move ${esc(p.name)} up" ${i===0?'disabled':''}>↑</button>
<button class="btn line small" type="button" data-move="${i}" data-d="1" aria-label="Move ${esc(p.name)} down" ${i===products.length-1?'disabled':''}>↓</button>
<button class="btn small" type="button" data-edit="${i}">Edit</button>
</div></td></tr>`; }).join('') : `<tr><td colspan="6" class="muted" style="text-align:center;padding:30px">No products found.</td></tr>`;
  }
  $('#search').addEventListener('input', renderRows);
  $('#fcat').addEventListener('change', renderRows);
  $('#rows').addEventListener('click', e => {
    const m = e.target.closest('[data-move]');
    if(m){ const i = +m.dataset.move, j = i + +m.dataset.d; [products[i], products[j]] = [products[j], products[i]]; products.forEach((p,k) => p.order = k); markDirty('products'); renderRows(); }
    const ed = e.target.closest('[data-edit]'); if(ed) openEditor(+ed.dataset.edit);
  });
  $('#add').addEventListener('click', () => openEditor(-1));

  /* ---------- editor ---------- */
  const slug = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'product';
  function openEditor(i){
    editing = i;
    const p = i >= 0 ? products[i] : { name:'', category:'', price:'', discount:0, sizes:['XS','S','M','L','XL'], images:[], colors:[], status:'in_stock', badge:'New', newArrival:true, bestSeller:false, hidden:false };
    draft = JSON.parse(JSON.stringify(p));
    $('#ed-title').textContent = i >= 0 ? 'Edit product' : 'Add product';
    $('#ed-delete').hidden = i < 0; $('#ed-delete').dataset.armed = '';  $('#ed-delete').textContent = 'Delete product';
    $('#ed-name').value = p.name || ''; $('#ed-cat').value = p.category || ''; $('#ed-dept').value = p.department || DEPT[p.category] || 'Women'; $('#ed-sku').value = p.sku || '';
    $('#ed-price').value = p.price || ''; $('#ed-disc').value = p.discount || 0;
    $('#ed-color').value = p.color || ''; $('#ed-fabric').value = p.fabric || ''; $('#ed-colors').value = (p.colors||[]).join(', ');
    $('#ed-status').value = p.status || 'in_stock'; $('#ed-lead').value = p.leadTime || ''; $('#ed-badge').value = p.badge || '';
    $('#ed-best').checked = !!p.bestSeller; $('#ed-new').checked = !!p.newArrival; $('#ed-hidden').checked = !!p.hidden;
    $('#ed-desc').value = p.description || ''; $('#ed-details').value = p.details || '';
    $('#ed-msg').textContent = '';
    renderSizes(); renderImgs(); updFinal();
    $('#drawer').hidden = false; $('#drawer-bg').hidden = false; $('#ed-name').focus();
  }
  function closeEditor(){ $('#drawer').hidden = true; $('#drawer-bg').hidden = true; editing = null; draft = null; }
  $('#ed-close').addEventListener('click', closeEditor); $('#ed-cancel').addEventListener('click', closeEditor); $('#drawer-bg').addEventListener('click', closeEditor);
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#drawer').hidden) closeEditor(); });
  function updFinal(){ const pr = +$('#ed-price').value || 0, d = Math.min(90, Math.max(0, +$('#ed-disc').value || 0)); $('#ed-final').innerHTML = fmt(d ? pr*(100-d)/100 : pr) + (d ? ` <s class="hint">${fmt(pr)}</s>` : ''); }
  $('#ed-price').addEventListener('input', updFinal); $('#ed-disc').addEventListener('input', updFinal);
  function renderSizes(){
    const all = [...new Set([...SIZE_SET, ...(SIZE_EXTRA[$('#ed-cat').value.trim()]||[]), ...(draft.sizes||[])])];
    $('#ed-sizes').innerHTML = all.map(s => `<label><input type="checkbox" value="${esc(s)}" ${(draft.sizes||[]).includes(s)?'checked':''}> ${esc(s)}</label>`).join('');
  }
  $('#ed-cat').addEventListener('change', () => { const c = $('#ed-cat').value.trim(); if(DEPT[c]) $('#ed-dept').value = DEPT[c]; if(draft) renderSizes(); });
  $('#ed-sizes').addEventListener('change', () => { draft.sizes = $$('#ed-sizes input:checked').map(i => i.value); });
  $('#ed-size-add').addEventListener('click', () => { const v = $('#ed-size-new').value.trim(); if(!v) return; draft.sizes = [...new Set([...(draft.sizes||[]), v])]; $('#ed-size-new').value = ''; renderSizes(); });

  function renderImgs(){
    const imgs = draft.images || [];
    $('#ed-imgs').innerHTML = imgs.map((u,i) => `<div class="imgbox">${i===0?'<span class="main">Main</span>':''}<img src="${imgSrc(u)}" alt="Photo ${i+1}"><div class="ctl">
<button type="button" data-img-move="${i}" data-d="-1" aria-label="Move photo left" ${i===0?'disabled':''}>←</button>
<button type="button" data-img-del="${i}" aria-label="Remove photo">✕</button>
<button type="button" data-img-move="${i}" data-d="1" aria-label="Move photo right" ${i===imgs.length-1?'disabled':''}>→</button></div></div>`).join('')
      + `<button type="button" class="upload" data-upload="product"><b style="font-size:28px">+</b>Upload photos</button>`;
  }
  $('#ed-imgs').addEventListener('click', e => {
    const mv = e.target.closest('[data-img-move]'); if(mv){ const i = +mv.dataset.imgMove, j = i + +mv.dataset.d; const a = draft.images; [a[i], a[j]] = [a[j], a[i]]; renderImgs(); }
    const dl = e.target.closest('[data-img-del]'); if(dl){ draft.images.splice(+dl.dataset.imgDel, 1); renderImgs(); }
  });
  $('#ed-addurl').addEventListener('click', () => { const u = $('#ed-imgurl').value.trim(); if(!/^https?:\/\//.test(u)){ toast('Paste a link that starts with https://'); return; } draft.images.push(u); $('#ed-imgurl').value = ''; renderImgs(); });

  /* ---------- photo upload ---------- */
  let uploadTarget = null;
  document.addEventListener('click', e => { const u = e.target.closest('[data-upload]'); if(u){ uploadTarget = u.dataset.upload; $('#file').click(); } });
  async function resize(file, max){
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width*s); c.height = Math.round(bmp.height*s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  }
  $('#file').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = ''; if(!files.length) return;
    const target = uploadTarget, isHero = target === 'hero';
    const base = isHero ? 'banner' : slug($('#ed-name').value || 'product');
    for(const f of files){
      if(!f.type.startsWith('image/')) continue;
      const path = `images/${base}-${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}.jpg`;
      pendingUploads++; updateStatus(); toast('Uploading ' + f.name + '…', 60000);
      try {
        const blob = await resize(f, isHero ? 2200 : 1600);
        local.set(path, URL.createObjectURL(blob));
        if(isHero){ settings.hero = settings.hero || {}; settings.hero.images = [...(settings.hero.images||[]), path]; renderHero(); markDirty('settings'); }
        else if(draft){ draft.images.push(path); renderImgs(); }
        await put(path, b64FromBytes(new Uint8Array(await blob.arrayBuffer())), 'Upload photo ' + path);
        toast('Photo uploaded');
      } catch(err){
        toast('Photo upload failed: ' + err.message, 6000);
        if(isHero){ settings.hero.images = settings.hero.images.filter(x => x !== path); renderHero(); } else if(draft){ draft.images = draft.images.filter(x => x !== path); renderImgs(); }
      } finally { pendingUploads--; updateStatus(); }
    }
  });

  /* ---------- save / delete product ---------- */
  $('#ed-save').addEventListener('click', () => {
    const name = $('#ed-name').value.trim(), cat = $('#ed-cat').value.trim(), price = Math.round(+$('#ed-price').value);
    const msg = $('#ed-msg');
    if(!name){ msg.textContent = 'Please enter a product name.'; $('#ed-name').focus(); return; }
    if(!cat){ msg.textContent = 'Please choose a category.'; $('#ed-cat').focus(); return; }
    if(!(price > 0)){ msg.textContent = 'Please enter the price in PKR.'; $('#ed-price').focus(); return; }
    if(!draft.images.length){ msg.textContent = 'Please add at least one photo.'; return; }
    if(!draft.sizes || !draft.sizes.length){ msg.textContent = 'Please tick at least one size.'; return; }
    let id = draft.id;
    if(!id){ id = slug(name); let n = 2; while(products.some(p => p.id === id)) id = slug(name) + '-' + n++; }
    const sku = $('#ed-sku').value.trim() || ('RS-' + cat.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase() + '-' + (101 + products.length + Math.floor(Math.random()*900)));
    const p = { ...draft, id, name, category: cat, department: $('#ed-dept').value, sku, price, discount: Math.min(90, Math.max(0, Math.round(+$('#ed-disc').value || 0))),
      color: $('#ed-color').value.trim(), fabric: $('#ed-fabric').value.trim(), colors: $('#ed-colors').value.split(',').map(s=>s.trim()).filter(Boolean),
      status: $('#ed-status').value, leadTime: $('#ed-lead').value.trim(), badge: $('#ed-badge').value,
      bestSeller: $('#ed-best').checked, newArrival: $('#ed-new').checked, hidden: $('#ed-hidden').checked,
      description: $('#ed-desc').value.trim(), details: $('#ed-details').value.trim() };
    if(editing >= 0) products[editing] = p; else { products.unshift(p); products.forEach((x,k) => x.order = k); }
    markDirty('products'); closeEditor(); renderRows(); toast('Saved. Click “Publish changes” to put it on the website.');
  });
  $('#ed-delete').addEventListener('click', e => {
    const b = e.currentTarget;
    if(!b.dataset.armed){ b.dataset.armed = '1'; b.textContent = 'Click again to delete'; return; }
    products.splice(editing, 1); products.forEach((x,k) => x.order = k); markDirty('products'); closeEditor(); renderRows(); toast('Product deleted. Publish to update the website.');
  });

  /* ---------- offers ---------- */
  $('#bulk-apply').addEventListener('click', () => {
    const c = $('#bulk-cat').value, d = Math.min(90, Math.max(0, Math.round(+$('#bulk-pct').value || 0)));
    let n = 0; products.forEach(p => { if(!c || p.category === c){ p.discount = d; n++; } });
    markDirty('products'); renderRows(); toast(`${d}% discount set on ${n} product${n===1?'':'s'}. Publish to update the website.`);
  });
  $('#bulk-clear').addEventListener('click', () => { products.forEach(p => p.discount = 0); markDirty('products'); renderRows(); toast('All discounts removed. Publish to update the website.'); });

  /* ---------- settings ---------- */
  const S_FIELDS = { 's-p1':['promo',0], 's-p2':['promo',1], 's-p3':['promo',2], 's-eyebrow':['hero','eyebrow'], 's-title':['hero','title'], 's-sub':['hero','subtitle'],
    's-free':['freeDeliveryAbove'], 's-fee':['deliveryFee'], 's-phone':['phone'], 's-wa':['whatsapp'], 's-email':['email'], 's-hours':['hours'], 's-address':['address'], 's-sale-text':['sale','text'] };
  function renderSettings(){
    for(const [id, [a,b]] of Object.entries(S_FIELDS)){ const v = b === undefined ? settings[a] : (settings[a]||{})[b]; $('#'+id).value = v ?? ''; }
    $('#s-sale-on').checked = !!(settings.sale && settings.sale.enabled);
    renderHero();
  }
  function renderHero(){
    const imgs = (settings.hero && settings.hero.images) || [];
    $('#hero-imgs').innerHTML = imgs.map((u,i) => `<div class="imgbox"><img src="${imgSrc(u,400)}" alt="Banner photo ${i+1}" style="aspect-ratio:16/10"><div class="ctl"><button type="button" data-hero-move="${i}" data-d="-1" aria-label="Move left" ${i===0?'disabled':''}>←</button><button type="button" data-hero-del="${i}" aria-label="Remove photo">✕</button><button type="button" data-hero-move="${i}" data-d="1" aria-label="Move right" ${i===imgs.length-1?'disabled':''}>→</button></div></div>`).join('')
      + `<button type="button" class="upload" data-upload="hero" style="aspect-ratio:16/10"><b style="font-size:28px">+</b>Upload banner photo</button>`;
  }
  $('#hero-imgs').addEventListener('click', e => {
    const a = settings.hero.images;
    const mv = e.target.closest('[data-hero-move]'); if(mv){ const i = +mv.dataset.heroMove, j = i + +mv.dataset.d; [a[i], a[j]] = [a[j], a[i]]; renderHero(); markDirty('settings'); }
    const dl = e.target.closest('[data-hero-del]'); if(dl){ a.splice(+dl.dataset.heroDel, 1); renderHero(); markDirty('settings'); }
  });
  document.addEventListener('input', e => {
    const f = S_FIELDS[e.target.id]; if(!f) return;
    const [a,b] = f; let v = e.target.value; if(e.target.type === 'number') v = Math.max(0, Math.round(+v || 0));
    if(e.target.id === 's-wa') v = v.replace(/\D/g,'');
    if(b === undefined) settings[a] = v; else { if(a === 'promo'){ settings.promo = settings.promo || []; } else settings[a] = settings[a] || {}; settings[a][b] = v; }
    markDirty('settings');
  });
  $('#s-sale-on').addEventListener('change', e => { settings.sale = settings.sale || {}; settings.sale.enabled = e.target.checked; markDirty('settings'); });

  /* ---------- publish ---------- */
  function sitemap(){
    const base = `https://${cfg.repo.endsWith('.github.io') ? cfg.repo : cfg.owner + '.github.io/' + cfg.repo}/`.replace(/\/+$/,'/');
    const today = new Date().toISOString().slice(0,10);
    const urls = [...STATIC_PAGES, ...products.filter(p => !p.hidden).map(p => 'product.html?id=' + encodeURIComponent(p.id))];
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(u => `<url><loc>${base}${u.replace(/&/g,'&amp;')}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n';
  }
  $('#publish').addEventListener('click', async () => {
    const b = $('#publish'); b.disabled = true; b.textContent = 'Publishing…';
    try {
      if(dirty.products){
        const data = products.map((p,k) => ({ ...p, order:k }));
        await put('products.json', b64FromText(JSON.stringify(data, null, 1)), 'Update products');
        try { const f = await gh('/contents/sitemap.xml?ref=main'); sha['sitemap.xml'] = f.sha; } catch(_){}
        await put('sitemap.xml', b64FromText(sitemap()), 'Update sitemap');
        dirty.products = false;
      }
      if(dirty.settings){ await put('settings.json', b64FromText(JSON.stringify(settings, null, 1)), 'Update website settings'); dirty.settings = false; }
      toast('Published! The website updates in about 1 minute.', 6000);
    } catch(e){ toast('Could not publish: ' + e.message, 8000); }
    b.textContent = 'Publish changes'; updateStatus();
  });

  /* ---------- auto login ---------- */
  const saved = loadCfg();
  if(saved && saved.token){ $('#login-msg').textContent = 'Logging in…'; start(saved).then(ok => { if(!ok){ localStorage.removeItem('rs_admin'); sessionStorage.removeItem('rs_admin'); } }); }
})();
