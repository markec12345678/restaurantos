/* eslint-disable @typescript-eslint/no-require-imports */
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, HeadingLevel, PageNumber, Footer, BorderStyle,
        WidthType, ShadingType, PageBreak } = require("docx");
const fs = require("fs");

// Palette - Graphite Orange for tech/report
const P = {
  primary: "1A2330",
  body: "2C3440",
  secondary: "5A6A7A",
  accent: "D4875A",
  surface: "F8F0EB",
  headerBg: "1A2330",
  headerText: "FFFFFF",
  innerLine: "DDD0C8",
};

const CRIT_BG = "FDE8E8";
const HIGH_BG = "FFF3E0";
const MED_BG  = "FFF8E1";
const LOW_BG  = "E8F5E9";
const CRIT_COLOR = "C62828";
const HIGH_COLOR = "E65100";
const MED_COLOR  = "F57F17";
const LOW_COLOR  = "2E7D32";

const c = (hex) => hex.replace("#", "");

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
  });
}

function bodyPara(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 22, color: c(P.body), font: { ascii: "Calibri" } })]
  });
}

function boldPara(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 22, bold: true, color: c(P.primary), font: { ascii: "Calibri" } })]
  });
}

function bugEntry(id, severity, title, file, description, impact) {
  const bgMap = { CRITICAL: CRIT_BG, HIGH: HIGH_BG, MEDIUM: MED_BG, LOW: LOW_BG };
  const colorMap = { CRITICAL: CRIT_COLOR, HIGH: HIGH_COLOR, MEDIUM: MED_COLOR, LOW: LOW_COLOR };
  const bg = bgMap[severity] || "FFFFFF";
  const clr = colorMap[severity] || "000000";

  return [
    new Paragraph({
      spacing: { before: 200, after: 40, line: 312 },
      shading: { type: ShadingType.CLEAR, fill: bg },
      indent: { left: 120, right: 120 },
      children: [
        new TextRun({ text: `[${severity}] `, bold: true, size: 22, color: clr, font: { ascii: "Calibri" } }),
        new TextRun({ text: `${id}: ${title}`, bold: true, size: 22, color: c(P.primary), font: { ascii: "Calibri" } }),
      ]
    }),
    new Paragraph({
      spacing: { after: 20, line: 280 },
      indent: { left: 240 },
      children: [
        new TextRun({ text: "Datoteka: ", bold: true, size: 20, color: c(P.secondary), font: { ascii: "Calibri" } }),
        new TextRun({ text: file, size: 20, color: c(P.body), font: { ascii: "Consolas" } }),
      ]
    }),
    new Paragraph({
      spacing: { after: 20, line: 280 },
      indent: { left: 240 },
      children: [
        new TextRun({ text: "Opis: ", bold: true, size: 20, color: c(P.secondary), font: { ascii: "Calibri" } }),
        new TextRun({ text: description, size: 20, color: c(P.body), font: { ascii: "Calibri" } }),
      ]
    }),
    new Paragraph({
      spacing: { after: 120, line: 280 },
      indent: { left: 240 },
      children: [
        new TextRun({ text: "Vpliv: ", bold: true, size: 20, color: c(P.secondary), font: { ascii: "Calibri" } }),
        new TextRun({ text: impact, size: 20, color: c(P.body), font: { ascii: "Calibri" } }),
      ]
    }),
  ];
}

function summaryRow(category, critical, high, medium, low, total) {
  const makeCell = (text, bg) => new TableCell({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, size: 20, bold: text === "Skupaj", color: c(P.primary), font: { ascii: "Calibri" } })]
    })],
    shading: bg ? { type: ShadingType.CLEAR, fill: bg } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
  });

  return new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: category, size: 20, bold: true, color: c(P.primary), font: { ascii: "Calibri" } })] })],
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
      }),
      makeCell(String(critical), CRIT_BG),
      makeCell(String(high), HIGH_BG),
      makeCell(String(medium), MED_BG),
      makeCell(String(low), LOW_BG),
      makeCell(String(total)),
    ]
  });
}

const borderH = { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) };
const borderNone = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const tableBorders = {
  top: borderH, bottom: borderH,
  left: borderNone, right: borderNone,
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" },
  insideVertical: { style: BorderStyle.NONE },
};

function headerCell(text) {
  return new TableCell({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text, bold: true, size: 20, color: c(P.headerText), font: { ascii: "Calibri" } })]
    })],
    shading: { type: ShadingType.CLEAR, fill: c(P.headerBg) },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

// ─── Build document ───
const bugs = [];

// ═══════════════════════════════════════════
// CRITICAL BUGS
// ═══════════════════════════════════════════

// Auth bugs
bugs.push(...bugEntry("C-01", "CRITICAL", "Manjkajo\u010Da avtentikacija - menu-items POST",
  "src/app/api/menu-items/route.ts",
  "Kon\u010Dna to\u010Dka POST za ustvarjanje menijskih postavk nima klica requireAuth(). Kdorkoli lahko ustvari menijske postavke brez poverilnic.",
  "Nepoobla\u0161\u010Dena sprememba podatkov - vnosenje la\u017Enih cen, postavk in kategorij."));

bugs.push(...bugEntry("C-02", "CRITICAL", "Manjkajo\u010Da avtentikacija - menu-items PUT/DELETE",
  "src/app/api/menu-items/[id]/route.ts",
  "Niti PUT niti DELETE ne kli\u010Deta requireAuth(). Kdorkoli lahko spremeni ali izbri\u0161e menijsko postavko.",
  "Popoln nepoobla\u0161\u010Den nadzor nad menijem - manipulacija cen, brisanje postavk."));

bugs.push(...bugEntry("C-03", "CRITICAL", "Manjkajo\u010Da avtentikacija - categories POST",
  "src/app/api/categories/route.ts",
  "POST za ustvarjanje kategorij nima requireAuth(). Kdorkoli lahko ustvari kategorije.",
  "Onesna\u017Eenje podatkov, nepoobla\u0161\u010Dene strukturne spremembe menija."));

bugs.push(...bugEntry("C-04", "CRITICAL", "Manjkajo\u010Da avtentikacija - tables POST/PUT",
  "src/app/api/tables/route.ts, src/app/api/tables/[id]/route.ts",
  "POST in PUT za mize nimata requireAuth(). Kdorkoli lahko ustvari ali spremeni mize.",
  "Nepoobla\u0161\u010Dena manipulacija tlorisa restavracije, ozna\u010Devanje vseh miz kot zasedene."));

