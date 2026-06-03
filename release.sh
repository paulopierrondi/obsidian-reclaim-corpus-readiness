#!/usr/bin/env bash
set -euo pipefail

# RECLAIM Obsidian Plugin — Release script
# Usage: bash release.sh [patch|minor|major]
# Requires: git, npm, gh (GitHub CLI)

VERSION_TYPE="${1:-patch}"

# Validate
if [[ "$VERSION_TYPE" != "patch" && "$VERSION_TYPE" != "minor" && "$VERSION_TYPE" != "major" ]]; then
  echo "Usage: bash release.sh [patch|minor|major]" >&2
  exit 2
fi

# Ensure clean worktree
if [[ -n "$(git status --short)" ]]; then
  echo "error: worktree is dirty. Commit changes first." >&2
  exit 1
fi

# Read current version
CURRENT_VERSION=$(node -p "require('./manifest.json').version")
echo "Current version: $CURRENT_VERSION"

# Bump version (simple semver)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
case "$VERSION_TYPE" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
esac
NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "New version: $NEW_VERSION"

# Update manifest.json
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
m.version = '$NEW_VERSION';
fs.writeFileSync('manifest.json', JSON.stringify(m, null, '\t') + '\n');
"

# Update versions.json
node -e "
const fs = require('fs');
const v = fs.existsSync('versions.json') ? JSON.parse(fs.readFileSync('versions.json', 'utf8')) : {};
v['$NEW_VERSION'] = '0.15.0';
fs.writeFileSync('versions.json', JSON.stringify(v, null, '\t') + '\n');
"

# Update package.json
node -e "
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
"

# Build (if source exists)
if [[ -f "esbuild.config.mjs" ]]; then
  echo "==> Building plugin"
  npm run build
else
  echo "warning: no esbuild.config.mjs; skipping build. Ensure main.js is up to date."
fi

# Commit
 git add manifest.json versions.json package.json main.js styles.css
 git commit -m "Release v$NEW_VERSION"

# Tag
 git tag "$NEW_VERSION"

echo ""
echo "Release v$NEW_VERSION ready locally."
echo ""
echo "Next steps:"
echo "  1. git push origin main"
echo "  2. git push origin $NEW_VERSION"
echo "  3. gh release create $NEW_VERSION main.js manifest.json styles.css --title \"v$NEW_VERSION\" --notes \"Release v$NEW_VERSION\""
echo "  4. Submit at https://community.obsidian.md (if not already submitted)"
