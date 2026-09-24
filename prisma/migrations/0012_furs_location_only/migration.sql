-- 0012_furs_location_only — ISSUE #37 (R125): FURS konfiguracija = Location only
--
-- Kanon: FURS zahteva registracijo vsakega poslovnega prostora (premises)
-- posebej → per-lokacija konfiguracija na Location modelu je edini vir.
-- Globalni RestaurantSettings.fursCertPath/fursCertPassword/fursEnvironment
-- so MRTVA polja (koda jih ne bere/ne piše več; odstranitev v v1.0.0 cleanup).
--
-- Ta migracija preseli ne-prazne globalne vrednosti na aktivne lokacije,
-- katerih lastna fursCertPath je še prazna — tako noben deployment ne izgubi
-- fiskalizacije ob preklopu kode na Location-only branje.
--
-- Idempotentno: UPDATE samo vrstic s prazno lokacijsko fursCertPath.

UPDATE "Location" l SET
  "fursCertPath"     = s."fursCertPath",
  "fursCertPassword" = s."fursCertPassword",
  "fursEnvironment"  = s."fursEnvironment"
FROM "RestaurantSettings" s
WHERE l."isActive" = true
  AND s."fursCertPath" <> ''
  AND (l."fursCertPath" = '' OR l."fursCertPath" IS NULL);
