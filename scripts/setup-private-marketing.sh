#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

initialize_command="git -c submodule.voxr_marketing.update=checkout submodule update --init -- voxr_marketing"

if ! git -c submodule.voxr_marketing.update=checkout submodule update --init -- voxr_marketing; then
	printf '%s\n' \
		"Unable to initialize the private voxrapp/marketing repository." \
		"Confirm that your GitHub account has access and that your existing Git credentials can authenticate, then run:" \
		"  $initialize_command" >&2
	exit 1
fi

if [[ ! -f voxr_marketing/Cargo.toml ]]; then
	printf '%s\n' \
		"The marketing submodule initialized without its required Cargo.toml." \
		"Remove the inconsistent checkout and run:" \
		"  $initialize_command" >&2
	exit 1
fi

printf '%s\n' \
	"Private marketing source is initialized at voxr_marketing." \
	"Install its dependencies explicitly with:" \
	"  pnpm --dir voxr_marketing install --frozen-lockfile"
