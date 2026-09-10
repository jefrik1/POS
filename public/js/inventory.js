const apiBaseUrl = "/api";
let accessToken = localStorage.getItem("accessToken");

if (!accessToken) {
  location.href = "/login.html";
}

function getRoleAndOutlet() {
  try {
    var p = JSON.parse(
      decodeURIComponent(
        atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(""),
      ),
    );
    return { role: p.role, outletId: p.outletId ? String(p.outletId) : "" };
  } catch (_) {
    return { role: localStorage.getItem("userRole") || "", outletId: "" };
  }
}

function getSelectedOutletId() {
  var ro = getRoleAndOutlet();
  if (ro.role !== "super_admin" && ro.outletId) return ro.outletId;
  const sel = document.getElementById("outletSelect");
  if (sel && sel.value) return sel.value;
  if (ro.outletId) return String(ro.outletId);
  return "";
}

function outletQuery() {
  const oid = getSelectedOutletId();
  return oid ? "&outletId=" + encodeURIComponent(oid) : "";
}

function selectForAdjust(productId) {
  const sel = document.getElementById("adjustProduct");
  if (!sel) return;
  sel.value = String(productId);
  sel.style.outline = "2px solid #2980b9";
  setTimeout(function () {
    sel.style.outline = "";
  }, 900);
  const card = sel.closest(".card");
  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  else window.scrollTo(0, document.body.scrollHeight);
  const qty = document.getElementById("adjustQuantity");
  if (qty) qty.focus();
}

