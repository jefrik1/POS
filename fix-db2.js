require('dotenv').config();
const {Pool}=require('pg');
const pool=new Pool({host:process.env.DB_HOST,port:parseInt(process.env.DB_PORT||'5432'),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
async function q(sql,params){const c=await pool.connect();try{return await c.query(sql,params)}finally{c.release()}}
async function run(){
  console.log('1. hapus duplikat inventory');
  let r=await q("DELETE FROM inventory WHERE id NOT IN (SELECT MIN(id) FROM inventory GROUP BY outlet_id, product_id, COALESCE(variant_id,-1)) RETURNING id");
  console.log('deleted',r.rowCount,'rows');
  r=await q("SELECT outlet_id,product_id,COALESCE(variant_id,-1) as vid,COUNT(*) FROM inventory GROUP BY outlet_id,product_id,COALESCE(variant_id,-1) HAVING COUNT(*)>1");
  console.log('remaining dup groups',r.rows.length);

  console.log('2. perbaiki constraint unique COALESCE');
  const idx=await q("SELECT indexname,indexdef FROM pg_indexes WHERE tablename='inventory'");
  console.log(idx.rows.map(x=>x.indexname+':'+x.indexdef).join('\n'));
  const hasCoalesce=idx.rows.some(x=>x.indexdef.includes('COALESCE'));
  if(!hasCoalesce){
    const cons=await q("SELECT conname FROM pg_constraint WHERE conrelid='inventory'::regclass AND contype='u'");
    console.log('unique constraints',cons.rows);
    for(const c of cons.rows){
      if(c.conname.includes('product_id_variant')){
        try{await q(`ALTER TABLE inventory DROP CONSTRAINT ${c.conname}`);console.log('dropped constraint',c.conname)}catch(e){console.log('drop constraint fail',e.message)}
      }
    }
    try{await q("DROP INDEX IF EXISTS uniq_inventory_outlet_product_variant")}catch(e){}
    try{await q("DROP INDEX IF EXISTS inventory_outlet_id_product_id_variant_id_key")}catch(e){}
    await q("CREATE UNIQUE INDEX uniq_inventory_outlet_product_variant ON inventory (outlet_id, product_id, COALESCE(variant_id, -1))");
    console.log('created uniq_inventory_outlet_product_variant');
  }else console.log('coalesce index already exists');

  console.log('3. cek & seed users');
  let users=await q("SELECT id,username,role_id,outlet_id FROM users ORDER BY id");
  console.log('users',users.rows);
  if(users.rows.length===0){
    const bcrypt=require('bcryptjs');
    const hash=await bcrypt.hash('password123',10);
    const roles=await q("SELECT id FROM roles ORDER BY id");
    if(roles.rows.length===0){
      await q("INSERT INTO roles (id,name,description) VALUES (1,'super_admin','Super'),(2,'manager','Manager'),(3,'cashier','Cashier') ON CONFLICT DO NOTHING");
      await q("SELECT setval('roles_id_seq',(SELECT MAX(id) FROM roles))");
      console.log('roles seeded');
    }
    const outs=await q("SELECT id FROM outlets ORDER BY id LIMIT 1");
    let outletId=outs.rows[0]?.id;
    if(!outletId){const rr=await q("INSERT INTO outlets (name,city) VALUES ('Outlet Pusat','Jakarta') RETURNING id");outletId=rr.rows[0].id}
    await q("INSERT INTO users (username,email,password_hash,role_id,outlet_id) VALUES ($1,$2,$3,$4,$5)",['admin','admin@pos.local',hash,1,null]);
    await q("INSERT INTO users (username,email,password_hash,role_id,outlet_id) VALUES ($1,$2,$3,$4,$5)",['manager','manager@pos.local',hash,2,outletId]);
    await q("INSERT INTO users (username,email,password_hash,role_id,outlet_id) VALUES ($1,$2,$3,$4,$5)",['cashier','cashier@pos.local',hash,3,outletId]);
    console.log('users seeded');
    users=await q("SELECT id,username,role_id,outlet_id FROM users ORDER BY id");
    console.log('users after',users.rows);
  }

  console.log('4. pastikan inventory untuk semua outlet/produk');
  const outs=await q("SELECT id FROM outlets WHERE is_active=true");
  const prods=await q("SELECT id FROM products WHERE is_active=true");
  console.log('outlets',outs.rows.map(r=>r.id),'products',prods.rows.map(r=>r.id));
  for(const o of outs.rows){for(const p of prods.rows){
    await q("INSERT INTO inventory (outlet_id,product_id,variant_id,quantity,minimum_stock) VALUES ($1,$2,NULL,0,10) ON CONFLICT DO NOTHING",[o.id,p.id]);
  }}
  const inv=await q("SELECT outlet_id,product_id,quantity FROM inventory ORDER BY outlet_id,product_id");
  console.log('inventory now',inv.rows.map(r=>`o${r.outlet_id}-p${r.product_id}:${r.quantity}`).join(' | '));
  console.log('done');
  await pool.end();
}
run().catch(e=>{console.error(e);pool.end()});