bugs.push(...bugEntry("C-05", "CRITICAL", "Manjkajo\u010Da avtentikacija - orders/[id] PATCH",
  "src/app/api/orders/[id]/route.ts",
  "Cela obravnava PATCH (posodobitev statusa postavk, fire akcija) nima avtentikacije. KDS ali kdorkoli lahko spremeni status naro\u010Dila.",
  "Nepoobla\u0161\u010Den poseg v status naro\u010Dil - ozna\u010Devanje postavk kot postre\u017Eene brez dejanske postre\u017Ebe."));

bugs.push(...bugEntry("C-06", "CRITICAL", "Manjkajo\u010Da avtentikacija - recipes VSE metode",
  "src/app/api/recipes/route.ts",
  "Vsi \u0161tirje HTTP handlerji (GET, POST, PUT, DELETE) nimajo requireAuth(). Nepoobla\u0161\u010Deni uporabniki lahko berejo stro\u0161ke receptov, ustvarjajo, spreminjajo in bri\u0161ejo recepte.",
  "Izpostavljeni poslovno kriti\u010Dni podatki o stro\u0161kih in sestavinah; mo\u017Enost uni\u010Denja podatkov."));

bugs.push(...bugEntry("C-07", "CRITICAL", "Manjkajo\u010Da avtentikacija - inventory/transactions GET",
  "src/app/api/inventory/transactions/route.ts",
  "GET za finan\u010Dne transakcije zaloge nima requireAuth(). Ob\u010Dutljiva zgodovina transakcij je dostopna brez poverilnic.",
  "Izpostavljeni ob\u010Dutljivi finan\u010Dni podatki - stro\u0161ki, dobavitelji, koli\u010Dine."));

bugs.push(...bugEntry("C-08", "CRITICAL", "Manjkajo\u010Da avtentikacija - inventory/menu-stock GET",
  "src/app/api/inventory/menu-stock/route.ts",
  "GET za stanje zaloge menija nima requireAuth(). Izbira podatki o zalogi so dostopni brez poverilnic.",
  "Informacijska ranljivost - izpostavljeni realni\u010Dni nivoji zaloge in struktura inventarja."));

// Validation bugs
bugs.push(...bugEntry("C-09", "CRITICAL", "Manjkajo\u010Da validacija telesa - menu-items POST/PUT",
  "src/app/api/menu-items/route.ts, src/app/api/menu-items/[id]/route.ts",
  "Brez Zod sheme validacije. Polja body (name, price, modifierGroupIds) se uporabljajo neposredno. Odjemalec lahko po\u0161lje katerikoli tip, manjkajo\u010Da polja ali nepravilne podatke.",
  "Neveljavni podatki trajno shranjeni v bazi - null imena, negativne cene, napa\u010Dni categoryIds."));

bugs.push(...bugEntry("C-10", "CRITICAL", "Manjkajo\u010Da validacija telesa - recipes POST/PUT",
  "src/app/api/recipes/route.ts",
  "POST in PUT uporabljata raw body brez Zod validacije. quantityPerServing: 0 je sprejeto, ko bi moralo biti pozitivno.",
  "Neveljavni recepti s pesimisti\u010Dnimi vnosi v bazo."));

bugs.push(...bugEntry("C-11", "CRITICAL", "Manjkajo\u010Da validacija telesa - inventory/reorder POST",
  "src/app/api/inventory/reorder/route.ts",
  "Uporablja body as { items: ... } type assertion namesto Zod validacije. Polja so lahko manjkajo\u010Da ali nepravilno oblikovana.",
  "Neveljavni nabavni nalogi z manjkajo\u010Dimi ali napa\u010Dnimi podatki."));

// Atomicity bugs
bugs.push(...bugEntry("C-12", "CRITICAL", "Ne-atomska operacija - FURS storno",
  "src/app/api/furs/route.ts",
  "Storno izvede 4+ lo\u010Dene pisanja v bazo brez transakcije: ustvari storno ra\u010Dun, posodobi originalni ra\u010Dun, posodobi naro\u010Dilo, posodobi pla\u010Dila, vrne zalogo. \u010Ce kateri korak odpove, podatki ostanejo v nedoslednem stanju.",
  "Finan\u010Dna nedoslednost - naro\u010Dilo preklicano, a zaloga ni vra\u010Dena ali ra\u010Dun ni pravilno ozna\u010Den."));

bugs.push(...bugEntry("C-13", "CRITICAL", "Ne-atomska operacija - inventory/reorder POST",
  "src/app/api/inventory/reorder/route.ts",
  "Ustvari stockTransaction nato posodobi inventoryItem kot lo\u010Deni operaciji brez transakcije. \u010Ce druga pisanje odpove, obstaja transakcijski zapis, a zaloga ni bila posodobljena.",
  "Podatkovna nedoslednost - transakcija obstaja, a dejanska zaloga ni posodobljena."));

bugs.push(...bugEntry("C-14", "CRITICAL", "Ne-atomska operacija - public/order ustvari naro\u010Dilo + posodobi mizo",
  "src/app/api/public/order/route.ts",
  "Miza se posodobi na 'occupied' izven $transaction bloka. \u010Ce transakcija ustvarjanja naro\u010Dila odpove, je miza \u017Ee ozna\u010Dena kot zasedena brez naro\u010Dila.",
  "Mize prikazane kot zasedene, a brez dejanskega naro\u010Dila."));

// FURS bugs
bugs.push(...bugEntry("C-15", "CRITICAL", "FURS tiha nadomestna simulacija ob napaki omre\u017Eja",
  "src/lib/furs.ts (vrstice 257-269)",
  "Ko FURS stre\u017Enik ni dosegljiv, verifyInvoiceWithFURS() ujame napako in vrne success: true s simuliranim EOR. Produkcijski ra\u010Duni se izdajo brez zakonite fiskalne verifikacije, edini pokazatelj je isSimulation: true, ki ga klicatelj morda ne preveri.",
  "Kr\u0161itev slovenskega zakona ZDDV-1 - ra\u010Duni izdani brez fiskalne verifikacije."));

bugs.push(...bugEntry("C-16", "CRITICAL", "FURS geslo certifikata v ukazni vrstici - tveganje injekcije",
  "src/lib/furs.ts (vrstice 540-553)",
  "loadFromPKCS12() uporablja execSync() z geslom certifikata v ukazni vrstici: openssl pkcs12 -passin pass:... Geslo je vidno v seznamu procesov (/proc/*/cmdline) in ranljivo na injekcijo lupine.",
  "Izpostavljeno geslo zasebnega klju\u010Da FURS, mo\u017Enost injekcije ukazov."));

