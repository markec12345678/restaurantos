import { PGlite } from '@electric-sql/pglite'
const pg = new PGlite('/home/z/restaurantos/pglite-data')
await pg.query(`INSERT INTO "Location" (id,name,code,type,address,city,"postCode",country,phone,email,"businessId","taxId","registerNumber","premisesId","fursCertPath","fursCertPassword","fursEnvironment",timezone,currency,locale,"isOpen","isActive","loyaltyEnabled","loyaltyPointsPerEuro","loyaltyPointsValue","emailReportRecipients","emailEnabled","createdAt","updatedAt")
VALUES ('loc-1','Test Restavracija','HQ','restaurant','Testna 1','Ljubljana','1000','SI','+386 1 234 5678','test@test.si','12345678','SI12345678','TEST01','','','','test','Europe/Ljubljana','EUR','sl-SI',true,true,false,1,0.1,'',false,NOW(),NOW())
ON CONFLICT (id) DO NOTHING`)
console.log('Location OK')
const c = await pg.query('SELECT count(*) FROM "Location"')
console.log('Locations:', c.rows[0].count)
await pg.close()
