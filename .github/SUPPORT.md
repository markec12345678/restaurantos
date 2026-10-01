# Podpora — RestaurantOS

Izhodiščna točka za podporo pri uporabi, namestitvi in obratovanju RestaurantOS-a.
Ta dokument NE podvaja vsebin drugih dokumentov — preslika potrebo na kanal in
izvor resnice (enoten vir resnice; vsako podvajanje števil = drift).

## 📘 Kje začeti

| Potreba | Kanal | Izvor resnice |
|---------|-------|---------------|
| Incident v produkcijskem obratu (P1/P2) | Kanali po tier-ju | [docs/SLA.md](../docs/SLA.md) §2 (odzivni časi) + §6 (kanali) |
| Vprašanje o uporabi / onboarding stranke | Email po tier-ju | [docs/CLIENT-ONBOARDING-GUIDE.md](../docs/CLIENT-ONBOARDING-GUIDE.md) |
| Varnostna ranljivost | **NIKOLI javni GitHub Issues** | [SECURITY.md](../SECURITY.md) + `.github/ISSUE_TEMPLATE/security_report.yml` |
| Znana težava (preveri PRED prijavo) | — | [docs/KNOWN_ISSUES.md](../docs/KNOWN_ISSUES.md) |
| Deployment / infrastruktura | Runbook | [docs/PRODUCTION-DEPLOYMENT-RUNBOOK.md](../docs/PRODUCTION-DEPLOYMENT-RUNBOOK.md) |
| Izguba podatkov / obnova | DR postopek | [docs/DISASTER-RECOVERY.md](../docs/DISASTER-RECOVERY.md) |
| Funkcijske želje | GitHub Issues | `.github/ISSUE_TEMPLATE/feature_request.yml` |
| Bug report | GitHub Issues | `.github/ISSUE_TEMPLATE/bug_report.yml` |

## ⏱️ Odzivni časi, tier-ji in kontaktni kanali

Definirani v [docs/SLA.md](../docs/SLA.md) §2 in §6 (Standard / Priority /
Enterprise). Ta dokument jih namenoma NE ponavlja — SLA.md je edini vir
resnice za številke.

## 🐞 Prijava napake

1. Preveri [docs/KNOWN_ISSUES.md](../docs/KNOWN_ISSUES.md) — težava je morda že znana.
2. Odpreš issue prek `.github/ISSUE_TEMPLATE/bug_report.yml` (koraki, pričakovano/dejansko, verzija iz `package.json`).
3. Varnostna vprašanja ZAVEDNO prek [SECURITY.md](../SECURITY.md) postopka — ne prek javnih issues.

## 🔑 Demo / test okolja

Demo in sandbox okolja uporabljajo seed kredence, ki so izrecno označeni
**DEMO / TEST ONLY** (demoPinPolicy v [docs/PRODUCT-STATUS.md](../docs/PRODUCT-STATUS.md)).
Produkcija VEDNO z unikatnimi močnimi PIN-i — seed kredenc ne uporabljaj
v produkcijskem okolju.

## 🧾 Avtoritativni status produkta

Trenutni HEAD, test evidence in znane omejitve (FURS fizikalna validacija,
plačilni terminal, tiskalnik): [docs/PRODUCT-STATUS.md](../docs/PRODUCT-STATUS.md)
in [docs/PRODUCTION-VALIDATION.md](../docs/PRODUCTION-VALIDATION.md) §2.

Pregled vsega release/support/runbook materiala (inventar + register vrzeli):
[docs/RELEASE-SUPPORT-INDEX.md](../docs/RELEASE-SUPPORT-INDEX.md).
