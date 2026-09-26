# Display — gostovski zaslon tabla (epic #115 P1-12, R136-c)

Javni, read-only zaslon aktivnih naročil za TV/presežnico v gostilni.
Prikazuje številko naročila, status, tip servisiranja, čas oddaje in
številko mize. **Guest-safe: brez PII** — strežnik (R136-b) pošilja SAMO
whitelist polja (`orderNumber`, `status`, `type`, `tableNumber`,
`createdAt`); imena, telefoni, cene in opombe nikoli ne pridejo do UI.

## Deep link

```
/display?loc=<locationId>
```

- `loc` (obvezen) — ID lokacije; regex `[a-z0-9]{5,50}`, fail-closed
  (manjkajoč/napačen/neobstoječ → ConfigError zaslon z navodilom skrbniku).
- `name` (opcijski) — prikazno ime v glavi (`Naročila — <name>`); strežniški
  kontrakt ne vrača imena lokacije, zato ga nastavi skrbnik v URL.
  Primer: `/display?loc=locKioskA&name=Center`

Kontekst se persistira v sessionStorage (`display-context`) — refresh brez
URL-ja ohrani nastavitev (vzor kiosk-context).

## Kako najti locationId

Staff aplikacija → **Lokacije** (modul LocationManager, admin). ID lokacije
je viden v urejevalniku lokacije; lokacija mora biti aktivna.

## Priporočen način zagona (kiosk)

1. Chrome/Chromium na TV napravi, odpri deep link.
2. `F11` za celozaslon (ali zagon z `--kiosk` zastavico).
3. Zaslon teče nedoločeno: poll 10 s, takojšen refetch ob vrnitvi v
   vidnost/focus, stale-while-error (obdrži zadnje stanje + oznaka
   `Trenutno brez povezave`), self-heal: 5 zaporednih napak → samodejni
   reload. **Brez idle-reset** (nasprotje kiosku — tabla ni interaktivna).

## Tehnično

- Kontrakt: `GET /api/public/display?locationId=<id>` →
  `{ orders: [{ orderNumber, status, type, tableNumber, createdAt }], timestamp }`,
  `Cache-Control: no-store` (R136-b).
- Statusi (barvna pariteta `src/app/order-status/[orderId]/constants.ts`):
  pending → Oddano (blue), in-progress → V pripravi (amber),
  ready → Pripravljeno za prevzem (emerald), neznani → nevtralna siva.
- `aria-live="polite"` na seznamu; velika tipografija za TV razdaljo;
  hardcoded slovenščina (javna stran — kiosk kanon, brez staff i18n).
