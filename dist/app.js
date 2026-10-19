const SETTINGS_KEY = "happy-store-settings-v1";
const ORDERS_KEY = "happy-store-orders-v1";
const PAGE_SIZE = 9;
const PRODUCT_BUCKET = "product-images";
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ORDER_STATUSES = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  preparando: "Preparando",
  listo: "Listo para entregar",
  entregado: "Entregado",
  cancelado: "Cancelado"
};
const BASE_CATEGORIES = ["Accesorios", "Audio", "Celulares", "Cuidado personal", "Energía", "Hogar inteligente", "Tablets", "Wearables"];

const DEFAULT_SETTINGS = {
  id: 1,
  whatsapp: "59164000633",
  instagram: "",
  tiktok: "happystorecbba1",
  email: "Happystorecbba@gmail.com",
  ownerEmail: "Viciousfer1996@gmail.com",
  storePhone: "64000633",
  ownerName: "Franklin Fernando Condori Gregorio",
  address: "Calle Punata entre San Martín y Lanza, Shopping Garoni, 2do piso, oficina 10-C",
  note: "Precios referenciales sujetos a variación. Consulta el precio y stock actual antes de comprar.",
  heroDiscountPercent: 20,
  heroImage: ""
};

const config = window.HAPPY_STORE_CONFIG || {};
const cloudEnabled = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
const db = cloudEnabled ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

const state = {
  products: [],
  orders: readJSON(ORDERS_KEY, []),
  settings: { ...DEFAULT_SETTINGS, ...readJSON(SETTINGS_KEY, {}) },
  session: null,
  query: "",
  category: "",
  brand: "",
  offersOnly: false,
  sort: "featured",
  page: 1,
  editingId: null,
  editingOrderId: null,
  orderStatusFilter: ""
};

try { localStorage.removeItem("happy-store-products-v1"); } catch {}

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveLocal() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  localStorage.setItem(ORDERS_KEY, JSON.stringify(state.orders));
}

