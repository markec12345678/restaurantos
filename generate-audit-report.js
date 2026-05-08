const { Document, Packer, Paragraph, TextRun, Header, Footer, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, PageNumber, ShadingType, BorderStyle, WidthType,
  TableOfContents, SectionType, NumberFormat, PageBreak } = require("docx");
const fs = require("fs");

// Palette: Deep Sea — tech report
const P = { primary: "#0B1C2C", body: "#1C2A3D", secondary: "#5B6B7D", accent: "#529286", surface: "#E8ECEB" };
const c = (hex) => hex.replace("#", "");

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
const accentBorder = { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) };
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" };
const tableBorders = {
  top: accentBorder, bottom: accentBorder,
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: thinBorder, insideVertical: { style: BorderStyle.NONE }
};
const headerBorders = {
  top: accentBorder, bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent) },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }
};

function heading(text, level = HeadingLevel.HEADING_1) {
  const sizes = { [HeadingLevel.HEADING_1]: 32, [HeadingLevel.HEADING_2]: 28, [HeadingLevel.HEADING_3]: 24 };
  const befores = { [HeadingLevel.HEADING_1]: 400, [HeadingLevel.HEADING_2]: 300, [HeadingLevel.HEADING_3]: 200 };
  return new Paragraph({
    heading: level,
    spacing: { before: befores[level], after: 120 },
    children: [new TextRun({ text, bold: true, size: sizes[level], color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })]
  });
}

function bodyPara(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    indent: opts.noIndent ? {} : { firstLine: 480 },
    spacing: { line: 312, after: opts.after || 80 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
  });
}

function boldBodyPara(text, rest = "") {
  const children = [new TextRun({ text, bold: true, size: 24, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })];
  if (rest) children.push(new TextRun({ text: rest, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }));
  return new Paragraph({ spacing: { line: 312, after: 80 }, children });
}

function severityBadge(sev) {
  const colors = { CRITICAL: "C0392B", HIGH: "E67E22", MEDIUM: "F1C40F", LOW: "27AE60" };
  return new TextRun({ text: ` [${sev}] `, bold: true, size: 21, color: colors[sev] || "000000", font: { ascii: "Calibri", eastAsia: "SimHei" } });
}

function issueRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((text, i) => new TableCell({
      width: { size: i === 0 ? 8 : i === 1 ? 12 : i === 2 ? 15 : 65, type: WidthType.PERCENTAGE },
      shading: isHeader
        ? { type: ShadingType.CLEAR, fill: c(P.accent) }
        : undefined,
      margins: { top: 50, bottom: 50, left: 100, right: 100 },
      children: [new Paragraph({
        spacing: { line: 280 },
        children: [new TextRun({
          text: String(text),
          bold: isHeader,
          size: 20,
          color: isHeader ? "FFFFFF" : c(P.body),
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }
        })]
      })]
    }))
  });
}

