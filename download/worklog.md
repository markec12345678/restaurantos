---
Task ID: 1
Agent: Main Agent
Task: Profesionalna implementacija varnostnih in kakovostnih popravkov za POS sistem

Work Log:
- Ustvarjen auth-middleware.ts z Bearer token verifikacijo, session managementom in role-based dostopom
- Ustvarjene validacije.ts z Zod shemami za vse API rute
- Posodobljen auth route s session management in DELETE endpoint za odjavo
- Posodobljen orders route s strežniškim izračunom, Zod validacijo in auth middleware
- Posodobljen payments route z atomno transakcijo za gift card/loyalty
- Posodobljen checks route s strežniškim izračunom iz OrderItem-ov
- Posodobljen tables, gift-cards, loyalty, inventory, receipts, employees z auth in validacijo
- Posodobljen PinLogin.tsx z authFetch wrapperjem
- Posodobljeni OrderPanel, PaymentDialog, ReceiptDialog, StornoDialog, KitchenDisplay z authFetch
- Build uspešen

Stage Summary:
- Vse 6 kritičnih (C-01 do C-06) in 9 visokih (H-01 do H-09) popravkov implementiranih
- Profesionalen auth sistem z Bearer tokeni in role-based dostopom
- Zod validacija na vseh API rutah
- Atomne transakcije za plačila, darilne kartice, zvestobo in inventuro
- Strežniški izračun zneskov - klient ne more manipulirati
- Soft-delete za mize, čeke, inventuro in zaposlene