function storageObjectPath(url = "") {
  const marker = `/storage/v1/object/public/${PRODUCT_BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? "" : decodeURIComponent(url.slice(index + marker.length));
}

async function uploadProductImage(file, productId) {
  if (!db) throw new Error("Supabase no está disponible.");
  if (!file.type.startsWith("image/")) throw new Error("Selecciona una imagen válida.");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen no debe superar 8 MB.");
  const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${productId}/${Date.now()}.${extension}`;
  const { error } = await db.storage.from(PRODUCT_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  return db.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl;
}

function money(value) {
  return new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function isOffer(product) {
  const priceDiscount = product.price !== null && product.price !== "" && Number(product.comparePrice) > Number(product.price) && Number(product.price) >= 0;
  return Boolean(product.onSale ?? priceDiscount) && discount(product) > 0;
}

function discount(product) {
  const explicit = Math.round(Number(product.discountPercent || 0));
  if (explicit > 0) return Math.min(99, explicit);
  if (product.price === null || product.price === "" || Number(product.comparePrice) <= Number(product.price)) return 0;
  return Math.max(0, Math.min(99, Math.round((1 - Number(product.price) / Number(product.comparePrice)) * 100)));
}

function stockInfo(product) {
  if (product.stock === null || product.stock === "" || product.stock === undefined) {
    return { label: "Por confirmar", detail: "Consultar stock", className: "stock-pending" };
  }
  const stock = Math.max(0, Number(product.stock));
  if (stock === 0) return { label: "Agotado", detail: "0 unidades", className: "stock-out" };
  if (stock <= 3) return { label: "Stock bajo", detail: `${stock} ${stock === 1 ? "unidad" : "unidades"}`, className: "stock-low" };
  return { label: "Disponible", detail: `${stock} unidades`, className: "stock-ok" };
}

function fromDbProduct(row) {
  const price = row.price === null ? null : Number(row.price);
  const comparePrice = row.compare_price === null ? null : Number(row.compare_price);
  const calculatedDiscount = price !== null && comparePrice > price ? Math.round((1 - price / comparePrice) * 100) : 0;
  return {
    id: row.id,
    name: row.name || "",
    brand: row.brand || "",
    category: row.category || "",
    price,
    comparePrice,
    stock: row.stock === null ? null : Number(row.stock),
    image: row.image_url || "",
    description: row.description || "",
    featured: Boolean(row.featured),
    onSale: typeof row.on_sale === "boolean" ? row.on_sale : calculatedDiscount > 0,
    discountPercent: row.discount_percent === null || row.discount_percent === undefined ? calculatedDiscount : Number(row.discount_percent),
    createdAt: row.created_at || new Date().toISOString()
  };
}

function toDbProduct(product) {
  const saleActive = Boolean(product.onSale ?? (product.price !== null && product.price !== "" && Number(product.comparePrice) > Number(product.price)));
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price === null || product.price === "" ? null : Number(product.price),
    compare_price: product.comparePrice === null || product.comparePrice === "" ? null : Number(product.comparePrice),
    stock: product.stock === null || product.stock === "" ? null : Math.max(0, Number(product.stock)),
    image_url: product.image || null,
    description: product.description || null,
    featured: Boolean(product.featured),
    on_sale: saleActive,
    discount_percent: saleActive ? Math.max(1, Math.min(99, discount(product))) : 0
  };
}

function fromDbOrder(row) {
  return {
    id: row.id,
    number: row.order_number,
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    items: row.items || "",
    total: row.total === null ? null : Number(row.total),
    status: ORDER_STATUSES[row.status] ? row.status : "pendiente",
    orderedAt: row.ordered_at || todayISO(),
    notes: row.notes || "",
    createdAt: row.created_at || new Date().toISOString()
  };
}

function toDbOrder(order) {
  return {
    id: order.id,
    customer_name: order.customerName,
    customer_phone: order.customerPhone || null,
    items: order.items,
    total: order.total === null || order.total === "" ? null : Number(order.total),
    status: ORDER_STATUSES[order.status] ? order.status : "pendiente",
    ordered_at: order.orderedAt,
    notes: order.notes || null,
    updated_at: new Date().toISOString()
  };
}

function todayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateParts(dateValue) {
  const [year, month, day] = String(dateValue || "").split("-").map(Number);
  return { year, month: month - 1, day };
}

function displayDate(dateValue) {
  const { year, month, day } = dateParts(dateValue);
  if (!year || month < 0 || !day) return "Sin fecha";
  return new Intl.DateTimeFormat("es-BO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, day)));
}

function orderNumber(order) {
  return `#${String(order.number || "—").padStart(4, "0")}`;
}

function fromDbSettings(row = {}) {
  const storePhone = row.store_phone || DEFAULT_SETTINGS.storePhone;
  const savedWhatsapp = row.whatsapp || DEFAULT_SETTINGS.whatsapp;
  const whatsapp = savedWhatsapp.replace(/\D/g, "") === "59174806956"
    ? storePhone
    : savedWhatsapp;
  return {
    ...DEFAULT_SETTINGS,
    id: row.id || 1,
    whatsapp,
    instagram: row.instagram || "",
    tiktok: row.tiktok || DEFAULT_SETTINGS.tiktok,
    email: row.email || DEFAULT_SETTINGS.email,
    ownerEmail: row.owner_email || DEFAULT_SETTINGS.ownerEmail,
    storePhone,
    ownerName: row.owner_name || DEFAULT_SETTINGS.ownerName,
    address: row.address || DEFAULT_SETTINGS.address,
    note: row.catalog_note || DEFAULT_SETTINGS.note,
    heroDiscountPercent: Math.max(1, Math.min(99, Number(row.hero_discount_percent || DEFAULT_SETTINGS.heroDiscountPercent))),
    heroImage: row.hero_image_url || ""
  };
}

function whatsappNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 8 ? `591${digits}` : digits;
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
    hero_discount_percent: Math.max(1, Math.min(99, Number(settings.heroDiscountPercent || DEFAULT_SETTINGS.heroDiscountPercent))),
    hero_image_url: settings.heroImage || null,
    updated_at: new Date().toISOString()
  };
}

async function loadOrders() {
  if (!db || !canAdmin()) {
    if (cloudEnabled) state.orders = [];
    return;
  }
  const { data, error } = await db.from("orders").select("*").order("ordered_at", { ascending: false }).order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    setConnectionStatus("El inventario está conectado, pero no se pudieron cargar los pedidos.", true);
    return;
  }
  state.orders = (data || []).map(fromDbOrder);
  saveLocal();
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
  await loadOrders();
  saveLocal();
  setConnectionStatus("Catálogo y pedidos conectados con Supabase.");
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
  const price = product.price === null ? '<span class="current-price price-pending">Consultar precio</span>' : `<span class="current-price">Bs ${money(product.price)}</span>${isOffer(product) ? `<span class="old-price">Bs ${money(product.comparePrice)}</span>` : ""}`;
  return `<article class="product-card">
    <div class="product-media">
      ${productMedia(product)}
      ${isOffer(product) ? `<span class="discount-badge">-${discount(product)}%</span>` : ""}
      <span class="stock-badge ${stock.className}">${stock.detail}</span>
    </div>
    <div class="product-body">
      <span class="product-meta">${escapeHTML(product.brand)} · ${escapeHTML(product.category)}</span>
      <h3>${escapeHTML(product.name)}</h3>
      <div class="price-row">${price}</div>
      <div class="product-actions">
        <button class="detail-button" type="button" data-detail="${product.id}">Detalles</button>
        <button class="contact-button" type="button" data-contact="${product.id}">Consultar</button>
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

function catalogCategories() {
  return [...new Set([...BASE_CATEGORIES, ...uniqueValues("category")])].sort((a, b) => a.localeCompare(b, "es"));
}

function updateProductCategoryOptions() {
  const categories = catalogCategories();
  [$("#product-category"), $("#edit-product-category")].forEach(select => {
    const selected = select.value;
    select.innerHTML = `<option value="">Selecciona una categoría</option>${categories.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
    if (categories.includes(selected)) select.value = selected;
  });
}

