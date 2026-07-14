#!/usr/bin/env bash
# ============================================
# RestaurantOS — Čiščenje .env iz git zgodovine
# ============================================
# Skripta odstrani .env datoteko iz VSE git zgodovine,
# ker je bil .env (z neškodljivo vsebino) commitan v 3 commitih.
#
# POZOR: Ta operacija PREPISUJE ZGODOVINO.
# Vsi, ki so klonirali repo, morajo ponovno klonirati.
#
# Uporablja git-filter-repo (priporočeno nadomestilo za BFG).
#
# Namestitev:
#   pip install git-filter-repo
#   ALI: brew install git-filter-repo
#   ALI: apt install git-filter-repo
#
# Uporaba:
#   1. Naredi backup: cp -r restaurantos restaurantos-backup
#   2. Zaženi: bash scripts/clean-history.sh
#   3. Force push: git push --force --all
#                  git push --force --tags
# ============================================

set -euo pipefail

echo "=== RestaurantOS — čiščenje git zgodovine ==="
echo ""
echo "Ta skripta bo ODSTRANILA .env iz celotne git zgodovine."
echo "Vsi commit hash-i se bodo spremenili."
echo "Vsi, ki so klonirali repo, morajo ponovno klonirati."
echo ""
read -p "Si prepričan? (vpiši DA): " confirm
if [ "$confirm" != "DA" ]; then
  echo "Preklicano."
  exit 1
fi

echo ""
echo "=== 1. Preveri, da je git-filter-repo nameščen ==="
if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "❌ git-filter-repo ni nameščen."
  echo "   Namesti z:  pip install git-filter-repo"
  echo "         ali:  brew install git-filter-repo"
  exit 1
fi

echo "=== 2. Preveri, da smo v git repozitoriju ==="
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "❌ Nismo v git repozitoriju."
  exit 1
fi

echo "=== 3. Ustvari backup veje (varnostna kopija) ==="
BACKUP_BRANCH="backup/pre-history-rewrite-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP_BRANCH"
echo "✅ Backup veja ustvarjena: $BACKUP_BRANCH"
echo "   (če gre kaj narobe, lahko obnoviš z: git reset --hard $BACKUP_BRANCH)"

echo ""
echo "=== 4. Zaženi git-filter-repo — odstrani .env ==="
git filter-repo \
  --invert-paths \
  --path .env \
  --path .env.local \
  --path .env.production \
  --path .env.development \
  --force

echo ""
echo "=== 5. Preveri, da je .env odstranjen iz zgodovine ==="
if git log --all -- .env | grep -q .; then
  echo "⚠️  .env še vedno najden v zgodovini — preveri ročno."
else
  echo "✅ .env je popolnoma odstranjen iz zgodovine."
fi

echo ""
echo "=== 6. Počisti reflog in garbage collect ==="
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "=== 7. Status ==="
echo "Backup veja: $BACKUP_BRANCH"
echo ""
echo "Naslednji koraki:"
echo "  1. Preveri, da projekt še vedno build-a:  bun install && bun run build"
echo "  2. Force push v origin:"
echo "     git push --force --all"
echo "     git push --force --tags"
echo "  3. Obvesti vse, ki so klonirali repo, naj ponovno klonirajo."
echo "  4. Ko potrdiš, da je vse v redu, lahko zbrišeš backup vejo:"
echo "     git branch -D $BACKUP_BRANCH"
echo ""
echo "✅ Končano."