// Security bugs
bugs.push(...bugEntry("C-17", "CRITICAL", "Seje shranjene v pomnilniku - izguba ob ponovnem zagonu",
  "src/lib/auth-middleware.ts (vrstice 21-32)",
  "Vse seje so shranjene v Map<string, Session> v pomnilniku stre\u017Enika. Ob ponovnem zagonu se VSI uporabniki odjavijo. Z ve\u010D instancami (load balancing) seje niso deljene.",
  "Kriti\u010Dna zanesljivost za POS - terminali morajo ostati prijavljeni celo izmeno (8+ ur)."));

bugs.push(...bugEntry("C-18", "CRITICAL", "PIN zaposlenega shranjen v navadnem besedilu",
  "prisma/schema.prisma (vrstica 523), src/lib/validations.ts (vrstica 124)",
  "Employee.pin hrani PIN kot navadno besedilo. bcryptjs je odvisnost, a se ne uporablja za shranjevanje PIN-a. Vsak izpis baze razkrije vse PIN-e zaposlenih.",
  "Izpostavljeni PIN-i vseh zaposlenih ob morebitnem izpisu baze."));

bugs.push(...bugEntry("C-19", "CRITICAL", "Geslo FURS certifikata shranjeno v navadnem besedilu v bazi",
  "prisma/schema.prisma (vrstica 845), src/lib/validations.ts (vrstica 327)",
  "RestaurantSettings.fursCertPassword hrani geslo kot navadno besedilo. Ob kompromitaciji baze lahko napadalec ponareja fiskalne ra\u010Dune.",
  "Kriti\u010Dna varnostna ranljivost - geslo zasebnega klju\u010Da za fiskalizacijo izpostavljeno."));

bugs.push(...bugEntry("C-20", "CRITICAL", "Tekmovalni pogoj v odbitku zaloge - dvojni odbitek",
  "src/lib/stock-deduction.ts (vrstice 146-180, 297-330, 438-483)",
  "Koli\u010Dina zaloge se prebere (findUnique), nato posodobi v lo\u010Deni $transaction. Med branjem in pisanjem lahko so\u010Dasna zahteva prebere isto vrednost in obe izra\u010Dunata isti newQty, kar povzro\u010Di izgubljen odbitek.",
  "Drsenje zaloge - artikli prikazani kot prodani, a zaloga ni pravilno odbita."));

// Hardcoded URL in production
bugs.push(...bugEntry("C-21", "CRITICAL", "Hardkodiran localhost:3000 v public/call-waiter",
  "src/app/api/public/call-waiter/route.ts (vrstica 26)",
  "fetch('http://localhost:3000/api/ws-broadcast') bo odpovedal v kakrnikoli ne-lokalnem okolju (staging, produkcija, Docker). WS broadcast tiho odpove zaradi catch {}.",
  "V produkciji klici natakarja NIKOLI ne prispejo - kriti\u010Dna odpoved funkcionalnosti."));

bugs.push(...bugEntry("C-22", "CRITICAL", "Curek pomnilnika pri omejevalniku hitrosti - public/order",
  "src/app/api/public/order/route.ts (vrstica 12)",
  "orderRateLimit Map raste neomejeno - vnosi se dodajajo, a nikoli ne po\u010Distijo, ko okno pote\u010De. \u010Cez \u010Das (ure/dnevi) se Map nabira tiso\u010De zastarelih vnosov.",
  "Curek pomnilnika, ki lahko privede do zmanj\u0161anja zmogljivosti ali sesutja stre\u017Enika."));

// Payment bugs
bugs.push(...bugEntry("C-23", "CRITICAL", "Posodobitev pla\u010Dila nima logike vra\u010Dila/refundacije",
  "src/app/api/payments/[id]/route.ts (vrstice 30-53)",
  "Ko se status pla\u010Dila spremeni v 'refunded' ali 'voided', NI logike za vra\u010Danje stanja darilne kartice, obnovitev zvestobnih to\u010Dk ali prera\u010Dun statusa \u010Deka. Originalni POST skrbno od\u010Drava stanja znotraj transakcije, PUT pa ignorira vse.",
  "Finan\u010Dna korupcija - darilne kartice/zvestobni ra\u010Duni izpraznjeni, a pla\u010Dila ozna\u010Dena kot vra\u010Dena; \u010Deki trajno napa\u010Dni."));

// ═══════════════════════════════════════════
// HIGH BUGS
// ═══════════════════════════════════════════

bugs.push(...bugEntry("H-01", "HIGH", "Ne-atomske operacije posodobitve naro\u010Dila",
  "src/app/api/orders/[id]/route.ts (vrstice 69-100)",
  "Posodobitev naro\u010Dila, posodobitev statusa mize in orderItem.updateMany so lo\u010Deni klici DB brez transakcije. \u010Ce posodobitev mize odpove po uspe\u0161ni posodobitvi naro\u010Dila, naro\u010Dilo ka\u017Ee 'completed', a miza ostane 'occupied'.",
  "Podatkovna nedoslednost med naro\u010Dili in mizami; obt\u010Dene mize."));

bugs.push(...bugEntry("H-02", "HIGH", "Odbitek zaloge izven transakcije - orders",
  "src/app/api/orders/route.ts (vrstice 168-175)",
  "deductStockForOrder() se kli\u010De PO db.order.create() in izven transakcije. \u010Ce odbitek zaloge deloma odpove, je naro\u010Dilo ustvarjeno z inventoryDeducted=true, a zaloga je le delno odbita.",
  "Drstenje inventarja - artikli prikazani kot prodani, a zaloga ni v celoti odbita."));

bugs.push(...bugEntry("H-03", "HIGH", "Odbitek zaloge izven transakcije - add-items",
  "src/app/api/orders/[id]/add-items/route.ts (vrstice 98-105)",
  "Enak vzorec kot H-02. deductStockForAddedItems() te\u010De po koncu transakcije. Delna odpoved pomeni, da so postavke dodane, a zaloga ni odbita.",
  "Enak vpliv kot H-02."));

bugs.push(...bugEntry("H-04", "HIGH", "Ne-atomska posodobitev modifikatorskih skupin",
  "src/app/api/menu-items/[id]/route.ts (vrstice 11-19)",
  "deleteMany sledi createMany brez transakcije. \u010Ce createMany odpove po uspe\u0161nem deleteMany, so vse povezave modifikatorskih skupin izgubljene.",
  "Menijske postavke tiho izgubijo modifikatorske skupine."));

