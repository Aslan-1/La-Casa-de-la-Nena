// ---------- CARGAR PRODUCTOS DESDE GOOGLE SHEETS ----------
let productsData = [];
let cart = [];

// ⚠️ ACTUALIZA ESTA URL CON LA DE TU HOJA PUBLICADA COMO CSV
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1IzqBdZaZ5pv51T0NotqZ5xacneLPj6ndK0-j3gJhqY55nqf0PMZgMylr7eU_TD7Pz_tn0QGAJCG3/pub?output=csv';

// ---------- TOAST NOTIFICATION ----------
function showToast(message) {
  let toast = document.querySelector('.toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// ---------- PARSEAR CSV DE FORMA ROBUSTA ----------
function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return [];
  
  // Obtener encabezados (primera línea)
  const headers = [];
  let inQuote = false;
  let current = '';
  for (let ch of lines[0]) {
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      headers.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  headers.push(current.trim());
  
  const result = [];
  
  // Procesar cada línea de datos
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    
    const valores = [];
    let currentVal = '';
    let inQuotes = false;
    
    for (let ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        valores.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += ch;
      }
    }
    valores.push(currentVal.trim());
    
    // Si la cantidad de valores es menor que headers, rellenar con ''
    while (valores.length < headers.length) valores.push('');
    
    let obj = {};
    headers.forEach((header, idx) => {
      let val = valores[idx] || '';
      // Limpiar posibles comillas sobrantes
      val = val.replace(/^"|"$/g, '').trim();
      if (header === 'id' || header === 'precio' || header === 'stock' || header === 'orden') {
        val = parseInt(val) || 0;
      }
      obj[header] = val;
    });
    result.push(obj);
  }
  return result;
}

// ---------- CARGAR PRODUCTOS ----------
async function cargarProductosDesdeSheet() {
  try {
    showToast("🔄 Cargando productos...");
    const response = await fetch(CSV_URL);
    const csvText = await response.text();
    
    console.log("CSV recibido (primeros 200 caracteres):", csvText.substring(0, 200));
    
    const productos = parseCSV(csvText);
    console.log(`Total productos leídos desde CSV: ${productos.length}`);
    
    if (productos.length === 0) {
      showToast("⚠️ No se encontraron productos. Revisa la hoja de cálculo.");
      productsData = [];
      renderProductCatalog();
      return;
    }
    
    // Ordenar por 'orden' si existe
    productos.sort((a,b) => (a.orden || 999) - (b.orden || 999));
    
    // ---- FILTRO POR COLUMNA "mostrar" (SI/NO) ----
    const tieneColumnaMostrar = productos.some(p => p.hasOwnProperty('mostrar'));
    let productosFiltrados = productos;
    
    if (tieneColumnaMostrar) {
      productosFiltrados = productos.filter(p => {
        const valorMostrar = (p.mostrar || '').toString().trim().toUpperCase();
        return valorMostrar === 'SI';
      });
      console.log(`Productos con mostrar=SI: ${productosFiltrados.length}`);
      
      if (productosFiltrados.length === 0) {
        console.warn('No hay productos con mostrar=SI. Mostrando todos.');
        productosFiltrados = productos;
      }
    } else {
      console.log('Columna "mostrar" no encontrada. Mostrando todos los productos.');
    }
    
    // Convertir a formato del carrito
    productsData = productosFiltrados.map(p => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      img: p.img,
      disponible: (p.stock > 0),
      stock: p.stock
    }));
    
    console.log(`Productos finales en catálogo: ${productsData.length}`);
    
    if (productsData.length === 0) {
      showToast("⚠️ No hay productos para mostrar. Verifica la columna 'mostrar'.");
    } else {
      showToast(`✅ ${productsData.length} productos cargados`);
    }
    
    renderProductCatalog();
    actualizarInterfazCarrito();
    
  } catch (error) {
    console.error('Error cargando productos:', error);
    showToast('⚠️ Error al cargar productos. Recarga la página.');
    productsData = [];
    renderProductCatalog();
  }
}

