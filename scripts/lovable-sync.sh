#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/lovable-sync.sh --remote <remote> [--branch <branch>] [--message <commit-message>] [--yes]

Description:
  Creates a single squashed commit from your current working tree and force-pushes it
  to the target remote/branch. Local commit history on your current branch is preserved.

Options:
  --remote   Git remote name (required), e.g. origin or lovable
  --branch   Remote branch to overwrite (default: current branch)
  --message  Commit message for the squashed commit
             (default: "chore: sync complete repository state to Lovable")
  --yes      Skip confirmation prompt
  -h, --help Show this help
USAGE
}

REMOTE=""
BRANCH=""
MESSAGE="chore: sync complete repository state to Lovable"
ASSUME_YES="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote)
      REMOTE="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH="${2:-}"
      shift 2
      ;;
    --message)
      MESSAGE="${2:-}"
      shift 2
      ;;
    --yes)
      ASSUME_YES="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$REMOTE" ]]; then
  echo "Error: --remote is required." >&2
  usage
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "Error: remote '$REMOTE' does not exist in this repository." >&2
  echo "Tip: add one first, e.g. git remote add lovable <url>" >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "Error: detached HEAD is not supported for this script." >&2
  exit 1
fi

if [[ -z "$BRANCH" ]]; then
  BRANCH="$CURRENT_BRANCH"
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: you have uncommitted changes. Commit or stash first." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d%H%M%S)"
TMP_BRANCH="lovable-sync-$STAMP"

cleanup() {
  local exit_code=$?

  if git rev-parse --verify "$CURRENT_BRANCH" >/dev/null 2>&1; then
    git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
  fi

  if git rev-parse --verify "$TMP_BRANCH" >/dev/null 2>&1; then
    git branch -D "$TMP_BRANCH" >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}
trap cleanup EXIT

if [[ "$ASSUME_YES" != "true" ]]; then
  echo "This will force-push a single squashed commit to $REMOTE/$BRANCH."
  read -r -p "Continue? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Build a one-commit branch from current tree snapshot without rewriting your branch.
git checkout --orphan "$TMP_BRANCH" >/dev/null

# Clear index/worktree metadata from old history and stage full snapshot.
git reset --mixed >/dev/null
git add -A

if git diff --cached --quiet; then
  echo "Nothing to commit: repository tree is empty." >&2
  exit 1
fi

git commit -m "$MESSAGE" >/dev/null

git push --force "$REMOTE" "HEAD:$BRANCH"

echo "✅ Synced current repository state as one commit to $REMOTE/$BRANCH"