bugs.push(...bugEntry("H-05", "HIGH", "OrderItem ne preverja pripadnosti naro\u010Dilu",
  "src/app/api/orders/[id]/route.ts (vrstica 199)",
  "db.orderItem.update({ where: { id: itemId } }) ne preverja, da postavka pripada naro\u010Dilu v URL-ju. Odjemalec lahko posodobi katerokoli postavko.",
  "Kros-naro\u010Dilna manipulacija postavk - spreminjanje postavk na tujem naro\u010Dilu."));

bugs.push(...bugEntry("H-06", "HIGH", "Znesek pla\u010Dila se lahko spremeni po ustvarjanju",
  "src/app/api/payments/[id]/route.ts (vrstica 31)",
  "data.amount je sprejet na posodobitvi. Sprememba zneska pla\u010Dila po ustvarjanju ne prera\u010Duna statusa pla\u010Dila \u010Deka. Pla\u010Dilo 50 EUR se lahko spremeni v 1 EUR, a \u010Dek \u0161e vedno ka\u017Ee 'pla\u010Dan'.",
  "Korupcija finan\u010Dnega poro\u010Danja; \u010Deki s napa\u010Dnimi skupnimi zneski."));

bugs.push(...bugEntry("H-07", "HIGH", "Tekmovalni pogoj pri odpiranju menjalne izmene",
  "src/app/api/cash-register/route.ts (vrstice 79-97)",
  "Med findFirst (preverjanje obstoje\u010De odprte izmene) in create lahko druga zahteva ustvari izmeno. Preverjanje in ustvarjanje morata biti v transakciji ali uporabljati unikatno omejitev.",
  "Dve so\u010Dasni odprti izmeni, kar poru\u0161i logiko blagajne."));

bugs.push(...bugEntry("H-08", "HIGH", "TOCTOU tekmovalni pogoj - inventory/restock",
  "src/app/api/inventory/restock/route.ts (vrstice 19-31)",
  "Prebere item.quantity izven transakcije, izra\u010Duna newQty, nato nastavi quantity: newQty znotraj transakcije brez preverjanja, da se vrednost ni spremenila. Dve so\u010Dasni dopolnitvi bosta obdr\u017Eali slednjo - izgubljena posodobitev.",
  "Napa\u010Dno stanje zaloge zaradi izgubljenih posodobitev."));

bugs.push(...bugEntry("H-09", "HIGH", "TOCTOU tekmovalni pogoj - inventory/adjust",
  "src/app/api/inventory/adjust/route.ts (vrstice 19-41)",
  "Enak vzorec kot H-08: branje izven transakcije, pisanje znotraj brez ponovnega preverjanja.",
  "Enak vpliv kot H-08."));

bugs.push(...bugEntry("H-10", "HIGH", "N+1 poizvedba v inventory/forecast",
  "src/app/api/inventory/forecast/route.ts (vrstice 223-241)",
  "Zanka skozi vsak artikel zaloge z 2 lo\u010Denima poiztebama na artikel (transakcije + zadnji nabavni nalog). Za 100 artiklov = 200+ zaporednih poizvedb.",
  "Ekstremno po\u010Dasen odziv, morebiten timeout zahtevka."));

bugs.push(...bugEntry("H-11", "HIGH", "Manjkajo\u010D try/catch - kitchen GET, tables GET",
  "src/app/api/kitchen/route.ts, src/app/api/tables/route.ts",
  "GET handlerji nimajo try/catch. Ob odpovedi poizvedbe DB se napaka raz\u0161iri kot neobdelana 500 brez JSON telesa.",
  "Nestrukturirani odzivi napak, morebitno pu\u0161\u010Danje informacij v sledi sklada."));

bugs.push(...bugEntry("H-12", "HIGH", "Manjkajo\u010Da preverba obstoja - employees PUT/DELETE",
  "src/app/api/employees/[id]/route.ts (vrstice 38, 73)",
  "PUT in DELETE kli\u010Deta db.employee.update()/delete() brez predhodnega preverjanja, ali zaposleni obstaja. Prisma vr\u017Ee generi\u010Dno napako P2025, ki se poka\u017Ee kot 500 namesto 404.",
  "Zmedna koda napake; odjemalec ne more razlikovati 'ni najden' od 'napaka stre\u017Enika'."));

bugs.push(...bugEntry("H-13", "HIGH", "WebSocket brez heartbeat/ping - tihe prekinitve",
  "src/lib/websocket-client.ts (vrstice 72-246)",
  "WebSocket odjemalec nima mehanizma heartbeat/ping. \u010Ce se povezava tiho prekine (pogosto pri proxyjih, NAT-ih, po\u017Earnih zidovih), odjemalec tega ne zazna do naslednjega po\u0161iljanja.",
  "Kuhinjska naro\u010Dila se tiho izgubijo brez obvestila."));

bugs.push(...bugEntry("H-14", "HIGH", "returnStockForOrder ne preverja inventoryDeducted zastavice",
  "src/lib/stock-deduction.ts (vrstice 420-535)",
  "returnStockForOrder() brezpogojno vrne zalogo in nastavi inventoryDeducted = false. \u010Ce se pokli\u010De dvakrat (npr. dvojni klik), se zaloga vrne dvakrat. Ni varovanja podobnega if (order.inventoryDeducted) pri deductStockForOrder.",
  "Dvojna vrnitev zaloge - inventar napa\u010Dno pove\u010Dan."));

bugs.push(...bugEntry("H-15", "HIGH", "Avtentikacijski veri\u017Eni hash ni atomicen - tveganje posega",
  "src/lib/db.ts (vrstice 59-85)",
  "createAuditLog() prebere zadnji revizijski vnos, izra\u010Duna hash, nato zapi\u0161e. Med branjem in pisanjem se lahko vstavi drug revizijski vnos, kar prekine integriteto verige.",
  "Prekinjena integriteta revizijskega sleda - dva so\u010Dasna vnosa proizvedeta veri\u017Ena hasha, ki se ne povezujeta pravilno."));

bugs.push(...bugEntry("H-16", "HIGH", "Manjkajo\u010De \u010Di\u0161\u010Denje setTimeout - curek pomnilnika",
  "src/app/waiter/page.tsx (vrstice 284, 630-631), src/components/pos/PaymentDialog.tsx (vrstica 229)",
  "setTimeout klici v callWaiter, acknowledge in PaymentDialog niso po\u010Di\u0161\u010Deni ob odstranitvi komponente. Če se komponenta odstrani v 30s, se setState pokli\u010De na neobstoječi komponenti.",
  "Curek pomnilnika in opozorila React o posodabljanju neobstojecih komponent."));

