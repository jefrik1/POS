class POSApp {
  constructor() {
    this.apiBaseUrl = "/api";
    this.accessToken = null;
    this.currentOutlet = { id: 1 };
    this.currentUser = null;
    this.cart = [];
    this.debounceTimer = null;
    this.lastReceipt = null;
    this.init();
  }
  async init() {
    this.accessToken = localStorage.getItem("accessToken");
    if (this.accessToken) {
      await this.loadUserData();
      this.setupEventListeners();
      await this.loadOutlets();
    } else {
      this.showLoginPage();
    }
  }
  setupEventListeners() {
    document.getElementById("productSearch")?.addEventListener("input", (e) => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(
        () => this.searchProducts(e.target.value),
        300,
      );
    });
    document
      .getElementById("barcodeInput")
      ?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.searchProductsByBarcode(e.target.value);
          e.target.value = "";
        }
      });
    document
      .getElementById("completeTransactionBtn")
      ?.addEventListener("click", () => this.completeTransaction());
    document
      .getElementById("logoutBtn")
      ?.addEventListener("click", () => this.logout());
    var sel = document.getElementById("outletSelect");
    if (sel) {
      sel.addEventListener("change", function (ev) {
        var v = parseInt(ev.target.value) || 1;
        posApp.currentOutlet = { id: v };
      });
    }
  }
  parseToken() {
    try {
      return JSON.parse(
        decodeURIComponent(
          atob(
            this.accessToken
              .split(".")[1]
              .replace(/-/g, "+")
              .replace(/_/g, "/"),
          )
            .split("")
            .map(function (c) {
              return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join(""),
        ),
      );
    } catch (e) {
      return {};
    }
  }
  async loadOutlets() {
    var sel = document.getElementById("outletSelect");
    var badge = document.getElementById("outletBadge");
    var badgeText = document.getElementById("outletBadgeText");
    var tk = this.parseToken();
    var isAdmin = tk.role === "super_admin";
    var myOutlet = tk.outletId ? String(tk.outletId) : "";
    if (!isAdmin) {
      if (myOutlet) this.currentOutlet = { id: parseInt(myOutlet) };
      if (sel) {
        var w = sel.closest("#outletSwitcher");
        if (w) w.style.display = "none";
        sel.disabled = true;
      }
      if (badge) badge.style.display = "flex";
      return;
    }
    if (!sel) return;
    try {
      var r = await fetch(this.apiBaseUrl + "/outlets", {
        headers: { Authorization: "Bearer " + this.accessToken },
      });
      if (!r.ok) return;
      var d = await r.json();
      var list = d.outlets || d || [];
      if (!Array.isArray(list) || list.length === 0) return;
      var saved = this.currentOutlet?.id
        ? String(this.currentOutlet.id)
        : sel.value || "";
      sel.innerHTML = list
        .map(function (o) {
          return (
            '<option value="' +
            o.id +
            '">' +
            o.name +
            " - " +
            (o.city || "") +
            "</option>"
          );
        })
        .join("");
      if (
        saved &&
        list.some(function (o) {
          return String(o.id) === saved;
        })
      )
        sel.value = saved;
      else if (sel.options.length) sel.value = sel.options[0].value;
      this.currentOutlet = { id: parseInt(sel.value) || list[0].id };
      if (badge) badge.style.display = "none";
    } catch (e) {}
  }
  async searchProducts(query) {
    if (!query) {
      this.displayProducts([]);
      return;
    }
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/products?search=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );
      if (response.ok) {
        const data = await response.json();
        this.displayProducts(data.products);
      } else if (response.status === 401) {
        this.showLoginPage();
      }
    } catch (error) {
      if (typeof offlineManager !== "undefined" && !offlineManager.isOnline()) {
        const cachedProducts = await offlineManager.getCachedProducts();
        const filtered = cachedProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.sku.includes(query),
        );
        this.displayProducts(filtered);
      }
    }
  }
  async searchProductsByBarcode(barcode) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/products?search=${encodeURIComponent(barcode)}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );
      if (response.ok) {
        const data = await response.json();
        if (data.products.length > 0) this.addProductToCart(data.products[0]);
      }
    } catch (error) {}
  }
  displayProducts(products) {
    const container = document.getElementById("productsList");
    if (!container) return;
    if (!products || products.length === 0) {
      container.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;color:#888;font-size:13px;padding:12px">Tidak ada produk ditemukan</div>';
      return;
    }
    container.innerHTML = products
      .map(
        (product) => `
      <div class="product-card">
        <div class="product-name">${product.name}</div>
        <div class="product-sku">${product.sku}</div>
        <div class="product-price">Rp ${product.basePrice.toLocaleString("id-ID")}</div>
        <button onclick="posApp.addProductToCart({id: ${product.id}, name: '${product.name.replace(/'/g, "\\'")}', basePrice: ${product.basePrice}, sku: '${product.sku}'})">+ Keranjang</button>
      </div>
    `,
      )
      .join("");
  }
  addProductToCart(product) {
    const existingItem = this.cart.find(
      (item) => item.productId === product.id,
    );
    if (existingItem) existingItem.quantity += 1;
    else
      this.cart.push({
        productId: product.id,
        name: product.name,
        unitPrice: product.basePrice,
        quantity: 1,
        discountPerItem: 0,
      });
    this.updateCartDisplay();
  }
  removeFromCart(productId) {
    this.cart = this.cart.filter((item) => item.productId !== productId);
    this.updateCartDisplay();
  }
  updateCartItemQuantity(productId, quantity) {
    const item = this.cart.find((item) => item.productId === productId);
    if (item) {
      item.quantity = Math.max(1, parseInt(quantity) || 1);
      this.updateCartDisplay();
    }
  }
  updateCartDisplay() {
    const cartTable = document.getElementById("cartItems");
    if (!cartTable) return;
    const subtotal = this.calculateSubtotal();
    const discount = this.calculateDiscount();
    const taxRate =
      parseFloat(document.getElementById("taxRate")?.value || 0) / 100;
    const tax = (subtotal - discount) * taxRate;
    const total = subtotal - discount + tax;
    if (this.cart.length === 0) {
      cartTable.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#888;font-size:12px">Keranjang kosong — cari produk di atas</td></tr>';
    } else {
      cartTable.innerHTML = this.cart
        .map(
          (item) => `
        <tr>
          <td>${item.name}</td>
          <td><input type="number" value="${item.quantity}" min="1" onchange="posApp.updateCartItemQuantity(${item.productId}, this.value)"></td>
          <td>Rp ${item.unitPrice.toLocaleString("id-ID")}</td>
          <td>Rp ${(item.quantity * item.unitPrice).toLocaleString("id-ID")}</td>
          <td><button class="danger" style="padding:5px 8px;font-size:11px" onclick="posApp.removeFromCart(${item.productId})">Hapus</button></td>
        </tr>
      `,
        )
        .join("");
    }
    if (document.getElementById("subtotal")) {
      document.getElementById("subtotal").textContent =
        "Rp " + subtotal.toLocaleString("id-ID");
      document.getElementById("discountAmount").textContent =
        "Rp " + discount.toLocaleString("id-ID");
      document.getElementById("taxAmount").textContent =
        "Rp " + tax.toLocaleString("id-ID");
      document.getElementById("totalAmount").textContent =
        "Rp " + total.toLocaleString("id-ID");
    }
  }
  calculateSubtotal() {
    return this.cart.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
  }
  calculateDiscount() {
    const discountType =
      document.getElementById("discountType")?.value || "nominal";
    const discountValue = parseFloat(
      document.getElementById("discountValue")?.value || 0,
    );
    const subtotal = this.calculateSubtotal();
    if (discountType === "percentage") return (subtotal * discountValue) / 100;
    return discountValue;
  }
  async completeTransaction() {
    if (this.cart.length === 0) {
      this.showPayError("Keranjang kosong", "Tambah produk terlebih dulu");
      return;
    }
    const discountType =
      document.getElementById("discountType")?.value || "nominal";
    const discountValue = parseFloat(
      document.getElementById("discountValue")?.value || 0,
    );
    const taxRate = parseFloat(document.getElementById("taxRate")?.value || 0);
    const paymentMethod =
      document.getElementById("paymentMethod")?.value || "cash";
    const paidAmount = parseFloat(
      document.getElementById("paidAmount")?.value || 0,
    );
    const subtotal = this.calculateSubtotal();
    const discount = this.calculateDiscount();
    const tax = (subtotal - discount) * (taxRate / 100);
    const total = subtotal - discount + tax;
    if (paidAmount < total) {
      this.showPayError(
        "Pembayaran kurang",
        "Jumlah bayar Rp " +
          paidAmount.toLocaleString("id-ID") +
          " kurang dari total Rp " +
          total.toLocaleString("id-ID"),
      );
      return;
    }
    const outletSel = document.getElementById("outletSelect");
    var outletId =
      this.currentOutlet?.id ||
      (outletSel ? parseInt(outletSel.value) : 1) ||
      1;
    const transactionData = {
      outletId: outletId,
      items: this.cart,
      discountType,
      discountValue,
      taxRate: taxRate / 100,
      paymentMethod,
      paidAmount,
    };
    var btn = document.getElementById("completeTransactionBtn");
    var oldText = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ Memproses…";
    }
    try {
      const response = await fetch(`${this.apiBaseUrl}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(transactionData),
      });
      if (response.ok) {
        const result = await response.json();
        var savedCart = [].concat(this.cart);
        this.cart = [];
        this.updateCartDisplay();
        document.getElementById("paidAmount").value = "";
        this.lastReceipt = { transaction: result, cart: savedCart };
        this.showPaySuccess(result, savedCart);
      } else {
        const err = await response.json().catch(function () {
          return { error: "Gagal" };
        });
        this.showPayError(
          "Transaksi gagal",
          err.error || "Gagal memproses transaksi",
        );
      }
    } catch (error) {
      if (typeof offlineManager !== "undefined" && !offlineManager.isOnline()) {
        await offlineManager.savePendingTransaction({ data: transactionData });
        this.cart = [];
        this.updateCartDisplay();
        this.showPaySuccess(
          {
            transactionNumber: "OFFLINE-" + Date.now(),
            subtotal,
            discount,
            taxAmount: tax,
            totalAmount: total,
            paidAmount,
            changeAmount: paidAmount - total,
          },
          [],
        );
        if ("serviceWorker" in navigator && "SyncManager" in window) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.sync.register("sync-transactions");
          });
        }
      } else
        this.showPayError("Koneksi gagal", "Tidak dapat terhubung ke server");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }
  showPaySuccess(transaction, savedCart) {
    var detail = document.getElementById("payDetail");
    var kembali = document.getElementById("payKembali");
    var title = document.getElementById("payTitle");
    var sub = document.getElementById("paySub");
    if (title) title.textContent = "Pembayaran Berhasil!";
    if (sub)
      sub.textContent =
        (transaction.transactionNumber || "TRX") +
        " • " +
        new Date().toLocaleString("id-ID");
    var pm = document.getElementById("paymentMethod")?.value || "cash";
    var pmLabel =
      { cash: "Tunai", card: "Kartu", transfer: "Transfer" }[pm] || pm;
    if (detail) {
      detail.innerHTML =
        '<div class="pay-row"><span>Items</span><b>' +
        savedCart.length +
        ' produk</b></div><div class="pay-row"><span>Subtotal</span><span>Rp ' +
        (transaction.subtotal || 0).toLocaleString("id-ID") +
        '</span></div><div class="pay-row"><span>Diskon</span><span>- Rp ' +
        (transaction.discount || 0).toLocaleString("id-ID") +
        '</span></div><div class="pay-row"><span>Pajak</span><span>Rp ' +
        (transaction.taxAmount || 0).toLocaleString("id-ID") +
        '</span></div><div class="pay-row total" style="border-top:1px solid #e2e8f0;margin-top:6px;padding-top:8px"><span><b>Total Bayar</b></span><b>Rp ' +
        (transaction.totalAmount || 0).toLocaleString("id-ID") +
        '</b></div><div class="pay-row"><span>Metode</span><span>' +
        pmLabel +
        '</span></div><div class="pay-row"><span>Dibayar</span><span>Rp ' +
        (transaction.paidAmount || 0).toLocaleString("id-ID") +
        "</span></div>";
    }
    if (kembali)
      kembali.innerHTML =
        "💰 Kembalian &nbsp; Rp " +
        (transaction.changeAmount || 0).toLocaleString("id-ID");
    var overlay = document.getElementById("payOverlay");
    if (overlay) overlay.classList.add("show");
    this.launchPayConfetti();
  }
  showPayError(title, msg) {
    var detail = document.getElementById("payDetail");
    var kembali = document.getElementById("payKembali");
    var t = document.getElementById("payTitle");
    var sub = document.getElementById("paySub");
    var icon = document.querySelector("#payModalBox .pay-icon");
    if (icon) {
      icon.textContent = "✕";
      icon.style.background = "linear-gradient(135deg,#e74c3c,#ff6b6b)";
    }
    if (t) t.textContent = title;
    if (sub) sub.textContent = msg;
    if (detail)
      detail.innerHTML =
        '<div style="text-align:center;color:#64748b;font-size:12px;padding:6px 0">' +
        msg +
        "</div>";
    if (kembali) kembali.style.display = "none";
    var overlay = document.getElementById("payOverlay");
    if (overlay) overlay.classList.add("show");
    setTimeout(() => {
      if (icon) {
        icon.textContent = "✓";
        icon.style.background = "linear-gradient(135deg,#27ae60,#2ecc71)";
      }
      if (kembali) kembali.style.display = "";
    }, 2600);
  }
  launchPayConfetti() {
    var box = document.getElementById("payModalBox");
    if (!box) return;
    var colors = [
      "#27ae60",
      "#2ecc71",
      "#f1c40f",
      "#3498db",
      "#9b59b6",
      "#e67e22",
    ];
    for (var i = 0; i < 20; i++) {
      var c = document.createElement("div");
      c.className = "confetti";
      c.style.left = Math.random() * 100 + "%";
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 0.35 + "s";
      c.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      box.appendChild(c);
      (function (el) {
        setTimeout(function () {
          if (el.parentNode) el.remove();
        }, 1350);
      })(c);
    }
  }
  printReceipt(transaction, savedCart) {
    var items = savedCart || this.cart;
    if (this.lastReceipt && !transaction) {
      transaction = this.lastReceipt.transaction;
      items = this.lastReceipt.cart;
    }
    if (!transaction) return;
    const receiptWindow = window.open("", "", "width=400,height=600");
    if (!receiptWindow) return;
    const receiptHTML = `
      <html><head><title>Struk</title><style>body{font-family:monospace;width:80mm;margin:0 auto;padding:12px} .header{text-align:center;margin-bottom:16px;border-bottom:1px dashed #000;padding-bottom:10px} .items{margin-bottom:14px} .item{display:flex;justify-content:space-between;font-size:12px;padding:3px 0} .total{border-top:1px solid;padding-top:8px;font-weight:bold} h3{margin:0 0 4px}</style></head>
        <body>
          <div class="header"><h3>STRUK PEMBAYARAN</h3><p style="font-size:11px">${transaction.transactionNumber || "TRX-" + Date.now()}</p><p style="font-size:11px">${new Date().toLocaleString("id-ID")}</p></div>
          <div class="items">${items.map((item) => `<div class="item"><span>${item.name} x${item.quantity}</span><span>Rp ${(item.quantity * item.unitPrice).toLocaleString("id-ID")}</span></div>`).join("")}</div>
          <div class="total">
            <div class="item"><span>Subtotal:</span><span>Rp ${(transaction.subtotal || 0).toLocaleString("id-ID")}</span></div>
            <div class="item"><span>Diskon:</span><span>Rp ${(transaction.discount || 0).toLocaleString("id-ID")}</span></div>
            <div class="item"><span>Pajak:</span><span>Rp ${(transaction.taxAmount || 0).toLocaleString("id-ID")}</span></div>
            <div class="item"><span>Total:</span><span>Rp ${(transaction.totalAmount || 0).toLocaleString("id-ID")}</span></div>
            <div class="item"><span>Bayar:</span><span>Rp ${(transaction.paidAmount || 0).toLocaleString("id-ID")}</span></div>
            <div class="item"><span>Kembali:</span><span>Rp ${(transaction.changeAmount || 0).toLocaleString("id-ID")}</span></div>
          </div>
          <p style="text-align:center;margin-top:12px;font-size:11px">Terima kasih telah berbelanja</p>
        </body></html>`;
    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
    setTimeout(function () {
      receiptWindow.print();
    }, 300);
  }
  async loadUserData() {
    try {
      var tok = this.accessToken;
      try {
        var p = JSON.parse(
          decodeURIComponent(
            atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
              .split("")
              .map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join(""),
          ),
        );
        if (p && p.outletId) this.currentOutlet = { id: p.outletId };
      } catch (e) {}
      var outletSel = document.getElementById("outletSelect");
      if (outletSel && this.currentOutlet.id)
        outletSel.value = String(this.currentOutlet.id);
    } catch (error) {}
  }
  async logout() {
    try {
      await fetch(`${this.apiBaseUrl}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
    } catch (error) {}
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userRole");
    localStorage.removeItem("user");
    localStorage.removeItem("username");
    this.showLoginPage();
  }
  showLoginPage() {
    window.location.href = "/login.html";
  }
}
const posApp = new POSApp();
function closePayModal() {
  var o = document.getElementById("payOverlay");
  if (o) o.classList.remove("show");
}
function reprintLastReceipt() {
  if (posApp && posApp.lastReceipt)
    posApp.printReceipt(
      posApp.lastReceipt.transaction,
      posApp.lastReceipt.cart,
    );
}
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closePayModal();
});
