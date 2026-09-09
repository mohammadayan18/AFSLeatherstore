/* ============================================================
   preview.js
   Logic for the dedicated "Customize" / live-preview page
   (preview.html). Kept on its own page (separate from user.html)
   so the customize flow never conflicts with the storefront.

   Load order in the HTML: config.js -> storage.js -> preview.js
   Reads the product to customize from the URL, e.g.
   preview.html?id=jacket — falls back to the first product in
   the store if no id is given or the id isn't found.
   ============================================================ */

let products = [];
let selected = null;
let selections = {};
let cart = getCart();

function getRequestedProductId(){
  return new URLSearchParams(window.location.search).get('id');
}

function selectedOptions(){
  if(!selected) return [];
  return selected.groups.map((g,i) => g.options[selections[i]||0]).filter(Boolean);
}

function chooseProduct(p){
  selected = p;
  selections = {};
  renderStudio();
}

function renderStudio(){
  const body = $('#previewBody');
  if(!selected){
    if(body) body.innerHTML = '<p class="admin-empty">Koi product nahi mila. Collection se wapas try karo.</p>';
    return;
  }
  if(!$('#selectedName')) return;
  $('#selectedName').textContent = selected.name;
  $('#optionGroups').innerHTML = selected.groups.map((g,gi) => `<div class="option-group"><strong>${String(gi+1).padStart(2,'0')} / ${g.name}</strong><div class="option-list">${g.options.map((o,oi) => `<button class="${(selections[gi]||0)===oi?'active':''}" data-group="${gi}" data-option="${oi}">${o.hex?`<span class="swatch" style="background:${o.hex}"></span>`:''}${o.name}${o.price?` +${money(o.price)}`:''}</button>`).join('')}</div></div>`).join('');
  $('#optionGroups').querySelectorAll('button').forEach(b => b.onclick = () => { selections[+b.dataset.group] = +b.dataset.option; renderStudio(); });

  const opts = selectedOptions();
  const price = selected.price + opts.reduce((a,o) => a + (+o.price||0), 0);
  const color = opts.find(o => o.hex)?.hex || 'transparent';
  const replacement = opts.find(o => o.image)?.image;

  $('#selectedPrice').textContent = money(price);
  $('#addPrice').textContent = money(price);
  $('#previewImage').src = replacement || selected.image;
  $('#previewImage').alt = selected.name + ' preview';

  const img = $('#previewImage');
  $('#previewTint').style.background = 'transparent';
  $('#previewTint').style.opacity = '0';

  if(color === 'transparent'){
    if(img) img.style.filter = 'none';
  } else {
    // Brown leather base = roughly hue 25deg, sepia(1) gives ~37deg
    // We need to rotate FROM that base TO target hue
    const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let targetHue = 0;
    if(d !== 0){
      if(max === r) targetHue = ((g-b)/d) % 6;
      else if(max === g) targetHue = (b-r)/d + 2;
      else targetHue = (r-g)/d + 4;
      targetHue = Math.round(targetHue * 60);
      if(targetHue < 0) targetHue += 360;
    }
    // sepia() produces hue ~37deg. Rotate from 37 to target.
    const rotate = targetHue - 37;
    // Saturation: grey/black = low, vivid = high
    const sat = d === 0 ? 0 : Math.round((d/max) * 180);
    // Brightness: dark colors need less brightness
    const lum = (r*0.299 + g*0.587 + b*0.114) / 255;
    const bri = Math.max(0.3, Math.min(1.1, lum*1.4));
    // Black/very dark: just desaturate + darken, no hue rotate needed
    if(lum < 0.12){
      if(img) img.style.filter = `grayscale(1) brightness(${(lum*3).toFixed(2)}) contrast(1.1)`;
    } else if(d/max < 0.15){
      // Near grey/neutral: sepia + slight rotate + low sat
      if(img) img.style.filter = `sepia(1) hue-rotate(${rotate}deg) saturate(0.4) brightness(${bri.toFixed(2)})`;
    } else {
      // Full color leather
      if(img) img.style.filter = `sepia(1) hue-rotate(${rotate}deg) saturate(${(sat/60).toFixed(2)}) brightness(${bri.toFixed(2)})`;
    }
  }
}

function saveCart(){
  saveCartData(cart);
}

function addCurrent(){
  if(!selected) return;
  const opts = selectedOptions();
  cart.push({
    name: selected.name,
    image: selected.image,
    price: selected.price + opts.reduce((a,o) => a + (+o.price||0), 0),
    options: opts.map(o => o.name)
  });
  saveCart();
}

function showToast(msg){
  const t = $('#toast');
  if(!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

document.addEventListener('DOMContentLoaded', () => {
  // Products load live from Firebase, same shared data as user.html / admin.html.
  watchProducts(list => {
    products = list;
    const requestedId = getRequestedProductId();
    const prevId = selected?.id;
    const next = products.find(p => p.id === requestedId) || products.find(p => p.id === prevId) || products[0] || null;
    if(!selected || selected.id !== next?.id){
      chooseProduct(next);
    } else {
      selected = next;
      renderStudio();
    }
  });

  $('#addToCart')?.addEventListener('click', () => {
    if(!selected) return;
    addCurrent();
    showToast(`<b>${selected.name}</b> added to your cart.`);
    setTimeout(() => { window.location.href = 'user.html?checkout=1'; }, 700);
  });

  function backToStore(){ window.location.href = 'user.html#collection'; }
  $('#closeCustomize')?.addEventListener('click', backToStore);
  $('#closeCustomizeX')?.addEventListener('click', backToStore);

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') backToStore();
  });
});
                                                                               