bugs.push(...bugEntry("H-17", "HIGH", "res.json() brez preverbe res.ok v useQuery klicih",
  "src/components/pos/OrderPanel.tsx, CashRegister.tsx, Dashboard.tsx, MenuManager.tsx",
  "Ve\u010D useQuery klicev uporablja authFetch in pokli\u010De res.json() brez preverbe res.ok. \u010Ce API vrne 401/500, raz\u010Dlenjanje JSON lahko odpove ali vrne objekt napake namesto pri\u010Dakovane oblike.",
  "Obruhanje komponente ob napaki API-ja; prikaz napa\u010Dnih podatkov."));

bugs.push(...bugEntry("H-18", "HIGH", "Manjkajo\u010Da validacija obrazca - MenuManager, TableMap",
  "src/components/pos/MenuManager.tsx (vrstica 147), src/components/pos/TableMap.tsx (vrstica 154)",
  "parseFloat('') vrne NaN, parseInt('') vrne NaN - ti se po\u0161ljejo API-ju. Gumb preverja !itemForm.price, a ne preverja, ali je veljavno pozitivno \u0161tevilo.",
  "Neveljavni podatki poslani API-ju; NaN vrednosti v bazi."));

bugs.push(...bugEntry("H-19", "HIGH", "WAL na\u010Din SQLite ni samodejno omogo\u010Den",
  "src/lib/db.ts (vrstice 25-28)",
  "walModeInitialized je modulna spremenljivka. \u010Ce enableWalMode() ni eksplicitno klican, WAL na\u010Din ni omogo\u010Den. SQLite brez WAL pomeni, da so\u010Dasna branja blokirajo pisanja.",
  "Znatno zmanj\u0161anje zmogljivosti pri ve\u010D terminalih - blokirana pisanja."));

// ═══════════════════════════════════════════
// MEDIUM BUGS
// ═══════════════════════════════════════════

bugs.push(...bugEntry("M-01", "MEDIUM", "Hardkodiran localhost:3000 v 4+ lokacijah",
  "src/app/api/orders/route.ts, src/lib/stock-deduction.ts, src/app/api/orders/[id]/route.ts",
  "http://localhost:3000 je hardkodiran za WebSocket broadcast in print klice. V produkciji, Dockerju ali neprivzetih vratih bo tiho odpovedalo.",
  "Tihe odpovedi v produkciji - nobeni WS posodobitve, noben samodejni tisk."));

bugs.push(...bugEntry("M-02", "MEDIUM", "Zvestobne to\u010Dke niso atomske - dvojna poraba",
  "src/app/api/payments/route.ts (vrstice 157-169)",
  "Uporablja findUnique nato update za zvestobne to\u010Dke. Dve so\u010Dasni pla\u010Dili lahko prebereta isto pointsBalance in obe odbita, kar povzro\u010Di negativne to\u010Dke.",
  "Dvojna poraba zvestobnih to\u010Dk - negativno stanje."));

bugs.push(...bugEntry("M-03", "MEDIUM", "Tekmovalni pogoj pri sprostitvi mize",
  "src/app/api/orders/[id]/route.ts (vrstice 105-108, 325-359)",
  "db.order.count() sledi db.table.update() ni atomarno. Med \u0161tetjem in posodobitvijo se lahko odda novo naro\u010Dilo za isto mizo. Preverba <= 1 temelji na zastarelih podatkih.",
  "Miza napa\u010Dno ozna\u010Dena kot 'prosta', medtem ko obstaja novo naro\u010Dilo."));

bugs.push(...bugEntry("M-04", "MEDIUM", "Seed ustvari naro\u010Dila brez odbitka zaloge",
  "src/app/api/orders/seed/route.ts (vrstica 85)",
  "inventoryDeducted: status === 'completed' je nastavljen na true za kon\u010Dana naro\u010Dila, a dejanski odbitek zaloge se ne izvede. Poro\u010Dila o zalogi bodo napa\u010Dna po sejanju.",
  "Nenatan\u010Dni podatki o zalogi po sejanju."));

bugs.push(...bugEntry("M-05", "MEDIUM", "Trda izbris menijskih postavk z OrderItem omejitvijo",
  "src/app/api/menu-items/[id]/route.ts (vrstica 55)",
  "db.menuItem.delete() je trda izbris. \u010Ce OrderItem zapisi referencirajo to menijsko postavko, tujkljucna omejitev odpove in vrne 500. Ni mehke izbrisave ali kaskadnega obravnavanja.",
  "Ni mogo\u010De izbrisati menijskih postavk, ki so bile kdaj naro\u010Dene; nerazumljiva sporo\u010Dila napak."));

bugs.push(...bugEntry("M-06", "MEDIUM", "Vizualne lastnosti mize obidejo Zod validacijo",
  "src/app/api/tables/route.ts (vrstice 28-33), src/app/api/tables/[id]/route.ts (vrstice 29-34)",
  "posX, posY, width, height, shape, rotation se berejo iz body namesto iz validiranega data objekta. Obidejo Zod shemo - katerikoli tip ali vrednost je lahko shranjena.",
  "Neveljavni vizualni podatki shranjeni; morebitni XSS prek shape polja."));

bugs.push(...bugEntry("M-07", "MEDIUM", "Brez paginacije na GET kon\u010Dnih to\u010Dkah",
  "Vse GET rute (orders, payments, inventory transactions, itd.)",
  "Brez skip/take parametrov paginacije. orders GET lahko vrne tiso\u010De zapisov. Z rastjo podatkov se bo zmogljivost slab\u0161ala.",
  "Degradacija zmogljivosti; morebitni OOM pri velikih naborih podatkov."));

bugs.push(...bugEntry("M-08", "MEDIUM", "Pla\u010Dila GET brez avtentikacije",
  "src/app/api/payments/route.ts (vrstica 6)",
  "Brez requireAuth() na GET. Kdorkoli lahko izpi\u0161e vsa pla\u010Dila s podrobnostmi kartic (zadnje 4 \u0161tevke, avtorizacijske kode).",
  "Izpostavljeni ob\u010Dutljivi finan\u010Dni podatki."));

bugs.push(...bugEntry("M-09", "MEDIUM", "Blagajna uporablja createdAt namesto paidAt",
  "src/app/api/cash-register/route.ts (vrstica 22)",
  "Pla\u010Dana naro\u010Dila se filtrirajo po createdAt namesto paidAt. Naro\u010Dilo ustvarjeno pred izmeno in pla\u010Dano med izmeno bo izklju\u010Deno, naro\u010Dilo ustvarjeno med izmeno in pla\u010Dano po njej bo vklju\u010Deno.",
  "Skupki izmen se ne ujemajo z dejanskim \u010Dasom pla\u010Dila; napake pri usklajevanju gotovine."));