function updateFilterOptions() {
  const category = $("#category-filter");
  const brand = $("#brand-filter");
  category.innerHTML = `<option value="">Todas</option>${catalogCategories().map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
  brand.innerHTML = `<option value="">Todas</option>${uniqueValues("brand").map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
  category.value = state.category;
  brand.value = state.brand;
  updateProductCategoryOptions();
}

function renderFooterCategories() {
  const categories = catalogCategories();
  $("#footer-categories").innerHTML = categories
    .map(category => `<button type="button" data-footer-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`)
    .join("");
}

function filteredProducts() {
  const query = state.query.trim().toLowerCase();
  const items = state.products.filter(product => {
    const haystack = `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!state.category || product.category === state.category) && (!state.brand || product.brand === state.brand) && (!state.offersOnly || isOffer(product));
  });
  return items.sort((a, b) => {
    if (state.sort === "price-asc") return (a.price === null) - (b.price === null) || Number(a.price) - Number(b.price);
    if (state.sort === "price-desc") return (a.price === null) - (b.price === null) || Number(b.price) - Number(a.price);
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
  return Boolean(cloudEnabled && state.session?.user);
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
      <span><small>Precio</small><strong>${product.price === null ? "Por confirmar" : `Bs ${money(product.price)}`}</strong></span>
      <span><small>Stock exacto</small><strong>${product.stock === null ? "Por confirmar" : Number(product.stock)}</strong><em class="stock-level ${stock.className}">${stock.label}</em></span>
      <span><small>Estado</small><strong>${isOffer(product) ? "Oferta" : "Sin descuento"}</strong></span>
      <div class="admin-actions"><button type="button" data-edit="${product.id}">Editar</button><button class="delete" type="button" data-delete="${product.id}">Eliminar</button></div>
    </article>`;
  }).join("");
  list.hidden = state.products.length === 0;
  $("#admin-empty").hidden = state.products.length > 0;
  $("#admin-count").textContent = `${state.products.length} ${state.products.length === 1 ? "producto" : "productos"}`;
  renderOrders();
  $("#setting-whatsapp").value = state.settings.whatsapp || "";
  $("#setting-instagram").value = state.settings.instagram || "";
  $("#setting-tiktok").value = state.settings.tiktok || "";
  $("#setting-email").value = state.settings.email || "";
  $("#setting-owner-email").value = state.settings.ownerEmail || "";
  $("#setting-phone").value = state.settings.storePhone || "";
  $("#setting-owner").value = state.settings.ownerName || "";
  $("#setting-address").value = state.settings.address || "";
  $("#setting-note").value = state.settings.note || "";
  $("#setting-hero-discount").value = state.settings.heroDiscountPercent || DEFAULT_SETTINGS.heroDiscountPercent;
  $("#setting-hero-image").value = state.settings.heroImage || "";
}

function orderStatusOptions(selected) {
  return Object.entries(ORDER_STATUSES).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

function filteredOrders() {
  return state.orders.filter(order => !state.orderStatusFilter || order.status === state.orderStatusFilter);
}

function prepareReportSelectors() {
  const yearSelect = $("#report-year");
  const currentYear = new Date().getFullYear();
  const years = [...new Set([currentYear, ...state.orders.map(order => dateParts(order.orderedAt).year).filter(Boolean)])].sort((a, b) => b - a);
  const signature = years.join(",");
  if (yearSelect.dataset.signature === signature) return;
  const previousYear = Number(yearSelect.value);
  const wasReady = Boolean(yearSelect.dataset.ready);
  yearSelect.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join("");
  yearSelect.value = String(years.includes(previousYear) ? previousYear : currentYear);
  if (!wasReady) $("#report-month").value = String(new Date().getMonth());
  yearSelect.dataset.ready = "true";
  yearSelect.dataset.signature = signature;
}

function renderOrders() {
  const list = $("#orders-list");
  if (!list) return;
  prepareReportSelectors();
  const visible = filteredOrders();
  const active = state.orders.filter(order => !["entregado", "cancelado"].includes(order.status)).length;
  const delivered = state.orders.filter(order => order.status === "entregado").length;
  const revenue = state.orders.filter(order => order.status !== "cancelado").reduce((sum, order) => sum + Number(order.total || 0), 0);
  $("#orders-count").textContent = `${state.orders.length} ${state.orders.length === 1 ? "pedido" : "pedidos"}`;
  $("#orders-stat-total").textContent = state.orders.length;
  $("#orders-stat-active").textContent = active;
  $("#orders-stat-delivered").textContent = delivered;
  $("#orders-stat-revenue").textContent = `Bs ${money(revenue)}`;
  list.innerHTML = visible.map(order => `<article class="order-row">
    <span><strong class="order-number">${orderNumber(order)}</strong><small>${displayDate(order.orderedAt)}</small></span>
    <span><strong>${escapeHTML(order.customerName)}</strong><small>${escapeHTML(order.customerPhone || "Sin teléfono")}</small></span>
    <span class="order-items">${escapeHTML(order.items)}</span>
    <span class="order-total"><small>Total</small><strong>${order.total === null ? "Por confirmar" : `Bs ${money(order.total)}`}</strong></span>
    <select class="order-status-select status-${order.status}" data-order-status="${order.id}" aria-label="Estado del pedido ${orderNumber(order)}">${orderStatusOptions(order.status)}</select>
    <div class="order-actions"><button type="button" data-edit-order="${order.id}">Editar</button><button class="delete" type="button" data-delete-order="${order.id}">Eliminar</button></div>
  </article>`).join("");
  list.hidden = visible.length === 0;
  $("#orders-empty").hidden = visible.length > 0;
  $("#orders-empty").querySelector("p").textContent = state.orders.length ? "No hay pedidos con el estado seleccionado." : "Registra el primer pedido usando el formulario.";
}

function resetOrderForm() {
  state.editingOrderId = null;
  $("#order-form").reset();
  $("#order-id").value = "";
  $("#order-date").value = todayISO();
  $("#order-status").value = "pendiente";
  $("#order-form-title").textContent = "Nuevo pedido";
  $("#cancel-order-edit").classList.add("hidden");
}

function editOrder(id) {
  const order = state.orders.find(item => item.id === id);
  if (!order) return;
  state.editingOrderId = id;
  $("#order-id").value = id;
  $("#order-customer").value = order.customerName;
  $("#order-phone").value = order.customerPhone || "";
  $("#order-date").value = order.orderedAt;
  $("#order-status").value = order.status;
  $("#order-items").value = order.items;
  $("#order-total").value = order.total ?? "";
  $("#order-notes").value = order.notes || "";
  $("#order-form-title").textContent = `Editar pedido ${orderNumber(order)}`;
  $("#cancel-order-edit").classList.remove("hidden");
  $("#order-form").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function updateOrderStatus(id, status) {
  if (!ORDER_STATUSES[status]) return;
  if (db) {
    const { error } = await db.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      renderOrders();
      return showToast("No se pudo actualizar el estado del pedido.");
    }
  }
  state.orders = state.orders.map(order => order.id === id ? { ...order, status } : order);
  saveLocal();
  renderOrders();
  showToast(`Pedido marcado como ${ORDER_STATUSES[status].toLowerCase()}.`);
}

async function deleteOrder(id) {
  const order = state.orders.find(item => item.id === id);
  if (!order || !confirm(`¿Eliminar el pedido ${orderNumber(order)} de ${order.customerName}?`)) return;
  if (db) {
    const { error } = await db.from("orders").delete().eq("id", id);
    if (error) return showToast("No se pudo eliminar el pedido.");
  }
  state.orders = state.orders.filter(item => item.id !== id);
  if (state.editingOrderId === id) resetOrderForm();
  saveLocal();
  renderOrders();
  showToast("Pedido eliminado.");
}

function ordersForReport(year, month) {
  return state.orders.filter(order => {
    const parts = dateParts(order.orderedAt);
    return parts.year === year && (month === "all" || parts.month === Number(month));
  }).sort((a, b) => String(a.orderedAt).localeCompare(String(b.orderedAt)) || Number(a.number || 0) - Number(b.number || 0));
}

function generateOrdersPdf() {
  const jsPdf = window.jspdf?.jsPDF;
  if (!jsPdf) return showToast("No se pudo cargar el generador de PDF. Revisa tu conexión.");
  const year = Number($("#report-year").value);
  const month = $("#report-month").value;
  const orders = ordersForReport(year, month);
  if (!orders.length) return showToast("No hay pedidos en el periodo seleccionado.");

  const doc = new jsPdf({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const period = month === "all" ? `Gestión ${year}` : `${MONTHS[Number(month)]} ${year}`;
  const total = orders.filter(order => order.status !== "cancelado").reduce((sum, order) => sum + Number(order.total || 0), 0);
  const delivered = orders.filter(order => order.status === "entregado").length;
  const cancelled = orders.filter(order => order.status === "cancelado").length;
  let y = 0;

  const pageHeader = () => {
    doc.setFillColor(20, 25, 29);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("HAPPY STORE", margin, 13);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Reporte de pedidos · ${period}`, margin, 21);
    doc.text(`Generado: ${new Intl.DateTimeFormat("es-BO").format(new Date())}`, pageWidth - margin, 21, { align: "right" });
    doc.setTextColor(20, 25, 29);
    y = 39;
  };

  const ensureSpace = height => {
    if (y + height <= 282) return;
    doc.addPage();
    pageHeader();
  };

  const summaryBox = (x, width, label, value) => {
    doc.setFillColor(235, 239, 242);
    doc.roundedRect(x, y, width, 19, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(90, 104, 114);
    doc.text(label.toUpperCase(), x + 4, y + 6);
    doc.setFontSize(12);
    doc.setTextColor(20, 25, 29);
    doc.text(value, x + 4, y + 14);
  };

  pageHeader();
  const boxGap = 3;
  const boxWidth = (contentWidth - boxGap * 3) / 4;
  summaryBox(margin, boxWidth, "Pedidos", String(orders.length));
  summaryBox(margin + (boxWidth + boxGap), boxWidth, "Entregados", String(delivered));
  summaryBox(margin + (boxWidth + boxGap) * 2, boxWidth, "Cancelados", String(cancelled));
  summaryBox(margin + (boxWidth + boxGap) * 3, boxWidth, "Total", `Bs ${money(total)}`);
  y += 27;

  if (month === "all") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Resumen mensual", margin, y);
    y += 5;
    MONTHS.forEach((monthName, index) => {
      const monthly = orders.filter(order => dateParts(order.orderedAt).month === index);
      const monthlyTotal = monthly.filter(order => order.status !== "cancelado").reduce((sum, order) => sum + Number(order.total || 0), 0);
      doc.setFillColor(index % 2 ? 248 : 242, index % 2 ? 249 : 245, index % 2 ? 250 : 247);
      doc.rect(margin, y, contentWidth, 7, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(monthName, margin + 3, y + 4.7);
      doc.text(`${monthly.length} ${monthly.length === 1 ? "pedido" : "pedidos"}`, margin + 75, y + 4.7);
      doc.text(`Bs ${money(monthlyTotal)}`, pageWidth - margin - 3, y + 4.7, { align: "right" });
      y += 7;
    });
    y += 7;
    ensureSpace(20);
  }

  const columns = [18, 23, 33, 52, 29, 27];
  const headers = ["Nro.", "Fecha", "Cliente", "Productos", "Estado", "Total (Bs)"];
  const drawTableHeader = () => {
    doc.setFillColor(69, 93, 119);
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    let x = margin;
    headers.forEach((header, index) => { doc.text(header, x + 2, y + 5.2); x += columns[index]; });
    doc.setTextColor(20, 25, 29);
    y += 8;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Detalle de pedidos", margin, y);
  y += 5;
  drawTableHeader();

  orders.forEach((order, index) => {
    const clientLines = doc.splitTextToSize(order.customerName, columns[2] - 4);
    const itemLines = doc.splitTextToSize(order.items.replace(/\n+/g, " · "), columns[3] - 4);
    const statusLines = doc.splitTextToSize(ORDER_STATUSES[order.status], columns[4] - 4);
    const maxLines = Math.max(clientLines.length, itemLines.length, statusLines.length, 1);
    const rowHeight = Math.max(9, maxLines * 3.7 + 4);
    if (y + rowHeight > 282) {
      doc.addPage();
      pageHeader();
      drawTableHeader();
    }
    doc.setFillColor(index % 2 ? 250 : 244, index % 2 ? 251 : 247, index % 2 ? 252 : 249);
    doc.rect(margin, y, contentWidth, rowHeight, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    let x = margin;
    const cells = [orderNumber(order), displayDate(order.orderedAt), clientLines, itemLines, statusLines, order.total === null ? "—" : money(order.total)];
    cells.forEach((cell, cellIndex) => {
      doc.text(cell, x + 2, y + 4.6, { baseline: "alphabetic" });
      x += columns[cellIndex];
    });
    y += rowHeight;
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(205, 213, 219);
    doc.line(margin, 288, pageWidth - margin, 288);
    doc.setFontSize(7.5);
    doc.setTextColor(105, 118, 128);
    doc.text("Happy Store · Reporte administrativo", margin, 293);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - margin, 293, { align: "right" });
  }

  const suffix = month === "all" ? "anual" : String(Number(month) + 1).padStart(2, "0");
  doc.save(`happy-store-pedidos-${year}-${suffix}.pdf`);
  showToast("Reporte PDF generado.");
}

function openDetails(id) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  const stock = stockInfo(product);
  const price = product.price === null ? "Consultar precio" : `Bs ${money(product.price)}`;
  $("#modal-content").innerHTML = `<article class="modal-product">
    <div class="modal-media">${productMedia(product)}${isOffer(product) ? `<span class="discount-badge">-${discount(product)}%</span>` : ""}</div>
    <div class="modal-details">
      <span class="product-meta">${escapeHTML(product.brand)} · ${escapeHTML(product.category)}</span>
      <h2 id="modal-title">${escapeHTML(product.name)}</h2>
      <p>${escapeHTML(product.description || "Consulta características, disponibilidad y precio actualizado con nuestro equipo.")}</p>
      <div class="modal-price">${price}</div>
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
  const phone = whatsappNumber(state.settings.whatsapp);
  if (!phone) return showToast("Configura el número de WhatsApp en Administración.");
  const priceText = product.price === null ? "precio por confirmar" : `Bs ${money(product.price)}`;
  const stockText = product.stock === null ? "stock por confirmar" : `${Number(product.stock)} unidades registradas`;
  const message = `Hola, quiero consultar por ${product.name} (${priceText}). Veo ${stockText}, ¿continúa disponible?`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
}

function shareProduct(id) {
  const url = `${location.origin}${location.pathname}?producto=${encodeURIComponent(id)}#catalogo`;
  navigator.clipboard?.writeText(url).then(() => showToast("Enlace copiado.")).catch(() => showToast("No se pudo copiar el enlace."));
}

function resetForm() {
  $("#product-form").reset();
  syncSaleControls("product");
}

function editProduct(id) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  state.editingId = id;
  $("#edit-product-name").value = product.name;
  $("#edit-product-brand").value = product.brand;
  $("#edit-product-category").value = product.category;
  $("#edit-product-price").value = product.price ?? "";
  $("#edit-product-compare").value = product.comparePrice ?? "";
  $("#edit-product-stock").value = product.stock ?? "";
  $("#edit-product-image").value = product.image || "";
  $("#edit-product-description").value = product.description || "";
  $("#edit-product-on-sale").checked = isOffer(product);
  $("#edit-product-discount-percent").value = isOffer(product) ? discount(product) : "";
  syncSaleControls("edit-product");
  $("#edit-product-featured").checked = Boolean(product.featured);
  $("#edit-product-modal").classList.add("open");
  $("#edit-product-modal").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("#edit-product-name").focus(), 0);
}

function closeEditProductModal() {
  $("#edit-product-modal").classList.remove("open");
  $("#edit-product-modal").setAttribute("aria-hidden", "true");
  $("#edit-product-form").reset();
  state.editingId = null;
  document.body.style.overflow = "";
}

async function deleteProduct(id) {
  const product = state.products.find(item => item.id === id);
  if (!product || !confirm(`¿Eliminar ${product.name}?`)) return;
  if (db) {
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) return showToast("No se pudo eliminar el producto.");
    const objectPath = storageObjectPath(product.image);
    if (objectPath) {
      const { error: imageError } = await db.storage.from(PRODUCT_BUCKET).remove([objectPath]);
      if (imageError) console.warn("El producto se eliminó, pero no se pudo borrar su fotografía.", imageError);
    }
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
  const whatsapp = whatsappNumber(state.settings.whatsapp);
  $("#contact-whatsapp").href = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, quiero consultar sobre los productos de Happy Store.")}`;
  const heroPercent = Math.max(1, Math.min(99, Number(state.settings.heroDiscountPercent || DEFAULT_SETTINGS.heroDiscountPercent)));
  $("#hero-offer-tag").textContent = `-${heroPercent}%`;
  $("#hero-offer-placeholder-percent").textContent = `${heroPercent}%`;
  const heroImage = $("#hero-offer-image");
  const heroPlaceholder = $("#hero-offer-placeholder");
  if (state.settings.heroImage) {
    heroImage.src = state.settings.heroImage;
    heroImage.hidden = false;
    heroPlaceholder.hidden = true;
  } else {
    heroImage.removeAttribute("src");
    heroImage.hidden = true;
    heroPlaceholder.hidden = false;
  }
}

function syncSaleControls(prefix) {
  const checked = $(`#${prefix}-on-sale`).checked;
  const percentage = $(`#${prefix}-discount-percent`);
  percentage.disabled = !checked;
  percentage.required = checked;
  if (!checked) percentage.value = "";
}

function renderAll() {
  renderOffers();
  renderCatalog();
  renderAdmin();
  renderSettings();
  renderFooterCategories();
}

$("#product-form").addEventListener("submit", async event => {
  event.preventDefault();
  const productId = crypto.randomUUID();
  const imageFile = $("#product-image-file").files?.[0];
  let imageUrl = $("#product-image").value.trim();
  if (imageFile) {
    try { imageUrl = await uploadProductImage(imageFile, productId); }
    catch (error) { return showToast(error.message || "No se pudo subir la fotografía."); }
  }
  const product = {
    id: productId,
    name: $("#product-name").value.trim(),
    brand: $("#product-brand").value.trim(),
    category: $("#product-category").value.trim(),
    price: $("#product-price").value === "" ? null : Number($("#product-price").value),
    comparePrice: $("#product-compare").value === "" ? null : Number($("#product-compare").value),
    stock: $("#product-stock").value === "" ? null : Math.max(0, Number($("#product-stock").value)),
    image: imageUrl,
    description: $("#product-description").value.trim(),
    onSale: $("#product-on-sale").checked,
    discountPercent: $("#product-on-sale").checked ? Number($("#product-discount-percent").value) : 0,
    featured: $("#product-featured").checked,
    createdAt: new Date().toISOString()
  };
  if (db) {
    const { data, error } = await db.from("products").upsert(toDbProduct(product)).select().single();
    if (error) return showToast("No se pudo guardar. Revisa tu sesión y la conexión.");
    Object.assign(product, fromDbProduct(data));
  }
  state.products.unshift(product);
  saveLocal();
  resetForm();
  renderAll();
  showToast("Producto guardado.");
});

$("#edit-product-form").addEventListener("submit", async event => {
  event.preventDefault();
  const existing = state.products.find(item => item.id === state.editingId);
  if (!existing) return showToast("No se encontró el producto que quieres editar.");
  const imageFile = $("#edit-product-image-file").files?.[0];
  let imageUrl = $("#edit-product-image").value.trim();
  if (imageFile) {
    try { imageUrl = await uploadProductImage(imageFile, existing.id); }
    catch (error) { return showToast(error.message || "No se pudo subir la fotografía."); }
  }
  const product = {
    id: existing.id,
    name: $("#edit-product-name").value.trim(),
    brand: $("#edit-product-brand").value.trim(),
    category: $("#edit-product-category").value.trim(),
    price: $("#edit-product-price").value === "" ? null : Number($("#edit-product-price").value),
    comparePrice: $("#edit-product-compare").value === "" ? null : Number($("#edit-product-compare").value),
    stock: $("#edit-product-stock").value === "" ? null : Math.max(0, Number($("#edit-product-stock").value)),
    image: imageUrl,
    description: $("#edit-product-description").value.trim(),
    onSale: $("#edit-product-on-sale").checked,
    discountPercent: $("#edit-product-on-sale").checked ? Number($("#edit-product-discount-percent").value) : 0,
    featured: $("#edit-product-featured").checked,
    createdAt: existing.createdAt
  };
  if (db) {
    const { data, error } = await db.from("products").upsert(toDbProduct(product)).select().single();
    if (error) return showToast("No se pudo actualizar. Revisa tu sesión y la conexión.");
    Object.assign(product, fromDbProduct(data));
    if (imageFile && existing.image && existing.image !== product.image) {
      const previousPath = storageObjectPath(existing.image);
      if (previousPath) await db.storage.from(PRODUCT_BUCKET).remove([previousPath]);
    }
  }
  state.products = state.products.map(item => item.id === product.id ? product : item);
  saveLocal();
  closeEditProductModal();
  renderAll();
  showToast("Producto actualizado.");
});

$("#order-form").addEventListener("submit", async event => {
  event.preventDefault();
  const wasEditing = Boolean(state.editingOrderId);
  const existing = state.orders.find(item => item.id === state.editingOrderId);
  const order = {
    id: state.editingOrderId || crypto.randomUUID(),
    number: existing?.number || (Math.max(0, ...state.orders.map(item => Number(item.number || 0))) + 1),
    customerName: $("#order-customer").value.trim(),
    customerPhone: $("#order-phone").value.trim(),
    orderedAt: $("#order-date").value,
    status: $("#order-status").value,
    items: $("#order-items").value.trim(),
    total: $("#order-total").value === "" ? null : Number($("#order-total").value),
    notes: $("#order-notes").value.trim(),
    createdAt: existing?.createdAt || new Date().toISOString()
  };
  if (db) {
    const { data, error } = await db.from("orders").upsert(toDbOrder(order)).select().single();
    if (error) return showToast("No se pudo guardar el pedido. Revisa tu sesión.");
    Object.assign(order, fromDbOrder(data));
  }
  if (wasEditing) state.orders = state.orders.map(item => item.id === order.id ? order : item);
  else state.orders.unshift(order);
  state.orders.sort((a, b) => String(b.orderedAt).localeCompare(String(a.orderedAt)) || Number(b.number || 0) - Number(a.number || 0));
  saveLocal();
  resetOrderForm();
  renderOrders();
  showToast(wasEditing ? "Pedido actualizado." : "Pedido registrado.");
});

$("#settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  const settings = {
    ...state.settings,
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

$("#hero-settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  const heroImageFile = $("#setting-hero-image-file").files?.[0];
  const previousHeroImage = state.settings.heroImage || "";
  let heroImage = $("#setting-hero-image").value.trim();
  if (heroImageFile) {
    try { heroImage = await uploadProductImage(heroImageFile, "site-settings/hero-offer"); }
    catch (error) { return showToast(error.message || "No se pudo subir la imagen principal."); }
  }
  const settings = {
    ...state.settings,
    heroDiscountPercent: Math.max(1, Math.min(99, Number($("#setting-hero-discount").value || DEFAULT_SETTINGS.heroDiscountPercent))),
    heroImage
  };
  if (db) {
    const { error } = await db.from("store_settings").upsert(toDbSettings(settings));
    if (error) return showToast("No se pudo guardar la oferta principal. Ejecuta primero la migración de ofertas en Supabase.");
    if (heroImageFile && previousHeroImage && previousHeroImage !== heroImage) {
      const previousPath = storageObjectPath(previousHeroImage);
      if (previousPath) await db.storage.from(PRODUCT_BUCKET).remove([previousPath]);
    }
  }
  state.settings = settings;
  saveLocal();
  renderSettings();
  $("#setting-hero-image").value = heroImage;
  $("#setting-hero-image-file").value = "";
  showToast("Oferta principal actualizada.");
});

$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!db) return showToast("Supabase aún no está configurado.");
  const email = $("#login-email").value.trim().toLowerCase();
  const password = $("#login-password").value;
  const submitButton = event.currentTarget.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Ingresando…";
  const { error } = await db.auth.signInWithPassword({ email, password });
  submitButton.disabled = false;
  submitButton.textContent = "Ingresar al panel";
  if (error?.message?.toLowerCase().includes("email not confirmed")) return showToast("Este usuario todavía no fue confirmado en Supabase.");
  if (error) return showToast("Correo o contraseña incorrectos.");
  $("#login-password").value = "";
  showToast("Bienvenido al panel de Happy Store.");
});

