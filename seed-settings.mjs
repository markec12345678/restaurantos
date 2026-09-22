import { PGlite } from '@electric-sql/pglite'
const pg = new PGlite('/home/z/restaurantos/pglite-data')
await pg.query(`INSERT INTO "RestaurantSettings" (id,name,address,city,"postCode",phone,email,web,"businessId","taxId","registerNumber","fursCertPath","fursCertPassword","fursEnvironment","defaultVatRate","reducedVatRate","loyaltyEnabled","loyaltyPointsPerEuro","loyaltyPointsValue","receiptFooter",currency,locale,country,"apiKeys","autoGratuityEnabled","autoGratuityPercent","autoGratuityThreshold","allergenFilterEnabled","emailEnabled","emailSmtpHost","emailSmtpPort","emailSmtpUser","emailSmtpPassword","emailFromAddress","emailReportRecipients","isActive","createdAt","updatedAt")
VALUES ('settings-1','Test Restavracija','Testna 1','Ljubljana','1000','+386 1 234 5678','test@test.si','www.test.si','12345678','SI12345678','TEST01','','','test',22,9.5,false,1,0.1,'Hvala!','EUR','sl-SI','SI','{}',false,10,50,false,false,'',0,'','','','',true,NOW(),NOW())
ON CONFLICT (id) DO NOTHING`)
console.log('Settings OK')
await pg.close()