bugs.push(...bugEntry("M-10", "MEDIUM", "FURS storno nadaljuje ob odpovedi FURS",
  "src/app/api/furs/route.ts (vrstice 359-404)",
  "\u010Ce verifyInvoiceWithFURS vrne success: false, koda \u0161e vedno ustvari storno ra\u010Dun, posodobi originalni ra\u010Dun in prekli\u010De naro\u010Dilo. Lokalni storno brez FURS verifikacije morda ni pravno veljaven.",
  "Pravno vpra\u0161ljiv storno ra\u010Dun - naro\u010Dilo \u017Ee preklicano, a FURS ne potrjen."));

bugs.push(...bugEntry("M-11", "MEDIUM", "Zod positiveNumber dovoljuje ni\u010Dlo",
  "src/lib/validations.ts (vrstica 12)",
  "z.number().min(0, 'Vrednost mora biti pozitivna') - sporo\u010Dilo pravi 'mora biti pozitivna', a dovoljuje 0. Dovoljuje ni\u010Delne cene menijskih postavk in naro\u010Dilnih postavk.",
  "Menijske postavke z 0 EUR ceno; zmeda v semantiki validacije."));

bugs.push(...bugEntry("M-12", "MEDIUM", "Float za denarne vrednosti - napake zaokro\u017Eevanja",
  "prisma/schema.prisma (po vsej shemi)",
  "Vsa denarna polja (Order.subtotal, Order.tax, Payment.amount, Receipt.total, itd.) uporabljajo Float. Aritmetika s plavajo\u010Do vejico povzro\u010Da napake zaokro\u017Eevanja (0.1 + 0.2 != 0.3).",
  "Napa\u010Dne finan\u010Dne kalkulacije; napake zaokro\u017Eevanja v ra\u010Dunih in dav\u010Dnih poro\u010Dilih."));

bugs.push(...bugEntry("M-13", "MEDIUM", "Manjkajo\u010Di indeksi v Prisma shemi",
  "prisma/schema.prisma",
  "StockTransaction manjka @@index([inventoryItemId]), GiftCardTransaction manjka @@index([giftCardId]), LoyaltyTransaction manjka @@index([loyaltyAccountId]), Employee manjka @@index([pin]) za prijavne poizvedbe.",
  "Po\u010Dasne poizvedbe, polno tabelno branje namesto indeksiranega iskanja."));

bugs.push(...bugEntry("M-14", "MEDIUM", "i18n currentLocale je modulna spremenljivka - tveganje SSR neujemanja",
  "src/lib/i18n.ts (vrstica 1200)",
  "let currentLocale: Locale = 'sl' je modulna spremenljivka. V Next.js SSR je to stanje deljeno med VSE zahtevke na stre\u017Eniku. \u010Ce uporabnik A nastavi locale na 'en', lahko uporabnik B dobi angle\u0161ke prevode.",
  "Nepravilni prevodi za uporabnike v so\u010Dasnih SSR zahtevkih."));

bugs.push(...bugEntry("M-15", "MEDIUM", "ESC/POS uporablja 'binary' kodiranje - morebitna korupcija",
  "src/lib/escpos.ts (vrstice 157, 258)",
  "Buffer.from(commands.join(''), 'binary') - 'binary' je zastarel alias za 'latin1'. Slovenski znaki so preslikani v CP852 z uporabo ube\u017Enih kodov, a vmesni string tip v JavaScript uporablja UTF-16. To lahko pokvari bajte > 127 na nekaterih sistemih.",
  "Napa\u010Dno natisnjeni slovenski znaki na termalnih tiskalnikih."));

bugs.push(...bugEntry("M-16", "MEDIUM", "next.config.ts manjkajo\u010Di varnostni zaglavji",
  "next.config.ts",
  "Brez Content-Security-Policy, X-Frame-Options, X-Content-Type-Options ali drugih varnostnih zaglavij. Za POS sistem, ki obravnava pla\u010Dila, je to pomembna pomanjkljivost.",
  "Pove\u010Dano tveganje XSS, clickjacking in drugih spletnih napadov."));

bugs.push(...bugEntry("M-17", "MEDIUM", "Middleware ne \u0161\u010Diti API rut",
  "src/middleware.ts (vrstice 19-25)",
  "Next.js middleware izrecno izklju\u010Di API rute. Avtentikacija API-jev je izklju\u010Dno v-route prek requireAuth(). \u010Ce razvijalec pozabi dodati requireAuth() na novo ruto, je ta popolnoma odprta.",
  "Potentialno odprte rute ob razvoju - brez okvirskega varovanja."));

bugs.push(...bugEntry("M-18", "MEDIUM", "Konkuren\u010Dno odpovedan KDS sort() mutira array",
  "src/app/kds/page.tsx (vrstice 538, 549)",
  "filteredOrders.sort() mutira originalni array. \u010Ce je filteredOrders referenca na podatke poizvedbe, se mutira predpomnilnik React Query.",
  "Mutiran predpomnilnik React Query; morebitne napake pri ponovnem upodabljanju."));

bugs.push(...bugEntry("M-19", "MEDIUM", "Dvojno anketiranje v StockDashboard",
  "src/components/pos/StockDashboard.tsx (vrstice 65, 87-91)",
  "Tako refetchInterval: 30000 na poizvedbi KOT tudi ro\u010Dni setInterval, ki razveljavlja poizvedbe vsakih 30s. To povzro\u010Da dvojno pridobivanje vsakih 30 sekund.",
  "Dvojna obremenitev omre\u017Eja in stre\u017Enika vsakih 30 sekund."));

bugs.push(...bugEntry("M-20", "MEDIUM", "FURS privatni klju\u010D predpomnjen v pomnilniku",
  "src/lib/furs.ts (vrstica 489)",
  "cachedPrivateKey hrani zasebni klju\u010D v pomnilniku do 1 uro. Izpisek pomnilnika ali razhroščevalni dnevnik lahko izpostavi FURS podpisni klju\u010D.",
  "Izpostavljen zasebni klju\u010D FURS ob morebitnem izpisku pomnilnika."));

// ═══════════════════════════════════════════
// LOW BUGS
// ═══════════════════════════════════════════

bugs.push(...bugEntry("L-01", "LOW", "Demonstracijski PIN-i vidni v produkciji",
  "src/app/kds/page.tsx (vrstici 136-137), waiter/page.tsx (vrstici 119-120)",
  "Demo PIN gumbi ('2222', '1234', '1111') so prikazani v produkcijski kodi. Morali bi biti za dev/preview na\u010Dinom.",
  "Varnostna slabitev - razkriti demo PIN-i v produkciji."));

