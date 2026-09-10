"use strict";
// Mock authentication untuk testing tanpa database
const mockUsers = {
    admin: {
        id: 1,
        username: 'admin',
        email: 'admin@pos.local',
        role: 'super_admin',
        outletId: null,
    },
    manager: {
        id: 2,
        username: 'manager',
        email: 'manager@pos.local',
        role: 'manager',
        outletId: 1,
    },
    cashier: {
        id: 3,
        username: 'cashier',
        email: 'cashier@pos.local',
        role: 'cashier',
        outletId: 1,
    },
};
const mockTokens = {};
// Generate fake token
function generateToken(user) {
    const token = 'mock_' + Math.random().toString(36).substr(2) + '_' + Date.now();
    mockTokens[token] = {
        userId: user.id,
        role: user.role,
        outletId: user.outletId,
        createdAt: Date.now(),
    };
    return token;
}
// Mock login endpoint
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    if (password !== 'password123') {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = mockUsers[username];
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const accessToken = generateToken(user);
    res.cookie('refreshToken', 'mock_refresh_token', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
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
// Mock products endpoint
app.get('/api/products', (req, res) => {
    const mockProducts = [
        {
            id: 1,
            sku: 'PROD001',
            name: 'Laptop Dell',
            basePrice: 7500000,
            costPrice: 6000000,
            category_id: 1,
        },
        {
            id: 2,
            sku: 'PROD002',
            name: 'Mouse Logitech',
            basePrice: 250000,
            costPrice: 150000,
            category_id: 1,
        },
        {
            id: 3,
            sku: 'PROD003',
            name: 'Keyboard Mechanical',
            basePrice: 800000,
            costPrice: 500000,
            category_id: 1,
        },
    ];
    res.json({
        products: mockProducts,
        total: mockProducts.length,
    });
});
// Mock transaction endpoint
app.post('/api/transactions', (req, res) => {
    const { items, discountValue, taxRate, paymentMethod, paidAmount } = req.body;
    let subtotal = 0;
    items.forEach(item => {
        subtotal += item.unitPrice * item.quantity;
    });
    const discount = discountValue || 0;
    const tax = (subtotal - discount) * (taxRate || 0);
    const total = subtotal - discount + tax;
    const change = paidAmount - total;
    res.status(201).json({
        transactionId: Math.floor(Math.random() * 100000),
        transactionNumber: 'TRX-' + Date.now(),
        subtotal: subtotal / 100,
        discount: discount / 100,
        taxAmount: tax / 100,
        totalAmount: total / 100,
        changeAmount: change / 100,
    });
});
console.log('✓ Mock API endpoints loaded for development');
//# sourceMappingURL=mock-api.js.map