// Cover builder R1 style
function buildCover() {
  const wrapperRow = new TableRow({
    height: { value: 16838, rule: "exact" },
    children: [new TableCell({
      borders: allNoBorders,
      verticalAlign: "top",
      children: [
        new Paragraph({ spacing: { before: 4800 }, children: [] }),
        new Paragraph({
          indent: { left: 1200, right: 1200 },
          spacing: { line: 900, lineRule: "atLeast", after: 200 },
          children: [new TextRun({ text: "RestaurantOS POS", size: 72, bold: true, color: c(P.accent), font: { ascii: "Calibri", eastAsia: "SimHei" } })]
        }),
        new Paragraph({
          indent: { left: 1200, right: 1200 },
          spacing: { line: 600, lineRule: "atLeast", after: 400 },
          children: [new TextRun({ text: "Celovita revizija varnosti in kode", size: 44, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })]
        }),
        new Paragraph({
          indent: { left: 1200, right: 1200 },
          border: { top: { style: BorderStyle.SINGLE, size: 8, color: c(P.accent), space: 20 } },
          spacing: { before: 200 },
          children: []
        }),
        new Paragraph({
          indent: { left: 1200, right: 1200 },
          spacing: { before: 300, line: 360 },
          children: [new TextRun({ text: "Maj 2026  |  Varnostna revizija  |  94 najdenih napak", size: 24, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
        }),
        new Paragraph({
          indent: { left: 1200, right: 1200 },
          spacing: { before: 100 },
          children: [new TextRun({ text: "7 Kriti\u010dnih  |  22 Visokih  |  31 Srednjih  |  19 Nizkih", size: 22, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })]
        }),
      ]
    })]
  });
  return [new Table({ borders: allNoBorders, rows: [wrapperRow], width: { size: 100, type: WidthType.PERCENTAGE } })];
}

// ============= AUDIT DATA =============

const criticalIssues = [
  { id: "C-01", cat: "Varnost", file: "api/seed/route.ts", desc: "Seed route je v PUBLIC_ROUTES - brez avtentikacije. Kadarkoli lahko brises celotno bazo (naloge, zaposlene, zaloge, racune, darilne kartice) z enim HTTP POST zahtevkom.", fix: "Odstrani /api/seed iz PUBLIC_ROUTES. Dodaj requireAuth z admin dovoljenjem." },
  { id: "C-02", cat: "Poslovna logika", file: "api/orders/route.ts", desc: "Cene izdelkov prihajajo od stranke (item.price), ne iz baze (mi.price). Zlonamerna stranka lahko poslje price: 0.01 za zrezek, ki stane 32.99 EUR.", fix: "Zamenjaj const price = item.price z const price = mi.price. Baza mora biti edini vir resnice za cene." },
  { id: "C-03", cat: "Race Condition", file: "api/payments/route.ts", desc: "Darilna kartica / zvestobne tocke - dvakratno porocanje. Dve socasni transakciji z isto kartico lahko obi prebereta balance: 50 in obe odsezeta, kar povzroci negativno stanje.", fix: "Uporabi Prisma decrement z where-pogojem: update({ where: { id, balance: { gte: amount } }, data: { balance: { decrement: amount } } }). Preveri stevilo prizadetih vrstic." },
  { id: "C-04", cat: "Dvojni odbitek", file: "api/furs/route.ts + orders/[id]/route.ts", desc: "Zaloga se odbije dvakrat: ko order gre v 'completed' status in ko se klice FURS potrjevanje. FURS pot ne preverja inventoryDeducted zastavice.", fix: "V FURS poti preveri order.inventoryDeducted pred odbitkom. Centraliziraj odbitek zaloge v eno funkcijo z idempotenca kljucem." },
  { id: "C-05", cat: "Varnost", file: "api/payments/[id]/route.ts", desc: "PUT endpoint nima avtentikacije niti validacije. Kadarkoli lahko spremenis znesek placila, status na 'refunded', ali tip placila. Neposredna finan\u010dna manipulacija.", fix: "Dodaj requireAuth(req, { permission: 'manage_cash' }). Dodaj Zod validacijo. Omeji katera polja se lahko spremenijo po kreaciji." },
  { id: "C-06", cat: "Poslovna logika", file: "api/discounts/[id]/route.ts", desc: "PUT brez avtentikacije, brez validacije, currentUses nastavljiv od stranke. Napadalec lahko ponastavi currentUses na 0 ali spremeni znesek popusta na 100%.", fix: "Dodaj requireAuth z apply_discounts dovoljenjem. Odstrani currentUses iz posodobitvene sheme - naj se povecuje samo streznisko." },
  { id: "C-07", cat: "Podatkovna niezavest", file: "api/dashboard + cash-register + payments GET", desc: "Dashboard, blagajna in placila izpostavljajo finan\u010dne podatke (prihodki, gotovina, zaposleni) brez avtentikacije. Kdorkoli v omrezju lahko vidi vse.", fix: "Dodaj requireAuth z view_reports za dashboard in manage_cash za blagajno." },
  { id: "C-08", cat: "DDV/FURS", file: "store.ts + OrderPanel.tsx", desc: "Popusti se odstejejo od skupka (subtotal + tax) brez prera\u010duna DDV. Po ZDDV-1 mora popust zmanjsati obdav\u010deno osnovo, nato se DDV prera\u010duna. Vsak racun s popustom je neustrezen.", fix: "Aplikacija popusta proporcionalno na vsako DDV stopnjo osnovo, prera\u010dunaj DDV iz novih osnov. cartVatBreakdown() mora upostevati popust." },
  { id: "C-09", cat: "Race Condition", file: "GiftCardManager.tsx + LoyaltyManager.tsx", desc: "Stanje darilne kartice in zvestobne tocke se racunajo odjemalsko (newBalance = card.balance + amount) in posljejo celotno novo stanje. Sočasne transakcije prepisejo eno drugo.", fix: "Poslji samo { amount } na streznik in uporabi atomicno operacijo UPDATE SET balance = balance + amount." },
  { id: "C-10", cat: "Varnost", file: "page.tsx (Preskoci prijavo)", desc: "Gumb 'Preskoci prijavo' ustvari gosta z role: 'admin' in permissions: ['admin']. Kdorkoli lahko obide avtentikacijo in pridobi poln dostop.", fix: "Odstrani admin rolo od gosta. Ce je potrebno za demo, dodeli samo bralne pravice." },
  { id: "C-11", cat: "Stanje", file: "page.tsx + PinLogin.tsx", desc: "authFetch razpo\u0161lje dogodek pos:auth-expired ob 401, vendar page.tsx ne poslu\u0161a nanj. Ko zeton potece, uporabnik nadaljuje z uporabo z neuspe\u0161nimi klici API.", fix: "Dodaj useEffect v page.tsx, ki poslu\u0161a pos:auth-expired in ponastavi authUser na null." },
  { id: "C-12", cat: "Poslovna logika", file: "StornoDialog.tsx", desc: "Storno potek: (1) klice FURS, (2) posodobi order. Ce korak 1 uspe in korak 2 ne, ima FURS zabelezen storno, ampak order ni oznacen kot preklican. Ni povratnega mehanizma.", fix: "Ovij v streznisko transakcijo. Ce posodobitev orderja ne uspe, poskusi razveljaviti FURS storno. Ali uporabi compensacijski vzorec." },
  { id: "C-13", cat: "Poslovna logika", file: "PaymentDialog.tsx", desc: "Split placilo: splitAmount = totalWithTip / splitCount proizvaja nekon\u010dno decimalno stevilo. 3 x 3.34 EUR = 10.02 EUR namesto 10.01 EUR. Stranka je prevec zara\u010dunana.", fix: "Izracunaj N-1 enakih placil in zadnje placilo = total - (N-1) * roundedSplit." },
  { id: "C-14", cat: "Poslovna logika", file: "PaymentDialog.tsx", desc: "Izracun vracila uporablja document.getElementById za posodobitev DOM namesto React stanja. Ce se totalWithTip spremeni, prikazano vracilo je zastarelo.", fix: "Uporabi React stanje (const [cashGiven, setCashGiven] = useState(0)) in izracunaj change kot izvedeno vrednost." },
];

const highIssues = [
  { id: "H-01", cat: "Varnost", file: "api/auth/route.ts", desc: "Timing attack na plaintext PIN primerjavo (emp.pin === data.pin). Napadalec lahko meri cas odziva za postopno ugotavljanje PIN-a.", fix: "Uporabi crypto.timingSafeEqual() za plaintext fallback. Bolje: prisili migracijo vseh PIN-ov v bcrypt ob zagonu." },
  { id: "H-02", cat: "Varnost", file: "api/auth/route.ts", desc: "IP za rate limiting pridobljen iz x-forwarded-for / x-real-ip glav, ki jih je mogo\u010de ponarediti. Rate limiting je neucinkovit.", fix: "Uporabi strezniski identifikator seje (piskotek) za rate limiting poleg IP-ja." },
  { id: "H-03", cat: "Poslovna logika", file: "api/orders/[id]/route.ts", desc: "Nobene validacije prehodov stanj naro\u010dila. Koncano naro\u010dilo je mogo\u010de vrniti v 'pending', preklicano v 'completed' (sprozi ponovni odbitek zaloge).", fix: "Definiraj avtomat stanj: pending -> in-progress -> ready -> completed. Preklic samo iz pending/in-progress/ready." },
  { id: "H-04", cat: "Poslovna logika", file: "api/gift-cards/[id]/route.ts", desc: "Stanje darilne kartice je nastavljivo na poljubno vrednost. Osebje z nizkim dovoljenjem lahko nastavi poljubno visoko stanje.", fix: "Spremembe stanja samo skozi load/redeem transakcije z validiranimi zneski. Direktno nastavljanje zahteva admin." },
  { id: "H-05", cat: "Poslovna logika", file: "api/loyalty/[id]/route.ts", desc: "Zvestobne tocke so nastavljive na poljubno vrednost. Osebje z nizkim dovoljenjem lahko napihne stanje tock.", fix: "Spremembe tock samo skozi earn/redeem transakcije. Direktno nastavljanje zahteva admin." },
  { id: "H-06", cat: "Race Condition", file: "api/furs/route.ts", desc: "Storno stevilka racuna generirana zunaj transakcije z ro\u010dnim branjem in povecevanjem. So\u010dasni storno zahtevki generirajo isto stevilko.", fix: "Uporabi getNextReceiptNumber() iz counters.ts za atomarno generiranje." },
  { id: "H-07", cat: "Varnost", file: "api/furs/route.ts", desc: "Vsi FURS endpointi (GET, POST, PUT) nimajo avtentikacije. Kdorkoli lahko spro\u017ei dav\u010dno potrjevanje, ustvari storno racun ali vidi certifikat.", fix: "Dodaj requireAuth(req, { permission: 'admin' }) na vse tri handlerje." },
  { id: "H-08", cat: "Poslovna logika", file: "api/payments/route.ts + validations.ts", desc: "createPaymentSchema dovoljuje nastavljanje status od stranke s privzetim 'completed'. Stranka lahko ustvari placilo s status: 'refunded'.", fix: "Odstrani status iz sheme odjemalca. Vedno ustvari placila kot 'pending' in preidi v 'completed' po potrditvi procesorja." },
  { id: "H-09", cat: "Varnost", file: "api/delivery/route.ts", desc: "Vsi dostavni endpointi brez avtentikacije in validacije. Napadalec lahko ustvari la\u017ene dostavne zapise ali spremeni status dostave.", fix: "Dodaj requireAuth z take_orders dovoljenjem in Zod validacijo." },
  { id: "H-10", cat: "Varnost", file: "api/cash-register/route.ts", desc: "Kdorkoli lahko odpre/spremeni/zapre blagajno z poljubnimi zneski. Brez avtentikacije in validacije.", fix: "Dodaj requireAuth z manage_cash dovoljenjem in validacijo zneskov." },
  { id: "H-11", cat: "Podatki", file: "api/discounts/[id]/route.ts", desc: "DELETE uporablja hard-delete (db.discount.delete()). Unicei auditni sled popustov, ki so bili aplicirani na naloge/racune.", fix: "Uporabi soft-delete: update({ where: { id }, data: { isActive: false } })." },
  { id: "H-12", cat: "Poslovna logika", file: "api/receipts/[id]/route.ts", desc: "totalWithTip dvakrat pri\u0161teje napitnino: (order.totalWithTip || order.total) + (order.tip || 0). Ce totalWithTip ze vsebuje tip, je napitnina dvakrat.", fix: "Spremeni v: totalWithTip: order.totalWithTip || (order.total + (order.tip || 0))." },
  { id: "H-13", cat: "Varnost", file: "auth-middleware.ts", desc: "hasPermission uporablja some() namesto every(). Za poti, ki zahtevajo vec dovoljenj, zadostuje eno. Npr. uporabnik s samo take_orders lahko dostopa do manage_cash funkcij.", fix: "Spremeni v every() ali na vsaki poti definiraj eno minimalno zahtevano dovoljenje." },
  { id: "H-14", cat: "Varnost", file: "api/print/route.ts", desc: "Tiskalni endpoint brez avtentikacije. Kdorkoli lahko spro\u017ei tiskanje ali videti IP naslove tiskalnikov.", fix: "Dodaj requireAuth z take_orders dovoljenjem. Ne izpostavljaj IP-jev tiskalnikov v odzivu." },
  { id: "H-15", cat: "Poslovna logika", file: "OrderPanel.tsx", desc: "Skupna cena naro\u010dila je lahko negativna, ker popust ni omejen na podznesek. Math.max(0, total) je samo za prikaz, vrednost poslana strezniku nima te za\u0161cite.", fix: "Uporabi Math.min(discount, subtotal) za cap na popustu." },
  { id: "H-16", cat: "Poslovna logika", file: "PaymentDialog.tsx", desc: "Placilo z darilno kartico ne preverja zadostnega stanja. Poslje se totalWithTip kot znesek ne glede na stanje kartice.", fix: "Preveri, da je stanje izbrane darilne kartice >= totalWithTip pred oddajo." },
  { id: "H-17", cat: "Poslovna logika", file: "OrderPanel.tsx", desc: "Obvezne skupine modifikatorjev (required: true) ni mogo\u010de presko\u010diti. Uporabnik lahko doda izdelek brez izbire obveznega modifikatorja.", fix: "Validiraj, da ima vsaka obvezna skupina vsaj minSelect izbir pred potrditvijo." },
  { id: "H-18", cat: "UX", file: "KitchenDisplay.tsx", desc: "Dvojni zvo\u010dni obvestili: WebSocket onEvent in polling data comparison oba predvajata zvok za nov order. Ista naro\u010dila se spro\u017eijo dvakrat.", fix: "Uporabi debounce ali preverjanje timestamp za prepre\u010ditev dvojnega predvajanja." },
  { id: "H-19", cat: "Varnost", file: "11 komponent (OrderPanel, CashRegister, Dashboard, EmployeeManager, SettingsManager, TableMap, itd.)", desc: "11 od 20 komponent uporablja fetch() namesto authFetch(). Podatki dostopni brez avtentikacije.", fix: "Zamenjaj vse fetch() klice z authFetch() v vseh komponentah." },
  { id: "H-20", cat: "Varnost", file: "Sidebar.tsx", desc: "Vsi navigacijski elementi so prikazani vsem uporabnikom ne glede na rolo. Staff uporabnik vidi in lahko dostopa do admin-only zaslonov.", fix: "Filtriraj navItems glede na getCurrentUser()?.permissions in hasPermission()." },
  { id: "H-21", cat: "UX", file: "KioskBar.tsx", desc: "Izstop iz kiosk nacina zahteva API klic za preverjanje PIN. Ce omrezje ne deluje, je naprava trajno zaklenjena v kiosk nacinu.", fix: "Dodaj mehanizem za rezervni izstop (npr. drzite fizicni gumb 10 sekund ali vnesite hardcoded nadomestni PIN)." },
  { id: "H-22", cat: "Poslovna logika", file: "ReceiptDialog.tsx", desc: "Tiskanje se spro\u017ei s setTimeout(300ms/500ms) namesto da bi \u010dakalo na resolucijo mutacije. Ce shranjevanje traja dlje, se racun natisne brez FURS potrjanja.", fix: "Uporabi mutateAsync() in po\u010dakaj na rezultat pred klicem window.print()." },
];

const mediumIssues = [
  { id: "M-01", cat: "Podatki", file: "auth-middleware.ts", desc: "Seje shranjene v pomnilniku (Map). Ob ponovnem zagonu streznika vse seje pote\u010dejo. Vsi zaposleni se morajo ponovno prijaviti.", fix: "Uporabi Redis ali bazo za shranjevanje sej v produkciji." },
  { id: "M-02", cat: "Varnost", file: "api/orders/route.ts GET", desc: "GET endpoint brez auth izpostavi vsa naro\u010dila z imeni strank, telefonskimi stevilkami in podatki o mizah.", fix: "Dodaj auth ali omeji polja odziva za neavtenticirane zahtevke." },
  { id: "M-03", cat: "Varnost", file: "api/gift-cards + loyalty GET", desc: "Vsi stanja darilnih kartic in zvestobnih tock dostopni brez avtentikacije. Napadalec lahko identificira visokovredne kartice.", fix: "Dodaj requireAuth ali omeji na take_orders dovoljenje." },
  { id: "M-04", cat: "Varnost", file: "api/inventory/route.ts POST", desc: "Ustvarjanje inventarja brez avtentikacije in brez Zod validacije. Poljubni podatki v sistemu zalog.", fix: "Dodaj requireAuth z manage_inventory in validateBody(createInventorySchema, body)." },
  { id: "M-05", cat: "Varnost", file: "api/employees/route.ts", desc: "PIN je maskiran, ampak kon\u010dne place, smenska zgodovina in drugi obcutljivi podatki dostopni brez auth.", fix: "Dodaj requireAuth z manage_employees. Omeji polja glede na rolo." },
  { id: "M-06", cat: "Varnost", file: "api/discounts/route.ts POST", desc: "Ustvarjanje popustov brez auth in brez validacije. Napadalec lahko ustvari 100% popust z neomejeno uporabo.", fix: "Dodaj requireAuth z apply_discounts in Zod validacijo." },
  { id: "M-07", cat: "Varnost", file: "api/tables/route.ts", desc: "Ustvarjanje in posodabljanje miz brez auth. Status mize je mogo\u010de spremeniti na 'available' za zasedeno mizo.", fix: "Dodaj requireAuth z take_orders za POST in PUT." },
  { id: "M-08", cat: "Race Condition", file: "api/orders/route.ts", desc: "Posodobitev statusa mize na 'occupied' je zunaj transakcije kreacije naro\u010dila. Dve naro\u010dili lahko isto\u010dasno zasedeta isto mizo.", fix: "Premakni posodobitev statusa mize v transakcijo s kreacijo naro\u010dila." },
  { id: "M-09", cat: "Varnost", file: "api/gift-cards/route.ts POST", desc: "Kdorkoli lahko ustvari darilno kartico s poljubnim stanjem brez avtentikacije.", fix: "Dodaj requireAuth z take_orders dovoljenjem." },
  { id: "M-10", cat: "Varnost", file: "api/loyalty/route.ts POST", desc: "Kdorkoli lahko ustvari zvestobni racun s poljubnim stanjem tock brez avtentikacije.", fix: "Dodaj requireAuth z take_orders dovoljenjem." },
  { id: "M-11", cat: "FURS", file: "counters.ts", desc: "Counter za stevilko racuna se ne ponastavi ob prelomu leta. Januar bo generiral R-2027-005432 namesto R-2027-000001.", fix: "Vkljuci leto v ime countersa (receiptNumber-2027) in ustvari nov counter vsako leto." },
  { id: "M-12", cat: "Varnost", file: "auth-middleware.ts", desc: "Seja se podaljsa ob vsakem zahtevku. Ukraden zeton je veljaven neomejeno dolgo, ce se uporablja vsaj enkrat na 8 ur.", fix: "Uvedi absolutno poteklo (npr. max 24 ur ne glede na aktivnost) poleg idle timeout." },
  { id: "M-13", cat: "FURS", file: "api/furs/route.ts + receipts/[id]/route.ts", desc: "ZOI generiran s SHA-256 ali Math.random(), ne z RSA-SHA256 podpisom davcnega certifikata. Ni skladno s ZDDV-1.", fix: "Implementiraj pravilno generacijo ZOI z .p12 certifikatom in RSA-SHA256 podpisom." },
  { id: "M-14", cat: "Poslovna logika", file: "validations.ts + payments/route.ts", desc: "tipAmount je nastavljiv od stranke brez preverjanja proti check napitnini. Osebje lahko napihne napitnino.", fix: "Validiraj tipAmount proti pri\u010dakovani napitnini ali izracunaj napitnino streznisko." },
  { id: "M-15", cat: "Varnost", file: "api/receipts/[id]/route.ts GET", desc: "GET endpoint vrne polne podatke racuna vkljucno z ZOI, EOR, dav\u010dno stevilko brez avtentikacije.", fix: "Dodaj requireAuth z take_orders dovoljenjem." },
  { id: "M-16", cat: "Poslovna logika", file: "PaymentDialog.tsx", desc: "defaultValue na inputu za prejeto gotovino se ne posodobi, ko se totalWithTip spremeni. Polje ostane na starem znesku.", fix: "Uporabi controlled value + onChange namesto defaultValue." },
  { id: "M-17", cat: "Poslovna logika", file: "PaymentDialog.tsx", desc: "Vsa split placila so hardcoded kot 'cash'. Uporabnik ne more razdeliti placila med razlicne metode.", fix: "Dovoli izbiro metode placila za vsak del ali uporabi trenutno izbrano metodo." },
  { id: "M-18", cat: "Poslovna logika", file: "Dashboard.tsx", desc: "DDV progress bar uporablja neto osnovo (item.base) proti bruto prihodku (todayRevenue). Prikaz je proporcionalno premajhen.", fix: "Uporabi item.base + item.vat za primerjavo z bruto prihodkom." },
  { id: "M-19", cat: "Poslovna logika", file: "InventoryManager.tsx", desc: "Odpis ne preverja, ali kolicina presega trenutno zalogo. Odpis 100 enot pri 10 na zalogi ustvari negativno zalogo.", fix: "Dodaj validacijo: if (quantity > item.quantity) na odjemalcu in strezniku." },
  { id: "M-20", cat: "Poslovna logika", file: "LoyaltyManager.tsx", desc: "Prilagoditev tock (type: 'adjust') lahko ustvari negativno stanje tock, ker ni preverjanja za adjust tip.", fix: "Dodaj preverjanje: if (newPointsBalance < 0) za adjust tip." },
  { id: "M-21", cat: "Poslovna logika", file: "Dashboard.tsx", desc: "Dashboard fetch podatkov brez avtentikacije. Prihodki in poslovni podatki dostopni neavtenticiranim uporabnikom.", fix: "Uporabi authFetch() za dashboard podatke." },
  { id: "M-22", cat: "Poslovna logika", file: "EmployeeManager.tsx", desc: "Obrazec za zaposlene nima polja za PIN. Zaposleni so ustvarjeni, a se ne morejo prijaviti.", fix: "Dodaj PIN vnosno polje (maskirano) v obrazec za zaposlene." },
  { id: "M-23", cat: "Poslovna logika", file: "SettingsManager.tsx", desc: "FURS test je simuliran - preveri samo, ali so polja neprazna. Ni dejanskega klica FURS API-ja.", fix: "Klici strezniski endpoint, ki poskusi vzpostaviti povezavo s FURS testnim okoljem." },
  { id: "M-24", cat: "Poslovna logika", file: "CashRegister.tsx", desc: "Razlika v gotovini je izracunana odjemalsko. Zlonamerni uporabnik lahko manipulira DOM za ponarejanje razlike.", fix: "Izracunaj razliko streznisko na podlagi shranjene pri\u010dakovane gotovine." },
  { id: "M-25", cat: "Poslovna logika", file: "checks/route.ts", desc: "Pri aplikaciji popusta na check se ne preverja validFrom/validTo datumsko obmocje ali isActive status.", fix: "Dodaj validacijo: if (discount.validFrom && new Date() < discount.validFrom) return error." },
  { id: "M-26", cat: "Varnost", file: "payments/route.ts", desc: "Darilna kartica ne preverja expiresAt pri placilu. Potekla kartica s status: 'active' je se vedno uporabna.", fix: "Dodaj preverjanje: if (giftCard.expiresAt && new Date(giftCard.expiresAt) < new Date()) throw error." },
  { id: "M-27", cat: "Podatki", file: "validations.ts", desc: "modifiersJson je nevalidiran JSON string. Lahko vsebuje malformed JSON ali ponarejene ID-je modifikatorjev.", fix: "Razcleni in validiraj JSON proti shemi pred shranjevanjem." },
  { id: "M-28", cat: "Poslovna logika", file: "MenuManager.tsx", desc: "parseFloat(itemForm.price) lahko vrne NaN, ki se pretvori v null. Server morda ne obrne tega, rezultat je menu item z null ceno.", fix: "Validiraj !isNaN(parseFloat(price)) && parseFloat(price) >= 0 pred oddajo." },
  { id: "M-29", cat: "Poslovna logika", file: "InventoryManager.tsx", desc: "parseFloat('-5') || 0 vrne -5. Uporabnik lahko ustvari inventar z negativno kolicino.", fix: "Uporabi Math.max(0, parseFloat(quantity) || 0)." },
  { id: "M-30", cat: "Poslovna logika", file: "MenuManager.tsx", desc: "Brisanje menu itema, ki je referenciran v aktivnih nalogah, lahko povzroci FK kr\u0161itev ali osirotele order items.", fix: "Preveri aktivne naloge pred brisanjem ali uporabi soft-delete." },
  { id: "M-31", cat: "Poslovna logika", file: "SettingsManager.tsx", desc: "Gumb 'Uporabi na vse artikle' nima onClick handlerja. Select komponente uporabljajo defaultValue in niso controlled. Funkcionalnost je kozmeticna.", fix: "Implementiraj mutacijo ali odstrani UI za prepre\u010ditev zmede uporabnikov." },
];

const lowIssues = [
  { id: "L-01", cat: "Koda", file: "escpos.ts", desc: "lineFeed(n) klice String.fromCharCode(n) kjer n > 255 povzroci nepri\u010dakovano obna\u0161anje tiskalnika.", fix: "Clamp n na Math.min(n, 255)." },
  { id: "L-02", cat: "Koda", file: "validations.ts", desc: "positiveNumber uporablja .min(0), kar dovoljuje niclo. Napaka pravi 'mora biti pozitivna', ampak 0 je dovoljena.", fix: "Uporabi .positive() ali preimenuj sporocilo v 'mora biti ne-negativna'." },
  { id: "L-03", cat: "Koda", file: "validations.ts", desc: "createOrderSchema tip nima zgornje meje. Stranka lahko poslje tip: 999999.", fix: "Dodaj .max() na podlagi razumne meje." },
  { id: "L-04", cat: "Koda", file: "checks/route.ts", desc: "Pri aplikaciji popusta na check se ne preverja validFrom/validTo datumsko obmocje ali isActive status.", fix: "Dodaj validacijo datumov in isActive." },
  { id: "L-05", cat: "Koda", file: "store.ts", desc: "cartTotal() odsteje popust od subtotal + tax. Po slovenski DDV zakonodaji se mora popust aplicirati na pred DDV znesek, nato prera\u010dunati DDV.", fix: "Aplikacija popusta na pred-DDV osnovo, nato prera\u010dunaj DDV." },
  { id: "L-06", cat: "Varnost", file: "Vsi API endpointi", desc: "Noben endpoint ne omejuje velikosti request body. Zlonamerna stranka lahko poslje izjemno velik JSON.", fix: "Konfiguriraj Next.js body size limite ali dodaj middleware." },
  { id: "L-07", cat: "Varnost", file: "payments/route.ts in drugi", desc: "Napake lahko izpostavijo interne podrobnosti (DB connection strings, Prisma error details).", fix: "V produkciji vrni genericne napake. Dejavne napake logiraj samo streznisko." },
  { id: "L-08", cat: "Varnost", file: "auth-middleware.ts", desc: "optionalAuth ne preverja dovoljenj. Ce se uporabi na obcutljivi poti, avtenticirani uporabniki obidejo preverjanje dovoljenj.", fix: "Dokumentiraj, da je optionalAuth samo za identifikacijo, ne za avtorizacijo. Auditiraj vse uporabe." },
  { id: "L-09", cat: "Podatki", file: "Vse finan\u010dne poti", desc: "Ni strukturiranega revizijskega dnevnika za placila, povrate, preklice, darilne kartice ali blagajne.", fix: "Implementiraj AuditLog tabelo z employeeId, action, timestamp, previous/new values." },
  { id: "L-10", cat: "UX", file: "KitchenDisplay.tsx", desc: "WaitTimer prikazuje case z natancnostjo do 1 minute. Prikaz je lahko do 59 sekund zastarel.", fix: "Uporabi sekundno natancnost ali sinhroniziraj s strezniskim casom." },
  { id: "L-11", cat: "UX", file: "KioskBar.tsx", desc: "Ura se posodablja vsakih 30 sekund. V kiosk nacinu je to neprofesionalno.", fix: "Posodobi vsako sekundo ali vsakih 10 sekund." },
  { id: "L-12", cat: "UX", file: "PinLogin.tsx", desc: "getCurrentUser() in getAuthToken() imajo stranske ucinke (nastavljajo module-level spremenljivke). Getterji niso cisti.", fix: "Loci bralne in pisne operacije. Naredi getterje ciste." },
  { id: "L-13", cat: "Varnost", file: "PinLogin.tsx", desc: "401 detekcija je odvisna od tocnih sporocil napak (vsebuje 'zeton', 'token', 'potekel'). Sprememba formata streznika prelomi auto-logout.", fix: "Preprosto preveri response.status === 401 brez branja telesa." },
  { id: "L-14", cat: "UX", file: "Sidebar.tsx", desc: "Dva lo\u010dena API klica za stevilo pending in in-progress nalog. Namenski count endpoint bi bil bolj ucinkovit.", fix: "Uporabi /api/orders/count?statuses=pending,in-progress." },
  { id: "L-15", cat: "Koda", file: "next.config.ts", desc: "ignoreBuildErrors: true in reactStrictMode: false skrivata potencialne napake in tezave z React.", fix: "Odstrani ignoreBuildErrors in omogoci reactStrictMode za razvoj." },
  { id: "L-16", cat: "Koda", file: "package.json", desc: "Nekatere neuporabljene odvisnosti: next-auth, @mdxeditor/editor, react-markdown, z-ai-web-dev-sdk, uuid.", fix: "Odstrani neuporabljene pakete za zmanjsanje velikosti." },
  { id: "L-17", cat: "Koda", file: "ESLint konfiguracija", desc: "ESLint je skoraj v celoti onemogocen. Brez vsiljevanja kakovosti kode.", fix: "Omogoci osnovna ESLint pravila za doslednost kode." },
  { id: "L-18", cat: "UX", file: "StornoDialog.tsx", desc: "Potrditveno besedilo 'PREKLI\u010cI' vsebuje ne-ASCII znak. Na tablicnih tipkovnicah je tezko vnesti.", fix: "Sprejmi neobcutljivo na velikost crk in normaliziraj diakritiko." },
  { id: "L-19", cat: "UX", file: "KitchenDisplay.tsx", desc: "Dynamic hover: classes (hover:${config.bg}) se ne prevedejo v Tailwind JIT. Hover ucinek manjka v produkciji.", fix: "Uporabi pogojne staticne razrede ali inline stile." },
];

function buildIssueSection(title, issues, level) {
  const children = [heading(title, HeadingLevel.HEADING_1)];
  
  issues.forEach((issue, idx) => {
    // Issue header with ID and severity
    children.push(new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({ text: `${issue.id}  `, bold: true, size: 24, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } }),
        severityBadge(level),
        new TextRun({ text: `  ${issue.cat}`, size: 22, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
      ]
    }));
    
    children.push(boldBodyPara("Datoteka: ", issue.file));
    children.push(bodyPara(issue.desc));
    children.push(boldBodyPara("Popravek: ", issue.fix));
    
    if (idx < issues.length - 1) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0", space: 10 } },
        spacing: { after: 80 },
        children: []
      }));
    }
  });
  
  return children;
}