// ---------- RENDERIZAR CATÁLOGO ----------
function renderProductCatalog() {
  const gridContainer = document.getElementById("productGrid");
  if (!gridContainer) return;
  
  if (productsData.length === 0) {
    gridContainer.innerHTML = '<p style="text-align:center; color:#aaa;">🛒 No hay productos disponibles en este momento.</p>';
    return;
  }
  
  gridContainer.innerHTML = "";
  productsData.forEach(prod => {
    const card = document.createElement("div");
    card.className = "product-card";
    if (!prod.disponible) card.classList.add("agotado");
    
    const estadoLabel = prod.disponible 
      ? '<span class="stock-badge disponible">Disponible</span>' 
      : '<span class="stock-badge agotado">Agotado</span>';
    
    const buttonHTML = prod.disponible
      ? `<button class="btn-add" data-id="${prod.id}" data-nombre="${prod.nombre}" data-precio="${prod.precio}">Añadir al carrito</button>`
      : `<button class="btn-add disabled" disabled>No disponible</button>`;
    
    card.innerHTML = `
      <div class="product-img">
        <img src="${prod.img}" alt="${prod.nombre}" loading="lazy">
        ${estadoLabel}
      </div>
      <div class="product-info">
        <h3>${prod.nombre}</h3>
        <div class="price">$${prod.precio}</div>
        ${buttonHTML}
      </div>
    `;
    gridContainer.appendChild(card);
  });
  
  document.querySelectorAll('.btn-add:not(.disabled)').forEach(btn => {
    btn.removeEventListener('click', handleAddToCart);
    btn.addEventListener('click', handleAddToCart);
  });
}

function handleAddToCart(e) {
  const btn = e.currentTarget;
  const id = parseInt(btn.dataset.id);
  const nombre = btn.dataset.nombre;
  const precio = parseInt(btn.dataset.precio);
  agregarProducto(id, nombre, precio);
}

// ---------- FUNCIONES DEL CARRITO (sin cambios) ----------
function agregarProducto(id, nombre, precio) {
  const existente = cart.find(item => item.id === id);
  if (existente) {
    existente.cantidad += 1;
    showToast(`📦 +1 ${nombre} (ahora ${existente.cantidad})`);
  } else {
    cart.push({ id, nombre, precio, cantidad: 1 });
    showToast(`✨ ${nombre} añadido al carrito`);
  }
  actualizarInterfazCarrito();
}

function eliminarProducto(id) {
  const productoEliminado = cart.find(item => item.id === id);
  cart = cart.filter(item => item.id !== id);
  if (productoEliminado) showToast(`🗑️ ${productoEliminado.nombre} eliminado`);
  actualizarInterfazCarrito();
}

function cambiarCantidad(id, delta) {
  const item = cart.find(item => item.id === id);
  if (item) {
    const nuevaCant = item.cantidad + delta;
    if (nuevaCant <= 0) {
      eliminarProducto(id);
    } else {
      item.cantidad = nuevaCant;
      showToast(`🔄 ${item.nombre} cantidad: ${item.cantidad}`);
      actualizarInterfazCarrito();
    }
  }
}

function vaciarCarrito() {
  if (cart.length > 0) {
    cart = [];
    showToast("🧹 Carrito vaciado");
    actualizarInterfazCarrito();
  } else {
    showToast("El carrito ya está vacío");
  }
}

function actualizarInterfazCarrito() {
  const cartContainer = document.getElementById("cartListDynamic");
  const totalSpan = document.getElementById("cartTotalAmount");
  const badge = document.getElementById("cartCountBadge");
  if (!cartContainer) return;
  
  let total = 0;
  let totalItems = 0;
  cartContainer.innerHTML = "";
  
  if (cart.length === 0) {
    cartContainer.innerHTML = '<p style="text-align:center; color:#aaa;">🛒 Tu carrito está vacío. Agrega productos del catálogo.</p>';
  } else {
    cart.forEach(item => {
      total += item.precio * item.cantidad;
      totalItems += item.cantidad;
      const itemDiv = document.createElement("div");
      itemDiv.className = "cart-item";
      itemDiv.innerHTML = `
        <div class="cart-item-info">
          <h4>${item.nombre}</h4>
          <small>$${item.precio} c/u</small>
        </div>
        <div class="cart-item-controls">
          <button class="qty-minus" data-id="${item.id}">-</button>
          <span style="min-width: 30px; text-align:center;">${item.cantidad}</span>
          <button class="qty-plus" data-id="${item.id}">+</button>
          <button class="remove-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
        </div>
        <div><strong>$${item.precio * item.cantidad}</strong></div>
      `;
      cartContainer.appendChild(itemDiv);
    });
  }
  
  totalSpan.innerText = total;
  if (badge) badge.innerText = totalItems;
  
  document.querySelectorAll('.qty-minus').forEach(btn => {
    btn.removeEventListener('click', handleMinus);
    btn.addEventListener('click', handleMinus);
  });
  document.querySelectorAll('.qty-plus').forEach(btn => {
    btn.removeEventListener('click', handlePlus);
    btn.addEventListener('click', handlePlus);
  });
  document.querySelectorAll('.remove-item').forEach(btn => {
    btn.removeEventListener('click', handleRemove);
    btn.addEventListener('click', handleRemove);
  });
}

