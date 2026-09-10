const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'pos_db',
  user: 'postgres',
  password: '',  // Try empty password
});

async function setupDemoData() {
  const client = await pool.connect();
  try {
    console.log('Setting up demo data...');

    // Hash password "password123"
    const passwordHash = await bcrypt.hash('password123', 10);
    console.log('Password hash:', passwordHash);

    // Check if outlet exists
    const outletCheck = await client.query('SELECT id FROM outlets LIMIT 1');
    let outletId = null;

    if (outletCheck.rows.length === 0) {
      console.log('Creating outlet...');
      const outletResult = await client.query(
        'INSERT INTO outlets (name, city) VALUES ($1, $2) RETURNING id',
        ['Outlet Pusat', 'Jakarta']
      );
      outletId = outletResult.rows[0].id;
    } else {
      outletId = outletCheck.rows[0].id;
    }

    // Check if categories exist
    const categoryCheck = await client.query('SELECT id FROM categories LIMIT 1');
    if (categoryCheck.rows.length === 0) {
      console.log('Creating categories...');
      await client.query(
        'INSERT INTO categories (name) VALUES ($1), ($2), ($3)',
        ['Elektronik', 'Pakaian', 'Makanan']
      );
    }

    // Check if users exist
    const userCheck = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (userCheck.rows.length === 0) {
      console.log('Creating demo users...');
      
      await client.query(
        `INSERT INTO users (username, email, password_hash, role_id, outlet_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['admin', 'admin@pos.local', passwordHash, 1, null]
      );

      await client.query(
        `INSERT INTO users (username, email, password_hash, role_id, outlet_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['manager', 'manager@pos.local', passwordHash, 2, outletId]
      );

      await client.query(
        `INSERT INTO users (username, email, password_hash, role_id, outlet_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        ['cashier', 'cashier@pos.local', passwordHash, 3, outletId]
      );

      console.log('✓ Demo users created successfully!');
    } else {
      console.log('✓ Demo users already exist');
    }

    // Verify users
    const users = await client.query(
      'SELECT id, username, role_id FROM users ORDER BY username'
    );
    console.log('\nUsers in database:');
    users.rows.forEach(u => {
      console.log(`  - ${u.username} (role_id: ${u.role_id})`);
    });

    console.log('\n✓ Demo data setup complete!');
    console.log('\nYou can now login with:');
    console.log('  Username: admin');
    console.log('  Password: password123');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

setupDemoData();