// Summary table
function buildSummaryTable() {
  const headerRow = issueRow(["Stopnja", "Stevilo", "Varnost", "Race Condition", "Poslovna logika", "Podatki / FURS"], true);
  const rows = [
    ["Kriticna", "14", "4", "3", "5", "2"],
    ["Visoka", "22", "8", "1", "8", "5"],
    ["Srednja", "31", "7", "1", "16", "7"],
    ["Nizka", "19", "3", "0", "2", "14"],
    ["SKUPAJ", "94", "22", "5", "31", "28"],
  ].map(r => issueRow(r));
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...rows],
  });
}

// Priority fix table
function buildPriorityTable() {
  const headerRow = issueRow(["Prioriteta", "ID", "Opis", "Vpliv"], true);
  const rows = [
    ["1", "C-01", "Seed route brez auth", "Izbris celotne baze"],
    ["2", "C-02", "Cene nastavljive od stranke", "Poljubne cene izdelkov"],
    ["3", "C-05 + C-14", "Placila brez auth", "Finan\u010dna manipulacija"],
    ["4", "C-03 + C-09", "Race condition kartice/tocke", "Negativno stanje, dvojno porocanje"],
    ["5", "C-08", "DDV prera\u010dun pri popustih", "FURS neustreznost racunov"],
    ["6", "C-04", "Dvojni odbitek zaloge", "Napa\u010dna zaloga, negativne vrednosti"],
    ["7", "H-03", "Prehod stanj naro\u010dila", "Dvojni odbitek, napacna porocila"],
    ["8", "H-13", "hasPermission some() vs every()", "Eskalacija pravic"],
    ["9", "H-19", "11 komponent brez authFetch", "Podatki dostopni brez auth"],
    ["10", "H-07 + H-14", "FURS + print brez auth", "Neavtorizirano dav\u010dno potrjevanje"],
  ].map(r => issueRow(r));
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...rows],
  });
}