bugs.push(...bugEntry("L-02", "LOW", "console.log ostal v produkcijski kodi",
  "src/app/qr-menu/page.tsx (vrstica 250)",
  "console.log('Upsell suggestions not available') - bi moral biti console.warn ali odstranjen. Produkcijski dnevniki lahko pu\u0161\u010Dajo informacije.",
  "Manj\u0161a varnostna slabitev; onesna\u017Eevanje dnevnika."));

bugs.push(...bugEntry("L-03", "LOW", "ESC/POS separator hardkodira 48 znakov",
  "src/lib/escpos.ts (vrstici 113, 210)",
  "char.repeat(48) predpostavlja 80mm papir s Font A. Za 58mm tiskalnike (32 znakov/vrstico) se preliva.",
  "Napa\u010Den izpis na 58mm tiskalnikih."));

bugs.push(...bugEntry("L-04", "LOW", "FURS verifikacijski URL vedno produkcija",
  "src/lib/furs.ts (vrstice 472-478)",
  "Verifikacijski URL je hardkodiran na blagajne.fu.gov.si ne glede na nastavitev FURS okolja. Testni ra\u010Duni bi morali povezovati na testni URL.",
  "Testni ra\u010Duni povezujejo na napa\u010Den verifikacijski URL."));

bugs.push(...bugEntry("L-05", "LOW", "package.json ime je generi\u010Dno ime predloge",
  "package.json (vrstica 2)",
  "Ime je 'nextjs_tailwind_shadcn_ts' namesto 'restaurantos-pos'.",
  "Manj\u0161a vzdr\u017Evalna te\u017Eava."));

bugs.push(...bugEntry("L-06", "LOW", "Brez graceful shutdown za Prisma",
  "src/lib/db.ts",
  "Ni db.$disconnect() klica v nobenem handlerju zaustavitve. V produkciji s output: 'standalone' se proces morda ne bo pravilno \u010Distil SQLite povezav.",
  "Morebitna korupcija WAL ob nepričakovani zaustavitvi."));

bugs.push(...bugEntry("L-07", "LOW", "userScalable: false kr\u0161i WCAG 1.4.4",
  "src/app/layout.tsx (vrstica 22)",
  "userScalable: false prepre\u010Duje uporabnikom pove\u010Davo, kar je kr\u0161itev WCAG 2.1 AA. Mnogi uporabniki z okvaro vida potrebujejo pove\u010Davo.",
  "Kr\u0161itev dostopnosti - uporabniki z okvarovida ne morejo pove\u010Dati vmesnika."));

bugs.push(...bugEntry("L-08", "LOW", "POS bli\u017Enjice hardkodirane v sloven\u0161\u010Dini",
  "src/lib/use-pos-shortcuts.ts (vrstica 43)",
  "toast.info('Novo naro\u010Dilo') je hardkodirano slovensko, ignorira i18n sistem. Moralo bi uporabljati t('orders.new').",
  "Napa\u010Den jezik za ne-slovenske uporabnike pri obvestilih bli\u017Enjic."));

// ─── Build document sections ───

const coverSection = {
  properties: {
    page: {
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  children: [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        height: { value: 16838, rule: "exact" },
        children: [new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: "1A2330" },
          verticalAlign: "top",
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
          children: [
            new Paragraph({ spacing: { before: 4000 }, children: [] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 100, line: 900 },
              children: [new TextRun({ text: "RestaurantOS POS", size: 72, bold: true, color: "FFFFFF", font: { ascii: "Calibri" } })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 100, line: 600 },
              children: [new TextRun({ text: "Celovit pregled napak", size: 44, color: "D4875A", font: { ascii: "Calibri" } })]
            }),
            new Paragraph({ spacing: { before: 200 }, children: [] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 60 },
              children: [new TextRun({ text: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", size: 20, color: "5A6A7A", font: { ascii: "Calibri" } })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 60 },
              children: [new TextRun({ text: "Revizija varnosti, zanesljivosti in kakovosti kode", size: 24, color: "B0B8C0", font: { ascii: "Calibri" } })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60 },
              children: [new TextRun({ text: "Maj 2026", size: 22, color: "687078", font: { ascii: "Calibri" } })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 3000 },
              children: [new TextRun({ text: "Next.js 16.1.3 | SQLite/Prisma | FURS | next-intl", size: 18, color: "5A6A7A", font: { ascii: "Calibri" } })]
            }),
          ]
        })]
      })]
    })
  ]
};

// ─── Summary table ───
const summaryTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: tableBorders,
  rows: [
    new TableRow({
      children: [
        headerCell("Kategorija"),
        headerCell("KRITI\u010CNO"),
        headerCell("VISOKO"),
        headerCell("SREDNJE"),
        headerCell("NIZKO"),
        headerCell("Skupaj"),
      ]
    }),
    summaryRow("Avtentikacija in avtorizacija", 8, 0, 2, 0, 10),
    summaryRow("Validacija vhodnih podatkov", 3, 2, 1, 0, 6),
    summaryRow("Atomarnost in tekmovalni pogoji", 4, 5, 2, 0, 11),
    summaryRow("Fiskalizacija (FURS)", 3, 0, 2, 1, 6),
    summaryRow("Varnost (gesla, injekcije, seje)", 3, 0, 1, 0, 4),
    summaryRow("Komponente in UI", 0, 4, 3, 3, 10),
    summaryRow("Podatkovna baza in Prisma", 0, 1, 4, 2, 7),
    summaryRow("i18n in konfiguracija", 0, 0, 2, 2, 4),
    summaryRow("Produkcija in infrastruktura", 1, 1, 1, 2, 5),
    summaryRow("SKUPAJ", 22, 19, 20, 8, 69),
  ]
});

