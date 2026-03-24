/**
 * Demo öğretmenlerin şifrelerini Demo123! olarak günceller.
 */
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function main() {
  const hash = await bcrypt.hash('Demo123!', 10);
  console.log('Hash:', hash);
  
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    database: 'ogretmenpro',
    user: 'postgres',
    password: 'postgres',
  });
  await client.connect();
  
  const res = await client.query(
    "UPDATE users SET password_hash = $1 WHERE role = 'teacher' AND school_id = '71b0646e-7f6a-469a-9039-b831f109c2b3' RETURNING email",
    [hash]
  );
  console.log('Updated:', res.rows.map(r => r.email).join(', '));
  await client.end();
}

main().catch(console.error);