// Build document
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.primary) },
      },
    }
  },
  sections: [
    // Cover section
    {
      properties: {
        page: { margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCover(),
    },
    // TOC section
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN }
        },
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] })
      },
      children: [
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Kazalo", size: 36, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })] }),
        new TableOfContents("Kazalo", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ children: [new PageBreak()] }),
      ]
    },
    // Body section
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL }
        },
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] })
      },
      children: [
        // Executive Summary
        heading("Povzetek revizije"),
        bodyPara("Ta dokument predstavlja celovito revizijo varnosti in kode sistema RestaurantOS POS, ki temelji na Next.js 16, Prisma ORM in SQLite. Revizija je bila izvedena s podrobnim pregledom 24 strezniskih datotek in 20 odjemalskih komponent, ter s spletnim raziskovanjem najboljsih praks za restavracijske POS sisteme, slovenske FURS zahteve in Toast POS OpenAPI standarde."),
        bodyPara("Skupaj je bilo identificiranih 94 napak razdeljenih v stiri stopnje resnosti: 14 kriticnih, 22 visokih, 31 srednjih in 19 nizkih. Kriticne napake vkljuccujejo neprotitrane API endpointe, race condition pri finančnih transakcijah, nepravilno racunanje DDV pri popustih in možnost manipulacije cen s stranke. Te napake zahtevajo takojšnje popravljanje, saj ogrožajo poslovanje in skladnost s slovensko davčno zakonodajo."),
        bodyPara("Najpomembnejša ugotovitev revizije je, da 11 od 20 odjemalskih komponent uporablja fetch() namesto authFetch(), kar pomeni, da se velik del podatkov (meniji, cene, naročila, zaposleni, blagajna) lahko dostopa brez avtentikacije. Prav tako so skoraj vsi finančni API endpointi (placila, darilne kartice, zvestoba, blagajna, dostava) brez ustreznega preverjanja avtentikacije in dovoljenj."),
        
        heading("Pregled resnosti"),
        bodyPara("Spodnja tabela prikazuje porazdelitev najdenih napak po stopnji resnosti in kategoriji:"),
        buildSummaryTable(),
        
        heading("Prioritetni vrstni red popravkov"),
        bodyPara("Naslednja tabela prikazuje predlagani vrstni red popravkov glede na resnost in vpliv na poslovanje. Priporocamo, da se kriticne napake popravijo v roku enega tedna, visoke v dveh tednih in srednje v enem mesecu:"),
        buildPriorityTable(),
        
        // Critical issues
        ...buildIssueSection("Kriticne napake (14)", criticalIssues, "CRITICAL"),
        
        // High issues
        ...buildIssueSection("Visoke napake (22)", highIssues, "HIGH"),
        
        // Medium issues
        ...buildIssueSection("Srednje napake (31)", mediumIssues, "MEDIUM"),
        
        // Low issues
        ...buildIssueSection("Nizke napake (19)", lowIssues, "LOW"),
        
        // Recommendations
        heading("Priporocila za izboljsave"),
        heading("Avtentikacija in avtorizacija", HeadingLevel.HEADING_2),
        bodyPara("Trenutni avtentikacijski sistem temelji na PIN-ih z bcrypt hashiranje in pomnilniskimi sejami. Priporocamo naslednje izboljsave: (1) Migracija vseh sej v Redis ali bazo za persistenco ob ponovnem zagonu streznika. (2) Uvedba JWT z access in refresh tokeni za boljso skalabilnost. (3) Dodajanje MFA za admin operacije v skladu s PCI DSS v4.0. (4) Implementacija centralized auth middleware na Next.js ravni namesto individualnega preverjanja na vsakem endpointu. (5) Pravilno implementacija hasPermission z every() logic za vse poti, ki zahtevajo vec dovoljenj."),
        
        heading("FURS skladnost", HeadingLevel.HEADING_2),
        bodyPara("Trenutna FURS implementacija je simulirana in ne izpolnjuje zahtev ZDDV-1. Za polno skladnost je potrebno: (1) Implementirati pravilno generacijo ZOI z RSA-SHA256 podpisom davcnega certifikata (.p12 format). (2) Povezava s FURS testnim okoljem (blagajne-test.fu.gov.si:9002) za preverjanje. (3) Pravilno generacijo EOR iz JWT odziva FURS. (4) QR kodo na racunih s prepare_printable formatom. (5) Tridelno stevilcenje racunov (poslovni prostor / elektronska naprava / zaporedna stevilka). (6) Letno ponastavljanje stevcev racunov. (7) Pravilno racunanje DDV pri popustih - popust zmanjsa obdavceno osnovo, DDV se pravilno preračuna."),
        
        heading("Race conditions in transakcijska integriteta", HeadingLevel.HEADING_2),
        bodyPara("SQLite ima pomembne omejitve pri sočasnem pisanju. Za rešitev race conditions priporocamo: (1) Uporabo Prisma interactive transactions z ustreznim isolation levelom za vse finančne operacije. (2) Atomarno posodabljanje stanj z decrement/increment in preverjanjem prizadetih vrstic namesto branja in pisanja v dveh korakih. (3) Centralizirano funkcijo za odbitek zaloge z idempotenca kljucem za preprečitev dvojnega odbitka. (4) Strežniško izračunavanje vseh finančnih zneskov (stanja kartic, točke, razlike v gotovini) namesto odjemalskega pošiljanja končnih vrednosti."),
        
        heading("Arhitekturna izboljsava", HeadingLevel.HEADING_2),
        bodyPara("Za dolgorocno stabilnost sistema priporocamo naslednje arhitekturne spremembe: (1) Migracija s SQLite na PostgreSQL za podporo sočasnemu pisanju, advisory locks in SERIALIZABLE isolation level. (2) Uvedba auditne tabele (AuditLog) za sledenje vseh finančnih operacij v skladu z računovodskimi standardi. (3) Implementacija soft-delete za vse finančne entitete (popusti, zaposleni, mize) namesto hard-delete. (4) Centraliziran service layer za poslovno logiko namesto neposrednih Prisma klicev v API routes. (5) Paginacija na vseh list endpointih za preprečitev pomnilniških težav pri velikih podatkovnih setih."),
      ]
    }
  ]
});

const outputPath = "/home/z/my-project/download/RestaurantOS_POS_Revizija_2026.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outputPath, buf);
  console.log("Report generated:", outputPath);
});
