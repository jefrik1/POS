const {Pool}=require('pg');
require('dotenv').config({path:'C:/Users/jefri/Downloads/POS/.env'});
const pool=new Pool({
  host:process.env.DB_HOST,port:parseInt(process.env.DB_PORT||'5432'),
  database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD
});
async function run(){
  const c=await pool.connect();
  try{
    console.log('clean inventory duplicates');
    await c.query('BEGIN');
    const dup=await c.query("SELECT outlet_id,product_id,COALESCE(variant_id,-1) as vid, array_agg(id ORDER BY id) as ids FROM inventory GROUP BY outlet_id,product_id,COALESCE(variant_id,-1) HAVING COUNT(*)>1");
    console.log('dup groups',dup.rows.length);
    for(const g of dup.rows){
      const ids=g.ids;
      const keep=ids[0];
      const dels=ids.slice(1);
      console.log(`keep ${keep} delete ${dels} for o=${g.outlet_id} p=${g.product_id}`);
      for(const d of dels){ await c.query('DELETE FROM inventory WHERE id=$1',[d]); }
    }
    // fix unique index if wrong
    const idx=await c.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='inventory'");
    console.log(idx.rows.map(r=>r.indexname+':'+r.indexdef).join('\n'));
    const hasCoalesce=idx.rows.some(r=>r.indexdef.includes('COALESCE'));
    if(!hasCoalesce){
      console.log('fixing unique index to use COALESCE');
      try{ await c.query('DROP INDEX IF EXISTS inventory_outlet_id_product_id_variant_id_key'); }catch(e){ console.log(e.message)}
      try{ await c.query('DROP INDEX IF EXISTS uniq_inventory_outlet_product_variant'); }catch(e){}
      await c.query('CREATE UNIQUE INDEX uniq_inventory_outlet_product_variant ON inventory (outlet_id, product_id, COALESCE(variant_id, -1))');
      console.log('created coalesce index');
    }
    await c.query('COMMIT');
    // ensure users
    const u=await c.query('SELECT id,username,role_id,outlet_id FROM users ORDER BY id');
    console.log('users before',u.rows);
    if(u.rows.length===0){
      console.log('seeding users');
      const bcrypt=require('bcryptjs');
      const hash=await bcrypt.hash('password123',10);
      // ensure role ids
      const roles=await c.query('SELECT id,name FROM roles ORDER BY id');
      console.log('roles',roles.rows);
      if(roles.rows.length===0){
        await c.query("INSERT INTO roles (id,name,description) VALUES (1,'super_admin','Super'),(2,'manager','Manager'),(3,'cashier','Cashier') ON CONFLICT DO NOTHING");
        await c.query("SELECT setval('roles_id_seq',(SELECT MAX(id) FROM roles))");
      }
      // ensure outlets
      const outs=await c.query('SELECT id FROM outlets ORDER BY id');
      let outletId=outs.rows[0]?.id;
      if(!outletId){ const r=await c.query("INSERT INTO outlets (name,city) VALUES ('Outlet Pusat','Jakarta') RETURNING id"); outletId=r.rows[0].id; }
      await c.query('INSERT INTO users (username,email,password_hash,role_id,outlet_id) VALUES ($1,$2,$3,$4,$5)',['admin','admin@pos.local',hash,1,null]);
      await c.query('INSERT INTO users (username,email,password_hash,role_id,outlet_id) VALUES ($1,$2,$3,$4,$5)',['manager','manager@pos.local',hash,2,outletId]);
      await c.query('INSERT INTO users (username,email,password_hash,role_id,outlet_id) VALUES ($1,$2,$3,$4,$5)',['cashier','cashier@pos.local',hash,3,outletId]);
      console.log('users seeded');
    }
    const u2=await c.query('SELECT id,username,role_id,outlet_id FROM users ORDER BY id');
    console.log('users after',u2.rows);
    // ensure inventory rows for all outlet/product
    const outs2=await c.query('SELECT id FROM outlets WHERE is_active=true');
    const prods=await c.query('SELECT id FROM products WHERE is_active=true');
    console.log('outlets',outs2.rows.map(r=>r.id),'products',prods.rows.map(r=>r.id));
    for(const o of outs2.rows){
      for(const p of prods.rows){
        await c.query('INSERT INTO inventory (outlet_id,product_id,variant_id,quantity,minimum_stock) VALUES ($1,$2,NULL,0,10) ON CONFLICT DO NOTHING', [o.id,p.id]);
      }
    }
    console.log('inventory ensured');
    const inv=await c.query('SELECT outlet_id,product_id,count(*) FROM inventory GROUP BY outlet_id,product_id');
    console.log('inv groups',inv.rows);
  }catch(e){ try{await c.query('ROLLBACK')}catch(_){}; console.error('fix-db err',e.message,e.code,e.detail); }
  finally{ c.release(); await pool.end(); }
}
run();
