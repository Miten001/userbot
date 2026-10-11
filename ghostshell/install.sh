#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  GhostShell — installer (Linux / macOS)
#
#    curl -fsSL https://miten001.github.io/userbot/install.sh | bash
#
#  Installs to ~/.ghostshell and prints the extension-load instructions.
#  Re-running it upgrades in place and leaves your config file alone.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="Miten001/userbot"
BRANCH="uncheck"
SITE="https://miten001.github.io/userbot"
DEST="${GHOSTSHELL_HOME:-$HOME/.ghostshell}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say()  { printf '\033[1;36m  %s\033[0m\n' "$*"; }
good() { printf '\033[32m  ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$*"; }
die()  { printf '\033[31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

printf '\n\033[1mGhostShell installer\033[0m\n\n'

command -v curl >/dev/null 2>&1 || die "curl is required."

say "Installing to $DEST"
mkdir -p "$DEST"

# ── fetch ────────────────────────────────────────────────────────────────
FETCHED=0
if curl -fsSL --max-time 60 "$SITE/ghostshell.tar.gz" -o "$TMP/gs.tgz" 2>/dev/null; then
  tar -xzf "$TMP/gs.tgz" -C "$TMP" 2>/dev/null && FETCHED=1
fi

if [[ "$FETCHED" != "1" ]]; then
  warn "package download failed, falling back to git"
  command -v git >/dev/null 2>&1 || die "git is required for the fallback install."
  rm -rf "$TMP/src"
  if git clone --depth 1 --single-branch --branch "$BRANCH" \
       "https://github.com/$REPO.git" "$TMP/src" 2>/dev/null; then
    [[ -d "$TMP/src/ghostshell" ]] || die "ghostshell/ not found in the repository."
    mkdir -p "$TMP/ghostshell"
    cp -R "$TMP/src/ghostshell/." "$TMP/ghostshell/"
    FETCHED=1
  fi
fi

[[ -f "$TMP/ghostshell/launch/ghostshell.sh" ]] || die "download did not contain ghostshell/."

# ── install ──────────────────────────────────────────────────────────────
# Never clobber a config the user has already edited.
if [[ -f "$DEST/launch/ghostshell.conf" ]]; then
  cp "$TMP/ghostshell/launch/ghostshell.conf" "$TMP/ghostshell/launch/ghostshell.conf.new"
  cp "$DEST/launch/ghostshell.conf" "$TMP/ghostshell/launch/ghostshell.conf"
fi

mkdir -p "$DEST/launch" "$DEST/extension" "$DEST/tools" "$DEST/relay" "$DEST/site"
cp -R "$TMP/ghostshell/launch/."    "$DEST/launch/"
cp -R "$TMP/ghostshell/extension/." "$DEST/extension/"
cp -R "$TMP/ghostshell/tools/."     "$DEST/tools/"
cp -R "$TMP/ghostshell/relay/."     "$DEST/relay/"
[[ -d "$TMP/ghostshell/site" ]] && cp -R "$TMP/ghostshell/site/." "$DEST/site/"
for f in README.md CHANGELOG.md; do
  [[ -f "$TMP/ghostshell/$f" ]] && cp "$TMP/ghostshell/$f" "$DEST/$f"
done

chmod +x "$DEST/launch/ghostshell.sh" \
         "$DEST/launch/ghostshell.command" \
         "$DEST/tools/preflight.sh" \
         "$DEST/tools/relay.sh" \
         "$DEST/tools/make_icons.py" 2>/dev/null || true

good "files installed"

# ── symlink onto PATH ────────────────────────────────────────────────────
LINK_DIR="$HOME/.local/bin"
mkdir -p "$LINK_DIR" 2>/dev/null || true
if [[ -d "$LINK_DIR" ]]; then
  ln -sf "$DEST/launch/ghostshell.sh" "$LINK_DIR/ghostshell" 2>/dev/null && {
    good "linked $LINK_DIR/ghostshell"
    case ":$PATH:" in
      *":$LINK_DIR:"*) ;;
      *) warn "$LINK_DIR is not on your PATH. Add it:";
         say "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.$(basename "$SHELL")rc" ;;
    esac
  }
fi

# ── done ─────────────────────────────────────────────────────────────────
cat <<EOF

  ────────────────────────────────────────────────────────────
  Next: load the GhostShell Shield extension (once)

    1. Launch GhostShell:   $DEST/launch/ghostshell.sh
    2. Open   chrome://extensions
    3. Enable "Developer mode" (top right)
    4. "Load unpacked"  →  select  $DEST/extension
    5. Pin the shield icon, then set your exit country in the popup

  Then verify you are clean:
    $DEST/tools/preflight.sh

  Optional — in-site browser (search + rewrite viewer + proxy manager):
    $DEST/tools/relay.sh --open      # needs Node.js 18+

  ────────────────────────────────────────────────────────────
EOF
