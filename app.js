/* Rang-e-Saleha storefront */
(function(){
  const WA = '923299848040';
  const P = window.PRODUCTS || [];
  const byId = id => P.find(p => p.id === id);
  const fmt = n => 'PKR ' + Number(n).toLocaleString('en-PK');
  const ROOT = document.documentElement.dataset.root || '';
  const store = {
    get(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];

  function toast(msg){
    let t = $('.toast'); if(!t){ t = document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2400);
  }

  /* counts */
  const cart = () => store.get('rs_cart', []);
  const wish = () => store.get('rs_wish', []);
  function counts(){
    const c = cart().reduce((a,i)=>a+i.qty,0), w = wish().length;
    $$('[data-cart-count]').forEach(b=>{ b.textContent = c; b.dataset.n = c; });
    $$('[data-wish-count]').forEach(b=>{ b.textContent = w; b.dataset.n = w; });
    $$('[data-wish]').forEach(b=>{ const on = wish().includes(b.dataset.wish); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const u = store.get('rs_user', null);
    $$('[data-account-label]').forEach(el => el.textContent = u ? ('Hi, ' + u.name.split(' ')[0]) : 'Sign in');
  }
  function addToCart(id, size, qty){
    const c = cart(); const f = c.find(i => i.id===id && i.size===size);
    if(f) f.qty += qty; else c.push({id, size, qty});
    store.set('rs_cart', c); counts(); toast('Added to bag');
  }
  function toggleWish(id){
    let w = wish(); w = w.includes(id) ? w.filter(x=>x!==id) : [...w, id];
    store.set('rs_wish', w); counts(); toast(w.includes(id) ? 'Saved to wishlist' : 'Removed from wishlist');
  }
  document.addEventListener('click', e => {
    const w = e.target.closest('[data-wish]'); if(w){ e.preventDefault(); toggleWish(w.dataset.wish); }
    const q = e.target.closest('[data-quick-add]'); if(q){ e.preventDefault(); const p = byId(q.dataset.quickAdd); addToCart(p.id, p.sizes[0], 1); }
  });

  /* header */
  const mt = $('.menu-toggle'), nav = $('.nav');
  if(mt) mt.addEventListener('click', ()=>{ const o = nav.classList.toggle('open'); mt.setAttribute('aria-expanded', o); });
  const st = $('[data-search-toggle]'), sp = $('.search-panel');
  if(st) st.addEventListener('click', ()=>{ const o = sp.classList.toggle('open'); st.setAttribute('aria-expanded', o); if(o) $('input', sp).focus(); });

  /* promo bar */
  const track = $('.promo-track');
  if(track){ let i=0; const n = track.children.length; setInterval(()=>{ i=(i+1)%n; track.style.transform = `translateY(-${i*18}px)`; }, 3800); }

  /* hero slider */
  const slides = $$('.hero-slide'), dots = $$('.hero-dots button');
  if(slides.length > 1){
    let cur = 0;
    const go = n => { slides[cur].classList.remove('active'); dots[cur]?.classList.remove('active'); cur = n; slides[cur].classList.add('active'); dots[cur]?.classList.add('active'); };
    dots.forEach((d,i)=>d.addEventListener('click', ()=>go(i)));
    setInterval(()=>go((cur+1)%slides.length), 6000);
  }

  /* home tabs */
  $$('[data-tabs]').forEach(group => {
    const tabs = $$('.tab', group), grid = $('#' + group.dataset.tabs);
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.setAttribute('aria-selected', x===t));
      $$('.card', grid).forEach(c => { c.hidden = !(c.dataset.groups || '').split(' ').includes(t.dataset.tab); });
    }));
  });

  /* shop filters */
  const shop = $('#shop-grid');
  if(shop){
    const params = new URLSearchParams(location.search);
    const cat = params.get('cat'), q = (params.get('q')||'').toLowerCase().trim();
    if(cat){ const box = $(`input[name=cat][value="${cat}"]`); if(box) box.checked = true; }
    if(q){ $('#shop-title').textContent = 'Search: “' + params.get('q') + '”'; }
    const apply = () => {
      const cats = $$('input[name=cat]:checked').map(i=>i.value);
      const colors = $$('input[name=color]:checked').map(i=>i.value);
      const price = ($('input[name=price]:checked')||{}).value || 'all';
      const sort = $('#sort').value;
      const cards = $$('.card', shop);
      let shown = 0;
      cards.forEach(c => {
        const pr = +c.dataset.price;
        let ok = (!cats.length || cats.includes(c.dataset.cat)) && (!colors.length || colors.includes(c.dataset.color));
        if(price==='u25') ok = ok && pr < 25000; if(price==='25-100') ok = ok && pr>=25000 && pr<=100000; if(price==='o100') ok = ok && pr>100000;
        if(q) ok = ok && c.dataset.search.includes(q);
        c.hidden = !ok; if(ok) shown++;
      });
      const sorted = cards.slice().sort((a,b)=> sort==='low' ? a.dataset.price-b.dataset.price : sort==='high' ? b.dataset.price-a.dataset.price : a.dataset.order-b.dataset.order);
      sorted.forEach(c => shop.appendChild(c));
      $('#result-count').textContent = shown + (shown===1 ? ' design' : ' designs');
      $('#shop-empty').hidden = shown > 0;
    };
    $$('.filters input, #sort').forEach(i => i.addEventListener('change', apply));
    $('#clear-filters')?.addEventListener('click', ()=>{ $$('.filters input').forEach(i=>{ i.checked = i.value==='all'; }); apply(); });
    apply();
  }

  /* product page */
  const pdp = $('[data-pdp]');
  if(pdp){
    const p = byId(pdp.dataset.pdp); let size = null;
    $$('.thumbs button').forEach(b => b.addEventListener('click', () => { $('.gallery-main img').src = b.dataset.full; $$('.thumbs button').forEach(x=>x.classList.toggle('active', x===b)); }));
    $$('.sizes button').forEach(b => b.addEventListener('click', () => { size = b.dataset.size; $$('.sizes button').forEach(x=>x.setAttribute('aria-pressed', x===b)); $('#size-msg').textContent=''; }));
    const qi = $('#qty');
    $('[data-qty="-"]').addEventListener('click', ()=>{ qi.value = Math.max(1, +qi.value-1); });
    $('[data-qty="+"]').addEventListener('click', ()=>{ qi.value = Math.min(10, +qi.value+1); });
    $('#add-bag').addEventListener('click', ()=>{
      if(!size){ $('#size-msg').textContent = 'Please choose a size.'; return; }
      addToCart(p.id, size, Math.max(1, +qi.value||1));
    });
    $('#wa-order').addEventListener('click', e=>{
      const s = size || 'to be confirmed';
      e.currentTarget.href = `https://wa.me/${WA}?text=` + encodeURIComponent(`Assalam o Alaikum! I would like to order:\n${p.name} (${p.sku})\nSize: ${s}\nQty: ${qi.value}\nPrice: ${fmt(p.price)}\n${location.href}`);
    });
  }

  /* cart page */
  const cartList = $('#cart-list');
  function renderCart(){
    const c = cart().filter(i => byId(i.id));
    if(!c.length){ cartList.innerHTML = `<div class="empty"><p>Your bag is empty.</p><a class="btn" href="${ROOT}shop.html">Continue shopping</a></div>`; $('#cart-summary').hidden = true; return; }
    $('#cart-summary').hidden = false;
    cartList.innerHTML = c.map((i,idx)=>{ const p = byId(i.id); return `
      <div class="cart-item">
        <a href="${ROOT}product-${p.slug}.html"><img src="${p.img}&w=240" alt="${p.name}"></a>
        <div><h3><a href="${ROOT}product-${p.slug}.html">${p.name}</a></h3><small>${p.cat} · Size ${i.size}</small>
          <div style="display:flex;align-items:center;gap:16px;margin-top:10px">
            <div class="qty"><button type="button" aria-label="Decrease" data-cq="${idx}" data-d="-1">−</button><input aria-label="Quantity" value="${i.qty}" readonly><button type="button" aria-label="Increase" data-cq="${idx}" data-d="1">+</button></div>
            <button class="link-btn" type="button" data-rm="${idx}">Remove</button>
          </div></div>
        <div class="price">${fmt(p.price*i.qty)}</div>
      </div>`; }).join('');
    const sub = c.reduce((a,i)=>a+byId(i.id).price*i.qty,0);
    const ship = sub >= 15000 ? 0 : 350;
    $('#sub').textContent = fmt(sub); $('#ship').textContent = ship ? fmt(ship) : 'Free'; $('#total').textContent = fmt(sub+ship);
    $('#order-details').value = c.map(i=>{ const p=byId(i.id); return `${p.name} (${p.sku}) – Size ${i.size} x${i.qty} = ${fmt(p.price*i.qty)}`; }).join('\n') + `\nSubtotal: ${fmt(sub)}\nDelivery: ${ship?fmt(ship):'Free'}\nTotal: ${fmt(sub+ship)}`;
  }
  if(cartList){
    renderCart();
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

  /* wishlist page */
  const wl = $('#wish-grid');
  if(wl){
    const ids = wish().filter(byId);
    $$('.card', wl).forEach(c => { c.hidden = !ids.includes(c.dataset.id); });
    $('#wish-empty').hidden = ids.length > 0;
    document.addEventListener('click', e=>{ if(e.target.closest('[data-wish]')) setTimeout(()=>{ const n = wish(); $$('.card', wl).forEach(c=>{ c.hidden = !n.includes(c.dataset.id); }); $('#wish-empty').hidden = n.length>0; }, 0); });
  }

  /* account: sign in / sign up (saved in this browser) */
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
      counts();
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
    $('#forgot').addEventListener('click', ()=>{ $('#signin-msg').textContent = 'Message us on WhatsApp at 0329 9848040 and we will help you reset it.'; });
    $('#signout').addEventListener('click', ()=>{ localStorage.removeItem('rs_user'); toast('Signed out'); renderUser(); });
    renderUser();
  }

  /* forms sent to email via FormSubmit: show thank-you on return */
  if(new URLSearchParams(location.search).get('sent')){ toast('Thank you! We will be in touch soon.'); }

  counts();
})();
