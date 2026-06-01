#!/usr/bin/env bash

set -euo pipefail

validate_remote_app_dir() {
  [[ -n "${REMOTE_APP_DIR:-}" ]] || {
    echo "PRODUCTION_REMOTE_APP_DIR must not be empty" >&2
    return 1
  }
  [[ "$REMOTE_APP_DIR" != "/" ]] || {
    echo "PRODUCTION_REMOTE_APP_DIR must not be /" >&2
    return 1
  }
  [[ "$REMOTE_APP_DIR" != *..* && "$REMOTE_APP_DIR" != *~* ]] || {
    echo "PRODUCTION_REMOTE_APP_DIR must not contain .. or ~" >&2
    return 1
  }
  [[ "$REMOTE_APP_DIR" != -* && "$REMOTE_APP_DIR" != */-* ]] || {
    echo "PRODUCTION_REMOTE_APP_DIR must not contain path segments starting with -" >&2
    return 1
  }
  [[ "$REMOTE_APP_DIR" =~ ^[A-Za-z0-9._/-]+$ ]] || {
    echo "PRODUCTION_REMOTE_APP_DIR must use safe path characters" >&2
    return 1
  }
}