async function loadOutlets() {
  var ro = getRoleAndOutlet();
  var isAdmin = ro.role === "super_admin";
  try {
    if (!isAdmin && ro.outletId) {
      var sel0 = document.getElementById("outletSelect");
      if (sel0) {
        sel0.innerHTML =
          '<option value="' +
          ro.outletId +
          '">Cabang #' +
          ro.outletId +
          "</option>";
        sel0.value = ro.outletId;
        sel0.disabled = true;
        var wrap0 = document.getElementById("outletSwitcher");
        if (wrap0) wrap0.style.display = "none";
        var badge0 = document.getElementById("outletBadge");
        var badgeText0 = document.getElementById("outletBadgeText");
        if (badge0 && badgeText0) {
          badge0.style.display = "flex";
          fetch(apiBaseUrl + "/outlets", {
            headers: { Authorization: "Bearer " + accessToken },
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (d) {
              var list = d.outlets || [];
              var f = list.find(function (o) {
                return String(o.id) === String(ro.outletId);
              });
              if (f) badgeText0.textContent = f.name + " - " + (f.city || "");
              else badgeText0.textContent = "Cabang #" + ro.outletId;
              badgeText0.dataset.loaded = "1";
            })
            .catch(function () {
              badgeText0.textContent = "Cabang #" + ro.outletId;
            });
        }
      }
      return;
    }
    const res = await fetch(apiBaseUrl + "/outlets", {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!res.ok) return;
    const data = await res.json();
    const list = data.outlets || [];
    const sel = document.getElementById("outletSelect");
    if (!sel) return;
    const cur = sel.value;
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
    if (cur) sel.value = cur;
    else if (list[0]) sel.value = list[0].id;
  } catch (_) {}
}

async function loadInventory() {
  const search = document.getElementById("searchInventory")?.value || "";
  try {
    const q = "/inventory?search=" + encodeURIComponent(search) + outletQuery();
    const res = await fetch(apiBaseUrl + q, {
      headers: { Authorization: "Bearer " + accessToken },
    });

    if (res.ok) {
      const data = await res.json();
      const tbody = document.getElementById("inventoryTable");

      if (!data.inventory || data.inventory.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align:center;color:#888">Belum ada stok — tambah produk di Katalog, stok 0 otomatis dibuat per outlet.</td></tr>';
      } else {
        tbody.innerHTML = data.inventory
          .map(function (it) {
            const low = it.quantity <= it.minimumStock;
            const badge = low
              ? '<span class="badge warning">Menipis</span>'
              : '<span class="badge success">Aman</span>';
            return (
              "<tr" +
              (low ? ' class="low-stock"' : "") +
              ">" +
              "<td>" +
              it.sku +
              "</td>" +
              "<td>" +
              it.productName +
              "</td>" +
              "<td>" +
              it.quantity +
              "</td>" +
              "<td>" +
              it.minimumStock +
              "</td>" +
              "<td>" +
              badge +
              "</td>" +
              '<td data-allow="super_admin,manager"><button type="button" onclick="selectForAdjust(' +
              it.productId +
              ')">Sesuaikan</button></td>' +
              "</tr>"
            );
          })
          .join("");
      }

      const role = (function () {
        try {
          return JSON.parse(
            atob(
              accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
            ),
          ).role;
        } catch (_) {
          return localStorage.getItem("userRole");
        }
      })();

      document.querySelectorAll("[data-allow]").forEach(function (el) {
        const allow = (el.getAttribute("data-allow") || "").split(",");
        if (allow.indexOf(role) === -1) el.style.display = "none";
      });

      loadProducts();
    } else {
      const err = await res.json().catch(function () {
        return {};
      });
      document.getElementById("inventoryTable").innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:#c0392b">' +
        (err.error || "Gagal memuat") +
        "</td></tr>";
    }
  } catch (_) {
    document.getElementById("inventoryTable").innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:#c0392b">Gagal terhubung ke server</td></tr>';
  }
}

async function loadProducts() {
  try {
    const res = await fetch(apiBaseUrl + "/products", {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!res.ok) return;
    const data = await res.json();
    const sel = document.getElementById("adjustProduct");
    sel.innerHTML =
      '<option value="">Pilih produk…</option>' +
      data.products
        .map(function (p) {
          return (
            '<option value="' +
            p.id +
            '">' +
            p.name +
            " (" +
            p.sku +
            ")</option>"
          );
        })
        .join("");
  } catch (_) {}
}

async function loadLowStock() {
  try {
    const q = "/inventory/low-stock?" + outletQuery().replace(/^&/, "");
    const res = await fetch(apiBaseUrl + q, {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById("lowStockTable");
    if (!data.lowStockItems || data.lowStockItems.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#888">Tidak ada stok menipis 🎉</td></tr>';
    } else {
      tbody.innerHTML = data.lowStockItems
        .map(function (it) {
          return (
            "<tr><td>" +
            it.sku +
            "</td><td>" +
            it.name +
            "</td><td>" +
            it.currentQuantity +
            "</td><td>" +
            it.minimumStock +
            "</td><td>" +
            (it.minimumStock - it.currentQuantity) +
            "</td></tr>"
          );
        })
        .join("");
    }
  } catch (_) {}
}

async function adjustStock() {
  const pid = document.getElementById("adjustProduct")?.value;
  const type = document.getElementById("movementType")?.value;
  const qty = parseInt(document.getElementById("adjustQuantity")?.value);
  const notes = document.getElementById("adjustNotes")?.value || "";

  if (!pid || !qty) {
    showStockError(
      "Data belum lengkap",
      "Pilih produk & isi jumlah yang valid",
    );
    return;
  }

  const oid = getSelectedOutletId();
  if (!oid) {
    showStockError(
      "Cabang belum dipilih",
      "Pilih cabang terlebih dulu di atas",
    );
    return;
  }

  const change = type === "stock_out" || type === "damage" ? -qty : qty;

  try {
    const res = await fetch(apiBaseUrl + "/inventory/adjust", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify({
        outletId: parseInt(oid),
        productId: parseInt(pid),
        movementType: type,
        quantityChange: change,
        notes: notes,
      }),
    });

    if (res.ok) {
      var j = await res.json().catch(function () {
        return {};
      });
      var sel = document.getElementById("adjustProduct");
      var prodName = sel
        ? sel.options[sel.selectedIndex]?.textContent || "Produk"
        : "Produk";
      var outletName = (function () {
        var s = document.getElementById("outletSelect");
        return s ? s.options[s.selectedIndex]?.textContent || "" : "";
      })();
      var typeLabel =
        {
          stock_in: "Barang Masuk",
          stock_out: "Barang Keluar",
          adjustment: "Penyesuaian",
          damage: "Rusak",
          return: "Retur",
        }[type] || type;
      showStockSuccess({
        product: prodName,
        outlet: outletName,
        typeLabel: typeLabel,
        qty: qty,
        qtyChange: change,
        newQuantity: j.newQuantity,
      });
      document.getElementById("adjustQuantity").value = "";
      document.getElementById("adjustNotes").value = "";
      loadInventory();
      loadLowStock();
      loadStockLedger();
    } else {
      const err = await res.json().catch(function () {
        return { error: "Gagal" };
      });
      showStockError(
        "Gagal menyesuaikan",
        err.error || "Gagal menyesuaikan stok",
      );
    }
  } catch (_) {
    showStockError("Koneksi gagal", "Tidak dapat terhubung ke server");
  }
}

async function loadStockLedger() {
  const start = document.getElementById("ledgerStartDate")?.value;
  const end = document.getElementById("ledgerEndDate")?.value;
  try {
    let url = apiBaseUrl + "/inventory/stock-ledger";
    const params = new URLSearchParams();
    const oid = getSelectedOutletId();
    if (oid) params.append("outletId", oid);
    if (start) params.append("startDate", start);
    if (end) params.append("endDate", end);
    if (params.toString()) url += "?" + params.toString();

    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + accessToken },
    });
    if (!res.ok) return;

    const data = await res.json();
    const tbody = document.getElementById("ledgerTable");
    if (!data || data.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:#888">Belum ada pergerakan stok</td></tr>';
    } else {
      tbody.innerHTML = data
        .map(function (en) {
          return (
            "<tr><td>" +
            new Date(en.created_at).toLocaleString("id-ID") +
            "</td>" +
            "<td>" +
            en.sku +
            "</td>" +
            "<td>" +
            en.movement_type +
            "</td>" +
            "<td>" +
            (en.quantity_change > 0 ? "+" : "") +
            en.quantity_change +
            "</td>" +
            "<td>" +
            en.username +
            "</td>" +
            "<td>" +
            (en.notes || "-") +
            "</td></tr>"
          );
        })
        .join("");
    }
  } catch (_) {}
}

document
  .getElementById("logoutBtn")
  ?.addEventListener("click", async function () {
    try {
      await fetch(apiBaseUrl + "/auth/logout", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken },
      });
    } catch (_) {}
    localStorage.removeItem("accessToken");
    location.href = "/login.html";
  });

