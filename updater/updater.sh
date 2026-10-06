#!/bin/sh
# LocalHub-Updater: führt auf Anforderung der Web-App (Admin-Panel) ein Update
# aus GitHub durch. Kommunikation ausschließlich über das geteilte Volume
# /updates (request → status.json / update.log); die App selbst hat keinen
# Docker-Zugriff. Aktualisiert wird nur der Dienst "app" (Datenbank und dieser
# Updater bleiben unberührt; Änderungen am Updater selbst erfordern manuell
# `docker compose up -d --build updater`).
REPO=/repo
DIR=/updates
BRANCH="${UPDATE_BRANCH:-main}"

git config --global --add safe.directory "$REPO"
mkdir -p "$DIR"

clean() { printf '%s' "$1" | tr -d '"\\' | tr '\n\r\t' '   ' | cut -c1-160; }

status() { # state message
  cur=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null)
  lat=$(git -C "$REPO" rev-parse --short "origin/$BRANCH" 2>/dev/null)
  behind=$(git -C "$REPO" rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo 0)
  subj=$(clean "$(git -C "$REPO" log -1 --format=%s "origin/$BRANCH" 2>/dev/null)")
  printf '{"state":"%s","message":"%s","current":"%s","latest":"%s","behind":%s,"latestSubject":"%s","updatedAt":"%s"}\n' \
    "$1" "$(clean "$2")" "$cur" "$lat" "${behind:-0}" "$subj" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > "$DIR/status.json.tmp" && mv "$DIR/status.json.tmp" "$DIR/status.json"
}

do_check() {
  status checking "Prüfe auf Updates…"
  if git -C "$REPO" fetch origin "$BRANCH" >"$DIR/check.log" 2>&1; then
    status idle "Prüfung abgeschlossen."
  else
    status error "git fetch fehlgeschlagen: $(tail -n1 "$DIR/check.log")"
  fi
}

do_update() {
  : > "$DIR/update.log"
  {
    status running "Hole Änderungen von GitHub…"
    if [ -n "$(git -C "$REPO" status --porcelain --untracked-files=no)" ]; then
      echo "Arbeitsverzeichnis hat lokale Änderungen – Abbruch."
      status error "Lokale Änderungen im Repo auf dem Server – Update abgebrochen."
      return
    fi
    old=$(git -C "$REPO" rev-parse HEAD)
    if ! git -C "$REPO" fetch origin "$BRANCH" || ! git -C "$REPO" merge --ff-only "origin/$BRANCH"; then
      git -C "$REPO" merge --abort 2>/dev/null
      status error "git pull fehlgeschlagen (kein Fast-Forward?)."
      return
    fi
    if [ "$old" = "$(git -C "$REPO" rev-parse HEAD)" ]; then
      status idle "Bereits aktuell."
      return
    fi
    project=$(docker inspect "$(hostname)" --format '{{index .Config.Labels "com.docker.compose.project"}}')
    status running "Baue neues Image und starte die App neu… (kann einige Minuten dauern)"
    if docker compose -p "$project" --project-directory "$REPO" -f "$REPO/docker-compose.yml" up -d --build app; then
      docker image prune -f >/dev/null 2>&1
      status success "Update eingespielt."
    else
      echo "Build/Start fehlgeschlagen – setze Code auf $old zurück."
      git -C "$REPO" reset --hard "$old"
      status error "Build fehlgeschlagen – Code zurückgesetzt, die laufende Version bleibt aktiv."
    fi
  } >> "$DIR/update.log" 2>&1
}

do_check
while true; do
  if [ -f "$DIR/request" ]; then
    action=$(cat "$DIR/request")
    rm -f "$DIR/request"
    case "$action" in
      check) do_check ;;
      update) do_update ;;
    esac
  fi
  sleep 3
done
