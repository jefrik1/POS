#!/bin/bash

# POS System Setup Script

echo "Setting up POS System Database..."

# Database connection details
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-pos_db}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

# Create database if it doesn't exist
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -c "CREATE DATABASE $DB_NAME"

# Run schema
echo "Creating tables and indexes..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f src/config/schema.sql

# Create demo users
echo "Creating demo users..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF
INSERT INTO users (username, email, password_hash, role_id, outlet_id, is_active) VALUES
('admin', 'admin@pos.local', '\$2a\$10\$HASH_HERE', 1, NULL, true),
('manager', 'manager@pos.local', '\$2a\$10\$HASH_HERE', 2, 1, true),
('cashier', 'cashier@pos.local', '\$2a\$10\$HASH_HERE', 3, 1, true);

INSERT INTO outlets (name, address, city, phone, is_active) VALUES
('Outlet Pusat', 'Jl. Merdeka No. 1', 'Jakarta', '021-123456', true),
('Outlet Cabang', 'Jl. Sudirman No. 2', 'Bandung', '022-789012', true);

INSERT INTO categories (name, description) VALUES
('Elektronik', 'Produk elektronik dan gadget'),
('Pakaian', 'Berbagai jenis pakaian'),
('Makanan', 'Produk makanan dan minuman'),
('Lainnya', 'Kategori lainnya');
EOF

echo "Database setup completed!"
