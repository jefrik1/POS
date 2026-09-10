function parseJwt(t) {
  try {
    var b = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(
      decodeURIComponent(
        atob(b)
          .split("")
          .map(function (c) {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(""),
      ),
    );
  } catch (e) {
    return null;
  }
}
function getRole() {
  var tok = localStorage.getItem("accessToken");
  if (!tok) return null;
  var p = parseJwt(tok);
  if (p && p.role) return { role: p.role, outletId: p.outletId, payload: p };
  try {
    var u = JSON.parse(localStorage.getItem("user") || "null");
    if (u && u.role) return { role: u.role, outletId: u.outletId };
  } catch (e) {}
  var r = localStorage.getItem("userRole");
  if (r) return { role: r, outletId: null };
  return { role: "cashier", outletId: 1 };
}
var ROLE_LABEL = {
  super_admin: "Super Admin",
  manager: "Manajer Outlet",
  cashier: "Kasir",
};
var ROLE_CONFIG = {
  "admin.html": ["super_admin"],
  "inventory.html": ["super_admin", "manager"],
  "products.html": ["super_admin", "manager"],
  "reports.html": ["super_admin", "manager"],
  "index.html": ["cashier"],
  "cashier.html": ["cashier"],
};
function applyRoleNav() {
  var info = getRole();
  if (!info) {
    if (!location.pathname.endsWith("login.html"))
      location.href = "/login.html";
    return;
  }
  var role = info.role;
  var label = ROLE_LABEL[role] || role;
  var badge = document.getElementById("roleBadge");
  if (badge) {
    badge.textContent = label;
    badge.className = "role-badge role-" + role;
  }
  var disp = document.getElementById("userDisplay");
  if (disp) {
    disp.textContent =
      localStorage.getItem("username") || info.payload?.userId
        ? role === "super_admin"
          ? "Pemilik"
          : role === "manager"
            ? "Manajer"
            : "Kasir"
        : label;
  }
  document.querySelectorAll("[data-allow]").forEach(function (el) {
    var allow = (el.getAttribute("data-allow") || "")
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    if (allow.length && allow.indexOf(role) === -1) el.style.display = "none";
    else el.style.display = "";
  });
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!page) page = "index.html";
  if (page === "") page = "index.html";
  var allowed = ROLE_CONFIG[page];
  if (allowed && allowed.indexOf(role) === -1) {
    var guard = document.getElementById("guardMsg");
    var target =
      role === "super_admin"
        ? "/admin.html"
        : role === "manager"
          ? "/products.html"
          : "/index.html";
    if (guard) {
      guard.style.display = "block";
      guard.textContent =
        "Akses ditolak untuk peran " + label + ". Mengalihkan…";
    }
    setTimeout(function () {
      if (location.pathname.toLowerCase().indexOf(target) === -1)
        location.href = target;
    }, 900);
    return;
  }
  var outletWrap = document.getElementById("outletSwitcher");
  var outletBadge = document.getElementById("outletBadge");
  var outletBadgeText = document.getElementById("outletBadgeText");
  if (outletWrap) {
    if (role === "super_admin") {
      outletWrap.style.display = "flex";
      if (outletBadge) outletBadge.style.display = "none";
    } else {
      outletWrap.style.display = "none";
      if (outletBadge) {
        outletBadge.style.display = "flex";
        if (outletBadgeText && !outletBadgeText.dataset.loaded) {
          outletBadgeText.textContent = info.outletId
            ? "Cabang #" + info.outletId
            : "Cabang terikat akun";
        }
        if (info.outletId) {
          var __tok = localStorage.getItem("accessToken");
          if (__tok && outletBadgeText) {
            fetch("/api/outlets", {
              headers: { Authorization: "Bearer " + __tok },
            })
              .then(function (r) {
                return r.json();
              })
              .then(function (d) {
                var list = d.outlets || d || [];
                var found = list.find(function (o) {
                  return String(o.id) === String(info.outletId);
                });
                if (found && outletBadgeText) {
                  outletBadgeText.textContent =
                    found.name + " - " + (found.city || "");
                  outletBadgeText.dataset.loaded = "1";
                }
              })
              .catch(function () {});
          }
        }
      }
    }
  } else if (outletBadge) {
    if (role !== "super_admin" && info.outletId) {
      outletBadge.style.display = "flex";
      if (outletBadgeText && !outletBadgeText.dataset.loaded) {
        outletBadgeText.textContent = "Cabang #" + info.outletId;
      }
    } else outletBadge.style.display = "none";
  }
  var restrictMsg = document.getElementById("restrictInfo");
  if (restrictMsg && role === "cashier") {
    var path = location.pathname;
    if (
      path.indexOf("products.html") > -1 ||
      path.indexOf("reports.html") > -1
    ) {
      restrictMsg.style.display = "block";
    }
  }
}
document.addEventListener("DOMContentLoaded", applyRoleNav);
function logout() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("user");
  localStorage.removeItem("username");
  fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + (localStorage.getItem("accessToken") || ""),
    },
  }).catch(function () {});
  location.href = "/login.html";
}