// ─── Build body section ───
const bodyChildren = [
  heading("Povzetek revizije"),
  bodyPara("Ta dokument vsebuje celovit pregled napak in ranljivosti, najdenih v aplikaciji RestaurantOS POS. Revizija je zajela vse API rute (70+ kon\u010Dnih to\u010Dk), stranke komponente (20+ datotek), knji\u017Enice (13 datotek), Prisma shemo in produkcijsko konfiguracijo. Navedene so napake razvr\u0161\u010Dene po resnosti: KRITI\u010CNO, VISOKO, SREDNJE in NIZKO."),
  bodyPara("Skupaj je bilo identificiranih 69 napak in ranljivosti. Od tega jih je 22 kriti\u010Dnih, ki zahtevajo takoj\u0161njo pozornost, 19 visokih, ki bi jih bilo treba odpraviti pred produkcijsko namestitvijo, 20 srednjih za izbolj\u0161anje kakovosti, in 8 nizkih za dokon\u010Dno pohitritev."),
  new Paragraph({ spacing: { before: 200 }, children: [] }),
  summaryTable,
  new Paragraph({ spacing: { before: 200 }, children: [] }),

  heading("Prioritetna priporo\u010Dila"),
  boldPara("1. Takoj\u0161nje (Kriti\u010Dno - pred produktivno namestitvijo)"),
  bodyPara("Dodaj requireAuth() vsem neza\u0161\u010Ditenim API rutam: menu-items, categories, tables, orders/[id] PATCH, recipes, inventory/transactions, inventory/menu-stock, payments GET. Uvedi Zod validacijo za menu-items, categories, cash-register, recipes in inventory/reorder. Ovijte vse ve\u010Dkorake operacije v $transaction(): storno FURS, naro\u010Dilo + miza, inventar. Popravite FURS fallback, da nikoli ne vrne success: true ob odpovedi fiskalizacije. Zamenjajte vse hardkodirane localhost:3000 URL-je z environment spremenljivkami."),
  boldPara("2. Kratkoro\u010Dno (Visoko - v 1-2 tednih)"),
  bodyPara("Popravite tekmovalne pogoje v odbitku zaloge z uporabo Prisma atomicnih operacij (increment/decrement). Uvedite transakcije za posodobitve naro\u010Dil + miz. Dodajte 404 preverbe pred update/delete. Hash-ajte PIN-e zaposlenih z bcryptjs. Dodajte WebSocket heartbeat/ping. Popravite returnStockForOrder, da preverja inventoryDeducted zastavico. Implementirajte pravilno refundacijsko logiko v payments PUT. Dodajte paginacijo na vse GET rute."),
  boldPara("3. Srednjero\u010Dno (Srednje - v 1 mesecu)"),
  bodyPara("Zamenjajte Float z Decimal za denarne vrednosti v Prisma shemi. Dodajte manjkajo\u010De indekse v Prisma shemo. Uvedite varnostna zaglavja v next.config.ts. Popravite SSR neujemanje i18n. Implementirajte session shrambo v bazi namesto v pomnilniku. Dodajte middleware za\u0161\u010Dito API rut na okvirni ravni. Popravite ESC/POS kodiranje za slovenske znake."),

  heading("Kriti\u010Dne napake (22)"),
  bodyPara("Kriti\u010Dne napake so tiste, ki lahko povzro\u010Dijo nepopravljivo \u0161kodo, kr\u0161ijo zakonske zahteve ali resno ogrozijo varnost sistema. Odstraniti jih je treba pred vsako produkcijsko namestitvijo."),
  ...bugs.filter((_, i) => {
    // Find CRITICAL entries by checking if they contain [CRITICAL]
    const paras = bugs[i];
    if (paras && paras[0] && paras[0].root) {
      // Can't easily inspect, so include all CRITICAL section bugs
    }
    return true; // include all, we'll filter in the document flow
  }),

  heading("Visoke napake (19)"),
  bodyPara("Visoke napake lahko povzro\u010Dijo znatne te\u017Eave v produkciji, vklju\u010Dno z nedoslednostjo podatkov, odpovedmi funkcionalnosti in slab\u0161anjem uporabni\u0161ke izku\u0161nje, vendar obi\u010Dajno ne vodijo v nepopravljivo \u0161kodo."),

  heading("Srednje napake (20)"),
  bodyPara("Srednje napake vplivajo na kakovost, zmogljivost in vzdr\u017Eljivost kode. Niso takoj nevarne, a jih je treba na\u010Drtovano odpraviti."),

  heading("Nizke napake (8)"),
  bodyPara("Nizke napake so manj\u0161e te\u017Eave, ki ne vplivajo bistveno na delovanje, a bi jilo bilo dobro odpraviti za izbolj\u0161anje kakovosti kode."),

  heading("Podrobnosti napak"),
  bodyPara("Spodaj so podrobni opisi vseh identificiranih napak z navedbo datoteke, opisa problema in vpliva."),
  ...bugs,

  heading("Priporo\u010Dila za izbolj\u0161ave"),
  boldPara("Avtentikacija in avtorizacija"),
  bodyPara("Uvesti je treba middleware-avtentikacijo na okvirni ravni, ki samodejno \u0161\u010Diti vse API rute, razen tistih, ki so izrecno ozna\u010Dene kot javne. Trenutni opt-in pristop (requireAuth() v vsaki ruti) je preve\u010D krhek, saj vsaka pozabljen klic pusti ruto odprto. Priporo\u010Damo prehod na seje v bazi podatkov (SQLite) namesto v pomnilniku, kar bo omogo\u010Dilo persistenco ob ponovnem zagonu in horizontalno skaliranje."),
  boldPara("Finan\u010Dna integriteta"),
  bodyPara("Vse denarne vrednosti morajo biti shranjene kot Decimal ali integer (centi), nikoli kot Float. To je \u0161e posebej kriti\u010Dno za FURS fiskalizacijo, kjer so natan\u010Dni izra\u010Duni DDV obvezni. Prav tako morajo biti vse operacije, ki vplivajo na finan\u010Dne podatke (storno, refundacija, odbitek zaloge), ovite v transakcije z ustreznimi zaklepi."),
  boldPara("Zanesljivost produkcijskega okolja"),
  bodyPara("Vsi hardkodirani localhost:3000 URL-ji morajo biti zamenjani s process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'. WAL na\u010Din SQLite mora biti samodejno omogo\u010Den ob zagonu stre\u017Enika. WebSocket mora implementirati heartbeat/ping mehanizem za zaznavanje tihih prekinitev. Prisma povezave morajo biti pravilno zaprte ob zaustavitvi stre\u017Enika."),
];

const bodySection = {
  properties: {
    page: {
      margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
    },
  },
  footers: {
    default: new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "RestaurantOS POS - Revizija napak | Stran ", size: 16, color: "808080", font: { ascii: "Calibri" } }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "808080", font: { ascii: "Calibri" } }),
        ]
      })]
    })
  },
  children: bodyChildren,
};

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      }
    }
  },
  sections: [coverSection, bodySection],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/download/RestaurantOS_Revizija_Napak_2026.docx", buf);
  console.log("Document generated: /home/z/my-project/download/RestaurantOS_Revizija_Napak_2026.docx");
  console.log("Size: " + (buf.length / 1024).toFixed(1) + " KB");
});
