import express, { Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import jwt from "jsonwebtoken";
import routes from "./routes";
import { AuthRequest } from "./middleware/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CORS_ORIGIN
        : "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "../public")));

// Mock API untuk development (saat database tidak tersedia)
const mockUsers: any = {
  admin: {
    id: 1,
    username: "admin",
    email: "admin@pos.local",
    role: "super_admin",
    outletId: null,
  },
  manager: {
    id: 2,
    username: "manager",
    email: "manager@pos.local",
    role: "manager",
    outletId: 1,
  },
  cashier: {
    id: 3,
    username: "cashier",
    email: "cashier@pos.local",
    role: "cashier",
    outletId: 1,
  },
};

app.post("/api/auth/login-mock", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  let user: any = (mockUsers as any)[username];
  if (!user) {
    try { const { mockUsers: dyn, mockOutlets: _o } = await import("./utils/mockStore"); const bcrypt = await import("bcryptjs");
      const found = (dyn as any[]).find((u: any) => u.username === username);
      if (found) { const ok = await bcrypt.compare(password, found.password_hash); if (!ok) return res.status(401).json({ error: "Invalid credentials" }); user = { id: found.id, username: found.username, role: found.role, outletId: found.outlet_id }; }
      else return res.status(401).json({ error: "Invalid credentials" });
    } catch { return res.status(401).json({ error: "Invalid credentials" }); }
  } else {
    if (password !== "password123") return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      outletId: user.outletId,
    },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "15m" },
  );

  res.cookie("refreshToken", "mock_refresh", {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
  });

  res.json({
    accessToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      outletId: user.outletId,
    },
  });
});

app.get("/api/products-mock", (req: AuthRequest, res: Response) => {
  const mockProducts = [
    {
      id: 1,
      sku: "PROD001",
      name: "Laptop",
      basePrice: 7500000,
      costPrice: 6000000,
    },
    {
      id: 2,
      sku: "PROD002",
      name: "Mouse",
      basePrice: 250000,
      costPrice: 150000,
    },
    {
      id: 3,
      sku: "PROD003",
      name: "Keyboard",
      basePrice: 800000,
      costPrice: 500000,
    },
  ];
  res.json({ products: mockProducts, total: 3 });
});

// Mock transactions
app.post("/api/transactions-mock", (req: AuthRequest, res: Response) => {
  const { items, discountValue, taxRate, paidAmount } = req.body;
  let subtotal = 0;
  items.forEach((item: any) => {
    subtotal += item.unitPrice * item.quantity;
  });
  const discount = discountValue || 0;
  const tax = (subtotal - discount) * (taxRate || 0);
  const total = subtotal - discount + tax;
  res.json({
    transactionId: Math.floor(Math.random() * 100000),
    transactionNumber: "TRX-" + Date.now(),
    subtotal: subtotal / 100,
    discount: discount / 100,
    taxAmount: tax / 100,
    totalAmount: total / 100,
    changeAmount: (paidAmount - total) / 100,
  });
});

console.log("✓ Mock API loaded for development");

app.use("/api", routes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});

app.get("/cashier", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/cashier.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/inventory", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/inventory.html"));
});

app.get("/reports", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/reports.html"));
});

app.get("/products", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/products.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(err.status || 500).json({
      error: err.message || "Internal server error",
    });
  },
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