$("#logout-button").addEventListener("click", async () => { if (db) await db.auth.signOut(); });
$("#cancel-order-edit").addEventListener("click", resetOrderForm);
$("#generate-orders-pdf").addEventListener("click", generateOrdersPdf);
$("#orders-status-filter").addEventListener("change", event => { state.orderStatusFilter = event.target.value; renderOrders(); });
$("#search-input").addEventListener("input", event => { state.query = event.target.value; state.page = 1; renderCatalog(); });
$("#category-filter").addEventListener("change", event => { state.category = event.target.value; state.page = 1; renderCatalog(); });
$("#brand-filter").addEventListener("change", event => { state.brand = event.target.value; state.page = 1; renderCatalog(); });
$("#offer-filter").addEventListener("change", event => { state.offersOnly = event.target.checked; state.page = 1; renderCatalog(); });
$("#product-on-sale").addEventListener("change", () => syncSaleControls("product"));
$("#edit-product-on-sale").addEventListener("change", () => syncSaleControls("edit-product"));
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
  const footerCategory = event.target.closest("[data-footer-category]");
  if (footerCategory) {
    state.category = footerCategory.dataset.footerCategory;
    state.page = 1;
    location.hash = "catalogo";
    renderCatalog();
  }
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
  const editOrderButton = event.target.closest("[data-edit-order]");
  if (editOrderButton) editOrder(editOrderButton.dataset.editOrder);
  const deleteOrderButton = event.target.closest("[data-delete-order]");
  if (deleteOrderButton) deleteOrder(deleteOrderButton.dataset.deleteOrder);
  const pageButton = event.target.closest("[data-page-number]");
  if (pageButton) { state.page = Number(pageButton.dataset.pageNumber); renderCatalog(); window.scrollTo({ top: $(".catalog-layout").offsetTop - 100, behavior: "smooth" }); }
  if (event.target.closest("[data-close-modal]")) closeModal();
  if (event.target.closest("[data-close-edit-modal]")) closeEditProductModal();
});