function showStockSuccess(o) {
  var title = document.getElementById("stockTitle");
  var sub = document.getElementById("stockSub");
  var detail = document.getElementById("stockDetail");
  var icon = document.getElementById("stockIcon");
  if (icon) {
    icon.textContent = "✓";
    icon.className = "stock-icon";
  }
  if (title) title.textContent = "Stok Berhasil Disesuaikan!";
  if (sub)
    sub.textContent =
      o.product +
      " • " +
      o.typeLabel +
      " " +
      (o.qtyChange > 0 ? "+" : "") +
      o.qtyChange +
      " — " +
      (o.outlet || "");
  if (detail)
    detail.innerHTML =
      '<div class="stock-row"><span>Produk</span><b>' +
      o.product +
      '</b></div><div class="stock-row"><span>Jenis</span><span>' +
      o.typeLabel +
      '</span></div><div class="stock-row"><span>Perubahan</span><b style="color:' +
      (o.qtyChange >= 0 ? "#16a34a" : "#e74c3c") +
      '">' +
      (o.qtyChange > 0 ? "+" : "") +
      o.qtyChange +
      "</b></div>" +
      (o.newQuantity != null
        ? '<div class="stock-row"><span>Stok sekarang</span><b>' +
          o.newQuantity +
          "</b></div>"
        : "") +
      '<div class="stock-row"><span>Cabang</span><span>' +
      (o.outlet || "-") +
      '</span></div><div class="stock-kembali">✨ Ledger tercatat — stok diperbarui</div>';
  var ov = document.getElementById("stockOverlay");
  if (ov) ov.classList.add("show");
  launchStockConfetti();
}
function showStockError(t, m) {
  var title = document.getElementById("stockTitle");
  var sub = document.getElementById("stockSub");
  var detail = document.getElementById("stockDetail");
  var icon = document.getElementById("stockIcon");
  if (icon) {
    icon.textContent = "✕";
    icon.className = "stock-icon err";
  }
  if (title) title.textContent = t;
  if (sub) sub.textContent = m;
  if (detail)
    detail.innerHTML =
      '<div style="text-align:center;color:#64748b;font-size:12px;padding:6px 0">' +
      m +
      "</div>";
  var ov = document.getElementById("stockOverlay");
  if (ov) ov.classList.add("show");
  setTimeout(function () {
    if (icon) {
      icon.textContent = "✓";
      icon.className = "stock-icon";
    }
  }, 2600);
}
function closeStockModal() {
  var o = document.getElementById("stockOverlay");
  if (o) o.classList.remove("show");
}
function launchStockConfetti() {
  var box = document.getElementById("stockModalBox");
  if (!box) return;
  var colors = ["#2980b9", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22"];
  for (var i = 0; i < 18; i++) {
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
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeStockModal();
});

(async function init() {
  await loadOutlets();
  loadInventory();
  loadLowStock();
  loadStockLedger();
  setInterval(loadLowStock, 60000);
})();