function handleMinus(e) {
  const id = parseInt(e.currentTarget.dataset.id);
  cambiarCantidad(id, -1);
}
function handlePlus(e) {
  const id = parseInt(e.currentTarget.dataset.id);
  cambiarCantidad(id, 1);
}
function handleRemove(e) {
  const id = parseInt(e.currentTarget.dataset.id);
  eliminarProducto(id);
}

// ---------- ENVIAR PEDIDO POR WHATSAPP ----------
function enviarPedidoWhatsapp() {
  const nombre = document.getElementById("nombre")?.value.trim();
  const telefono = document.getElementById("telefono")?.value.trim();
  const direccion = document.getElementById("direccion")?.value.trim();
  const notas = document.getElementById("notas")?.value.trim() || "Sin notas adicionales";
  
  if (!nombre || !telefono || !direccion) {
    alert("Por favor completa nombre, teléfono y dirección antes de enviar.");
    return;
  }
  if (cart.length === 0) {
    alert("Tu carrito está vacío. Agrega productos para realizar el pedido.");
    return;
  }
  
  const pedidoID = Math.floor(Math.random() * 10000);
  const fecha = new Date().toLocaleString();
  let mensaje = `🧾 *PEDIDO LA NENA* #${pedidoID}\n🕒 ${fecha}\n👤 ${nombre}\n📞 ${telefono}\n📍 ${direccion}\n\n🛒 *PRODUCTOS:*\n`;
  let total = 0;
  
  cart.forEach(p => {
    mensaje += `• ${p.nombre} x${p.cantidad} = $${p.precio * p.cantidad}\n`;
    total += p.precio * p.cantidad;
  });
  
  mensaje += `\n💰 *TOTAL: $${total}*\n💬 Notas: ${notas}\n\n¡Gracias por elegir La Casa de Nena! 🍖🥩✨`;
  const url = "https://wa.me/51559319?text=" + encodeURIComponent(mensaje);
  window.open(url, "_blank");
}

// ---------- SCROLL AL CARRITO ----------
function scrollToCart() {
  const pedidoSection = document.getElementById("pedido");
  if (pedidoSection) pedidoSection.scrollIntoView({ behavior: "smooth" });
}

// ---------- ANIMACIONES FADE-IN ----------
const faders = document.querySelectorAll('.fade-in');
const appearOptions = { threshold: 0.2 };
const appearOnScroll = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      appearOnScroll.unobserve(entry.target);
    }
  });
}, appearOptions);
faders.forEach(el => appearOnScroll.observe(el));

// ---------- INICIALIZACIÓN ----------
document.addEventListener("DOMContentLoaded", () => {
  cargarProductosDesdeSheet();
  
  const clearBtn = document.getElementById("clearCartBtn");
  if (clearBtn) clearBtn.addEventListener("click", vaciarCarrito);
  
  const whatsappBtn = document.getElementById("enviarWhatsappBtn");
  if (whatsappBtn) whatsappBtn.addEventListener("click", enviarPedidoWhatsapp);
  
  const scrollBtn = document.getElementById("scrollToCartBtn");
  if (scrollBtn) scrollBtn.addEventListener("click", scrollToCart);
  
  setTimeout(() => {
    faders.forEach(el => {
      if (el.getBoundingClientRect().top < window.innerHeight - 100) {
        el.classList.add('visible');
      }
    });
  }, 200);
});
