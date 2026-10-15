const PRODUCT_KEY = "happy-store-products-v1";
const SETTINGS_KEY = "happy-store-settings-v1";
const PAGE_SIZE = 9;
const AUTHORIZED_EMAIL = "happystorecbba@gmail.com";

const DEFAULT_SETTINGS = {
  id: 1,
  whatsapp: "59174806956",
  instagram: "",
  tiktok: "happystorecbba1",
  email: "Happystorecbba@gmail.com",
  ownerEmail: "Viciousfer1996@gmail.com",
  storePhone: "64000633",
  ownerName: "Franklin Fernando Condori Gregorio",
  address: "Calle Punata entre San Martín y Lanza, Shopping Garoni, 2do piso, oficina 10-C",
  note: "Precios referenciales sujetos a variación. Consulta el precio y stock actual antes de comprar."
};

const config = window.HAPPY_STORE_CONFIG || {};
const cloudEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
const db = cloudEnabled ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const state = {
  products: readJSON(PRODUCT_KEY, []),
  settings: { ...DEFAULT_SETTINGS, ...readJSON(SETTINGS_KEY, {}) },
  session: null,
  query: "",
  category: "",
  brand: "",
  offersOnly: false,
  sort: "featured",
  page: 1,
  editingId: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveLocal() {
  localStorage.setItem(PRODUCT_KEY, JSON.stringify(state.products));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function money(value) {
  return new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function isOffer(product) {
  return Number(product.comparePrice) > Number(product.price) && Number(product.price) >= 0;
}

function discount(product) {
  if (!isOffer(product)) return 0;
  return Math.round((1 - Number(product.price) / Number(product.comparePrice)) * 100);
}

function stockInfo(product) {
  const stock = Math.max(0, Number(product.stock || 0));
  if (stock === 0) return { label: "Agotado", detail: "0 unidades", className: "stock-out" };
  if (stock <= 3) return { label: "Stock bajo", detail: `${stock} ${stock === 1 ? "unidad" : "unidades"}`, className: "stock-low" };
  return { label: "Disponible", detail: `${stock} unidades`, className: "stock-ok" };
}

function fromDbProduct(row) {
  return {
    id: row.id,
    name: row.name || "",
    brand: row.brand || "",
    category: row.category || "",
    price: Number(row.price || 0),
    comparePrice: Number(row.compare_price || 0),
    stock: Number(row.stock || 0),
    image: row.image_url || "",
    description: row.description || "",
    featured: Boolean(row.featured),
    createdAt: row.created_at || new Date().toISOString()
  };
}

function toDbProduct(product) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: Number(product.price),
    compare_price: Number(product.comparePrice || 0) || null,
    stock: Math.max(0, Number(product.stock || 0)),
    image_url: product.image || null,
    description: product.description || null,
    featured: Boolean(product.featured)
  };
}

function fromDbSettings(row = {}) {
  return {
    ...DEFAULT_SETTINGS,
    id: row.id || 1,
    whatsapp: row.whatsapp || DEFAULT_SETTINGS.whatsapp,
    instagram: row.instagram || "",
    tiktok: row.tiktok || DEFAULT_SETTINGS.tiktok,
    email: row.email || DEFAULT_SETTINGS.email,
    ownerEmail: row.owner_email || DEFAULT_SETTINGS.ownerEmail,
    storePhone: row.store_phone || DEFAULT_SETTINGS.storePhone,
    ownerName: row.owner_name || DEFAULT_SETTINGS.ownerName,
    address: row.address || DEFAULT_SETTINGS.address,
    note: row.catalog_note || DEFAULT_SETTINGS.note
  };
}

function toDbSettings(settings) {
  return {
    id: 1,
    whatsapp: settings.whatsapp,
    instagram: settings.instagram || null,
    tiktok: settings.tiktok,
    email: settings.email,
    owner_email: settings.ownerEmail,
    store_phone: settings.storePhone,
    owner_name: settings.ownerName,
    address: settings.address,
    catalog_note: settings.note,
    updated_at: new Date().toISOString()
  };
}

async function loadCloudData() {
  if (!db) {
    setConnectionStatus("Configuración de Supabase pendiente. Los cambios se guardan temporalmente en este navegador.", true);
    return;
  }
  setConnectionStatus("Sincronizando inventario con Supabase…");
  const [{ data: products, error: productError }, { data: settings, error: settingsError }] = await Promise.all([
    db.from("products").select("*").order("created_at", { ascending: false }),
    db.from("store_settings").select("*").eq("id", 1).maybeSingle()
  ]);
  if (productError || settingsError) {
    console.error(productError || settingsError);
    setConnectionStatus("No se pudo conectar con Supabase. Verifica la configuración del proyecto.", true);
    return;
  }
  state.products = (products || []).map(fromDbProduct);
  if (settings) state.settings = fromDbSettings(settings);
  saveLocal();
  setConnectionStatus("Inventario conectado y sincronizado con Supabase.");
}

function setConnectionStatus(message, isError = false) {
  const notice = $("#admin-connection");
  if (!notice) return;
  notice.classList.toggle("error", isError);
  $("#connection-status").textContent = message;
}

function route() {
  const name = location.hash.replace("#", "").split("?")[0] || "inicio";
  const valid = ["inicio", "catalogo", "contacto", "admin"].includes(name) ? name : "inicio";
  $$('[data-page]').forEach(page => page.classList.toggle("active", page.dataset.page === valid));
  $$('[data-route]').forEach(link => link.classList.toggle("active", link.dataset.route === valid));
  $(".primary-nav").classList.remove("open");
  $(".menu-toggle").setAttribute("aria-expanded", "false");
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  if (valid === "catalogo") renderCatalog();
  if (valid === "admin") renderAdmin();
}

function productMedia(product, compact = false) {
  if (product.image) return `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}" loading="lazy">`;
  return `<div class="${compact ? "mini-phone" : "phone-placeholder"}" aria-hidden="true"></div>`;
}

function productCard(product) {
  const stock = stockInfo(product);
  return `<article class="product-card">
    <div class="product-media">
      ${productMedia(product)}
      ${isOffer(product) ? `<span class="discount-badge">-${discount(product)}%</span>` : ""}
      <span class="stock-badge ${stock.className}">${stock.detail}</span>
    </div>
    <div class="product-body">
      <span class="product-meta">${escapeHTML(product.brand)} · ${escapeHTML(product.category)}</span>
      <h3>${escapeHTML(product.name)}</h3>
      <div class="price-row"><span class="current-price">Bs ${money(product.price)}</span>${isOffer(product) ? `<span class="old-price">Bs ${money(product.comparePrice)}</span>` : ""}</div>
      <div class="product-actions">
        <button class="detail-button" type="button" data-detail="${product.id}">Detalles</button>
        <button class="contact-button" type="button" data-contact="${product.id}">${Number(product.stock) > 0 ? "Consultar" : "Preguntar"}</button>
      </div>
    </div>
  </article>`;
}

function renderOffers() {
  const offers = state.products.filter(isOffer).sort((a, b) => Number(b.featured) - Number(a.featured) || discount(b) - discount(a)).slice(0, 6);
  $("#offers-grid").innerHTML = offers.map(productCard).join("");
  $("#offers-grid").hidden = offers.length === 0;
  $("#offers-empty").hidden = offers.length > 0;
}

function uniqueValues(field) {
  return [...new Set(state.products.map(product => product[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

function updateFilterOptions() {
  const category = $("#category-filter");
  const brand = $("#brand-filter");
  category.innerHTML = `<option value="">Todas</option>${uniqueValues("category").map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
  brand.innerHTML = `<option value="">Todas</option>${uniqueValues("brand").map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
  category.value = state.category;
  brand.value = state.brand;
}

function filteredProducts() {
  const query = state.query.trim().toLowerCase();
  const items = state.products.filter(product => {
    const haystack = `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!state.category || product.category === state.category) && (!state.brand || product.brand === state.brand) && (!state.offersOnly || isOffer(product));
  });
  return items.sort((a, b) => {
    if (state.sort === "price-asc") return Number(a.price) - Number(b.price);
    if (state.sort === "price-desc") return Number(b.price) - Number(a.price);
    if (state.sort === "name") return a.name.localeCompare(b.name, "es");
    return Number(b.featured) - Number(a.featured) || String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

function renderCatalog() {
  updateFilterOptions();
  const items = filteredProducts();
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const visible = items.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  $("#catalog-grid").innerHTML = visible.map(productCard).join("");
  $("#catalog-grid").hidden = visible.length === 0;
  $("#catalog-empty").hidden = visible.length > 0;
  $("#results-count").textContent = `${items.length} ${items.length === 1 ? "producto" : "productos"}`;
  $("#pagination").innerHTML = items.length > PAGE_SIZE ? Array.from({ length: pages }, (_, index) => `<button type="button" class="${state.page === index + 1 ? "active" : ""}" data-page-number="${index + 1}">${index + 1}</button>`).join("") : "";
}

function canAdmin() {
  return !cloudEnabled || state.session?.user?.email?.toLowerCase() === AUTHORIZED_EMAIL;
}

function renderAdmin() {
  const authenticated = canAdmin();
  $("#admin-auth").classList.toggle("hidden", authenticated);
  $("#admin-content").classList.toggle("hidden", !authenticated);
  if (!authenticated) return;
  $("#admin-user").textContent = cloudEnabled ? `Sesión: ${state.session.user.email}` : "Modo local temporal";
  $("#logout-button").classList.toggle("hidden", !cloudEnabled);
  const list = $("#admin-list");
  list.innerHTML = state.products.map(product => {
    const stock = stockInfo(product);
    return `<article class="admin-row">
      <div class="admin-thumb">${productMedia(product, true)}</div>
      <span class="admin-product-name"><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.brand)} · ${escapeHTML(product.category)}</small></span>
      <span><small>Precio</small><strong>Bs ${money(product.price)}</strong></span>
      <span><small>Stock exacto</small><strong>${Number(product.stock)}</strong><em class="stock-level ${stock.className}">${stock.label}</em></span>
      <span><small>Estado</small><strong>${isOffer(product) ? "Oferta" : "Regular"}</strong></span>
      <div class="admin-actions"><button type="button" data-edit="${product.id}">Editar</button><button class="delete" type="button" data-delete="${product.id}">Eliminar</button></div>
    </article>`;
  }).join("");
  list.hidden = state.products.length === 0;
  $("#admin-empty").hidden = state.products.length > 0;
  $("#admin-count").textContent = `${state.products.length} ${state.products.length === 1 ? "producto" : "productos"}`;
  $("#setting-whatsapp").value = state.settings.whatsapp || "";
  $("#setting-instagram").value = state.settings.instagram || "";
  $("#setting-tiktok").value = state.settings.tiktok || "";
  $("#setting-email").value = state.settings.email || "";
  $("#setting-owner-email").value = state.settings.ownerEmail || "";
  $("#setting-phone").value = state.settings.storePhone || "";
  $("#setting-owner").value = state.settings.ownerName || "";
  $("#setting-address").value = state.settings.address || "";
  $("#setting-note").value = state.settings.note || "";
}

function openDetails(id) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  const stock = stockInfo(product);
  $("#modal-content").innerHTML = `<article class="modal-product">
    <div class="modal-media">${productMedia(product)}${isOffer(product) ? `<span class="discount-badge">-${discount(product)}%</span>` : ""}</div>
    <div class="modal-details">
      <span class="product-meta">${escapeHTML(product.brand)} · ${escapeHTML(product.category)}</span>
      <h2 id="modal-title">${escapeHTML(product.name)}</h2>
      <p>${escapeHTML(product.description || "Consulta características, disponibilidad y precio actualizado con nuestro equipo.")}</p>
      <div class="modal-price">Bs ${money(product.price)}</div>
      <p><strong>Disponibilidad:</strong> ${stock.detail} — ${stock.label}</p>
      <button class="button button-primary" type="button" data-contact="${product.id}">Consultar por WhatsApp</button>
      <button class="button button-ghost-dark" type="button" data-share="${product.id}">Copiar enlace del producto</button>
    </div>
  </article>`;
  $("#product-modal").classList.add("open");
  $("#product-modal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  history.replaceState(null, "", `${location.pathname}?producto=${encodeURIComponent(id)}#catalogo`);
}

function closeModal() {
  $("#product-modal").classList.remove("open");
  $("#product-modal").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (location.search) history.replaceState(null, "", `${location.pathname}${location.hash || "#catalogo"}`);
}

function contactProduct(id) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  const phone = (state.settings.whatsapp || "").replace(/\D/g, "");
  if (!phone) return showToast("Configura el número de WhatsApp en Administración.");
  const message = `Hola, quiero consultar por ${product.name} (Bs ${money(product.price)}). Veo ${Number(product.stock)} unidades registradas, ¿continúa disponible?`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

function shareProduct(id) {
  const url = `${location.origin}${location.pathname}?producto=${encodeURIComponent(id)}#catalogo`;
  navigator.clipboard?.writeText(url).then(() => showToast("Enlace copiado.")).catch(() => showToast("No se pudo copiar el enlace."));
}

function resetForm() {
  state.editingId = null;
  $("#product-form").reset();
  $("#product-stock").value = 0;
  $("#product-id").value = "";
  $("#form-title").textContent = "Añadir producto";
  $("#cancel-edit").classList.add("hidden");
}

function editProduct(id) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  state.editingId = id;
  $("#product-id").value = id;
  $("#product-name").value = product.name;
  $("#product-brand").value = product.brand;
  $("#product-category").value = product.category;
  $("#product-price").value = product.price;
  $("#product-compare").value = product.comparePrice || "";
  $("#product-stock").value = product.stock || 0;
  $("#product-image").value = product.image || "";
  $("#product-description").value = product.description || "";
  $("#product-featured").checked = Boolean(product.featured);
  $("#form-title").textContent = "Editar producto";
  $("#cancel-edit").classList.remove("hidden");
  $("#product-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteProduct(id) {
  const product = state.products.find(item => item.id === id);
  if (!product || !confirm(`¿Eliminar ${product.name}?`)) return;
  if (db) {
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) return showToast("No se pudo eliminar el producto.");
  }
  state.products = state.products.filter(item => item.id !== id);
  saveLocal();
  renderAll();
  showToast("Producto eliminado.");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function renderSettings() {
  $("#catalog-note").textContent = state.settings.note;
  const setLink = (selector, href, text) => { const element = $(selector); element.href = href; element.textContent = text; };
  const instagram = $("#instagram-link");
  if (state.settings.instagram) {
    const handle = state.settings.instagram.replace(/^@/, "");
    setLink("#instagram-link", `https://instagram.com/${handle}`, `@${handle}`);
    instagram.hidden = false;
  } else instagram.hidden = true;
  const tiktok = (state.settings.tiktok || "").replace(/^@/, "");
  setLink("#tiktok-link", `https://www.tiktok.com/@${tiktok}`, `@${tiktok}`);
  setLink("#contact-tiktok", `https://www.tiktok.com/@${tiktok}`, `@${tiktok}`);
  setLink("#footer-email", `mailto:${state.settings.email}`, state.settings.email);
  setLink("#contact-email", `mailto:${state.settings.email}`, state.settings.email);
  setLink("#contact-phone", `tel:+591${state.settings.storePhone.replace(/\D/g, "")}`, state.settings.storePhone);
  $("#contact-owner").textContent = state.settings.ownerName;
  $("#contact-address").textContent = state.settings.address;
  const whatsapp = state.settings.whatsapp.replace(/\D/g, "");
  $("#contact-whatsapp").href = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, quiero consultar sobre los productos de Happy Store.")}`;
}

function renderAll() {
  renderOffers();
  renderCatalog();
  renderAdmin();
  renderSettings();
}

$("#product-form").addEventListener("submit", async event => {
  event.preventDefault();
  const wasEditing = Boolean(state.editingId);
  const existing = state.products.find(item => item.id === state.editingId);
  const product = {
    id: state.editingId || crypto.randomUUID(),
    name: $("#product-name").value.trim(),
    brand: $("#product-brand").value.trim(),
    category: $("#product-category").value.trim(),
    price: Number($("#product-price").value),
    comparePrice: Number($("#product-compare").value || 0),
    stock: Math.max(0, Number($("#product-stock").value || 0)),
    image: $("#product-image").value.trim(),
    description: $("#product-description").value.trim(),
    featured: $("#product-featured").checked,
    createdAt: existing?.createdAt || new Date().toISOString()
  };
  if (db) {
    const { data, error } = await db.from("products").upsert(toDbProduct(product)).select().single();
    if (error) return showToast("No se pudo guardar. Revisa tu sesión y la conexión.");
    Object.assign(product, fromDbProduct(data));
  }
  if (wasEditing) state.products = state.products.map(item => item.id === product.id ? product : item);
  else state.products.unshift(product);
  saveLocal();
  resetForm();
  renderAll();
  showToast(wasEditing ? "Producto actualizado." : "Producto guardado.");
});

$("#settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  const settings = {
    id: 1,
    whatsapp: $("#setting-whatsapp").value.trim(),
    instagram: $("#setting-instagram").value.trim(),
    tiktok: $("#setting-tiktok").value.trim(),
    email: $("#setting-email").value.trim(),
    ownerEmail: $("#setting-owner-email").value.trim(),
    storePhone: $("#setting-phone").value.trim(),
    ownerName: $("#setting-owner").value.trim(),
    address: $("#setting-address").value.trim(),
    note: $("#setting-note").value.trim()
  };
  if (db) {
    const { error } = await db.from("store_settings").upsert(toDbSettings(settings));
    if (error) return showToast("No se pudo guardar la configuración.");
  }
  state.settings = settings;
  saveLocal();
  renderSettings();
  showToast("Configuración guardada.");
});

$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!db) return showToast("Supabase aún no está configurado.");
  const email = $("#login-email").value.trim().toLowerCase();
  if (email !== AUTHORIZED_EMAIL) return showToast("Este correo no está autorizado.");
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${location.pathname}#admin` } });
  showToast(error ? "No se pudo enviar el enlace de acceso." : "Revisa el correo de Happy Store para ingresar.");
});

$("#logout-button").addEventListener("click", async () => { if (db) await db.auth.signOut(); });
$("#search-input").addEventListener("input", event => { state.query = event.target.value; state.page = 1; renderCatalog(); });
$("#category-filter").addEventListener("change", event => { state.category = event.target.value; state.page = 1; renderCatalog(); });
$("#brand-filter").addEventListener("change", event => { state.brand = event.target.value; state.page = 1; renderCatalog(); });
$("#offer-filter").addEventListener("change", event => { state.offersOnly = event.target.checked; state.page = 1; renderCatalog(); });
$("#sort-select").addEventListener("change", event => { state.sort = event.target.value; renderCatalog(); });
$("#clear-filters").addEventListener("click", () => {
  state.query = state.category = state.brand = "";
  state.offersOnly = false;
  state.page = 1;
  $("#search-input").value = "";
  $("#offer-filter").checked = false;
  renderCatalog();
});

document.addEventListener("click", event => {
  const go = event.target.closest("[data-go]");
  if (go) location.hash = go.dataset.go;
  const detail = event.target.closest("[data-detail]");
  if (detail) openDetails(detail.dataset.detail);
  const contact = event.target.closest("[data-contact]");
  if (contact) contactProduct(contact.dataset.contact);
  const share = event.target.closest("[data-share]");
  if (share) shareProduct(share.dataset.share);
  const edit = event.target.closest("[data-edit]");
  if (edit) editProduct(edit.dataset.edit);
  const remove = event.target.closest("[data-delete]");
  if (remove) deleteProduct(remove.dataset.delete);
  const pageButton = event.target.closest("[data-page-number]");
  if (pageButton) { state.page = Number(pageButton.dataset.pageNumber); renderCatalog(); window.scrollTo({ top: $(".catalog-layout").offsetTop - 100, behavior: "smooth" }); }
  if (event.target.closest("[data-close-modal]")) closeModal();
});

$(".menu-toggle").addEventListener("click", event => {
  const open = $(".primary-nav").classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});
$("#cancel-edit").addEventListener("click", resetForm);
$("#export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ products: state.products, settings: state.settings }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `happy-store-catalogo-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
$("#import-data").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.products)) throw new Error("Formato inválido");
      if (db && data.products.length) {
        const { error } = await db.from("products").upsert(data.products.map(toDbProduct));
        if (error) throw error;
      }
      state.products = data.products;
      state.settings = { ...state.settings, ...(data.settings || {}) };
      if (db) await db.from("store_settings").upsert(toDbSettings(state.settings));
      saveLocal();
      renderAll();
      showToast("Datos importados correctamente.");
    } catch { showToast("El archivo no tiene un formato válido o no pudo sincronizarse."); }
    event.target.value = "";
  };
  reader.readAsText(file);
});

window.addEventListener("hashchange", route);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });

async function init() {
  if (db) {
    const { data } = await db.auth.getSession();
    state.session = data.session;
    db.auth.onAuthStateChange((_event, session) => { state.session = session; renderAdmin(); });
  }
  await loadCloudData();
  renderAll();
  route();
  const linkedProduct = new URLSearchParams(location.search).get("producto");
  if (linkedProduct && state.products.some(product => product.id === linkedProduct)) {
    location.hash = "catalogo";
    setTimeout(() => openDetails(linkedProduct), 120);
  }
}

init();