document.addEventListener("change", event => {
  const statusSelect = event.target.closest("[data-order-status]");
  if (statusSelect) updateOrderStatus(statusSelect.dataset.orderStatus, statusSelect.value);
});

$(".menu-toggle").addEventListener("click", event => {
  const open = $(".primary-nav").classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});
$("#export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ products: state.products, orders: state.orders, settings: state.settings }, null, 2)], { type: "application/json" });
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
      if (db && Array.isArray(data.orders) && data.orders.length) {
        const { error } = await db.from("orders").upsert(data.orders.map(toDbOrder));
        if (error) throw error;
      }
      state.products = data.products;
      state.orders = Array.isArray(data.orders) ? data.orders : state.orders;
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
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  closeModal();
  closeEditProductModal();
});

async function init() {
  if (db) {
    const { data } = await db.auth.getSession();
    state.session = data.session;
    db.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      setTimeout(async () => {
        if (session) await loadOrders();
        else state.orders = [];
        saveLocal();
        renderAdmin();
      }, 0);
    });
  }
  await loadCloudData();
  renderAll();
  resetOrderForm();
  route();
  const linkedProduct = new URLSearchParams(location.search).get("producto");
  if (linkedProduct && state.products.some(product => product.id === linkedProduct)) {
    location.hash = "catalogo";
    setTimeout(() => openDetails(linkedProduct), 120);
  }
}

init();
