const { Pool } = require('pg');

const passwords = ['postgres', '', 'password', 'admin', '123456'];

async function testConnection(password) {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'postgres',  // Connect to default db first
    user: 'postgres',
    password: password,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    console.log(`✓ SUCCESS with password: "${password}"`);
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.log(`✗ Failed with password: "${password}"`);
    await pool.end();
    return false;
  }
}

async function findPassword() {
  console.log('Testing PostgreSQL passwords...\n');
  for (const pwd of passwords) {
    const success = await testConnection(pwd);
    if (success) {
      console.log(`\nFound correct password: "${pwd}"`);
      process.exit(0);
    }
  }
  console.log('\nNone of the passwords worked. Check your PostgreSQL installation.');
  process.exit(1);
}

findPassword();
