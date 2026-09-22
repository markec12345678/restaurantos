import { PGlite } from '@electric-sql/pglite'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
const pg = new PGlite(process.env.PGLITE_DATA_DIR || '/tmp/pglite-data')
const pinHash = await bcrypt.hash('1111', 10)
const pinLookup = crypto.createHmac('sha256', 'sandbox-test-secret-0123456789abcdef0123456789abcdef').update('1111').digest('hex')
await pg.query('INSERT INTO "Employee" (id,name,email,phone,role,status,"hireDate",pin,"pinLookup","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,NOW(),NOW()) ON CONFLICT (email) DO UPDATE SET pin=$7,"pinLookup"=$8', ['test-admin','Test Admin','admin@e2e.test','','admin','active',pinHash,pinLookup])
await pg.query('INSERT INTO "Job" (id,name,code,"basePayRate","overtimeRate",permissions,"isActive","sortOrder","createdAt","updatedAt") VALUES ($1,$2,$3,0,0,$4,true,0,NOW(),NOW()) ON CONFLICT DO NOTHING', ['job-admin','Administrator','ADMIN',JSON.stringify(['take_orders','void_item','apply_discounts','manage_cash','manage_inventory','manage_employees','view_reports','admin'])])
await pg.close()
console.log('Admin OK')
