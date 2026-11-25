#!/usr/bin/env bash
# Deploy dotfiles for a specific environment
#
# Usage: ./deploy.sh [work|personal]
#   or:  ./deploy.sh          # auto-detect from hostname

set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DOTFILES_DIR"

ENV="${1:-}"

if [[ -z "$ENV" ]]; then
    # Auto-detect from hostname
    HOST="$(hostname)"
    case "$HOST" in
        *work*|*office*|*corp*) ENV="work" ;;
        *) ENV="personal" ;;
    esac
    echo "Auto-detected environment: $ENV (hostname: $HOST)"
fi

case "$ENV" in
    work|personal)
        echo "Deploying for $ENV environment..."
        stow -D common work personal 2>/dev/null || true
        stow common "$ENV"
        echo "Done! Run 'stow common $ENV' again after pulling changes."
        ;;
    *)
        echo "Usage: $0 [work|personal]"
        echo "  work      - Deploy work configuration"
        echo "  personal  - Deploy personal configuration"
        echo "  (empty)   - Auto-detect from hostname"
        exit 1
        ;;
esac