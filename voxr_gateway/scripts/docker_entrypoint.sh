#!/usr/bin/env sh

# SPDX-License-Identifier: AGPL-3.0-or-later

set -eu

is_positive_int() {
	case "${1:-}" in
	'' | 0* | *[!0-9]*) return 1 ;;
	*) [ "$1" -gt 0 ] ;;
	esac
}

available_cpu_count() {
	cpu_quota=""
	cpu_period=""
	if [ -r /sys/fs/cgroup/cpu.max ]; then
		read -r cpu_quota cpu_period </sys/fs/cgroup/cpu.max || true
	else
		for cgroup_dir in /sys/fs/cgroup/cpu /sys/fs/cgroup/cpu,cpuacct; do
			if [ -r "$cgroup_dir/cpu.cfs_quota_us" ] && [ -r "$cgroup_dir/cpu.cfs_period_us" ]; then
				read -r cpu_quota <"$cgroup_dir/cpu.cfs_quota_us" || true
				read -r cpu_period <"$cgroup_dir/cpu.cfs_period_us" || true
				break
			fi
		done
	fi
	if is_positive_int "$cpu_quota" && is_positive_int "$cpu_period"; then
		echo "$(((cpu_quota + cpu_period - 1) / cpu_period))"
		return 0
	fi
	cpu_count="$(nproc 2>/dev/null || echo 1)"
	if is_positive_int "$cpu_count"; then
		echo "$cpu_count"
	else
		echo 1
	fi
}

clamp_int() {
	value="$1"
	min="$2"
	max="$3"
	if [ "$value" -lt "$min" ]; then
		value="$min"
	fi
	if [ "$value" -gt "$max" ]; then
		value="$max"
	fi
	echo "$value"
}

: "${VOXR_ERLANG_SCHEDULERS_MIN:=2}"
: "${VOXR_ERLANG_SCHEDULERS_MAX:=16}"
: "${VOXR_ERLANG_NODE_NAME:=voxr_gateway@127.0.0.1}"
: "${VOXR_ERLANG_DIST_PORT:=8081}"

if [ -z "${VOXR_ERLANG_COOKIE:-}" ]; then
	echo 'VOXR_ERLANG_COOKIE is required.' >&2
	exit 1
fi

if ! is_positive_int "${VOXR_ERLANG_SCHEDULERS:-}"; then
	VOXR_ERLANG_SCHEDULERS="$(clamp_int "$(available_cpu_count)" "$VOXR_ERLANG_SCHEDULERS_MIN" "$VOXR_ERLANG_SCHEDULERS_MAX")"
fi

if ! is_positive_int "${VOXR_ERLANG_DIRTY_CPU_SCHEDULERS:-}"; then
	VOXR_ERLANG_DIRTY_CPU_SCHEDULERS="$(((VOXR_ERLANG_SCHEDULERS * 2 + 2) / 3))"
fi

export VOXR_ERLANG_NODE_NAME
export VOXR_ERLANG_COOKIE
export VOXR_ERLANG_DIST_PORT
export VOXR_ERLANG_SCHEDULERS
export VOXR_ERLANG_DIRTY_CPU_SCHEDULERS
export RELX_REPLACE_OS_VARS="${RELX_REPLACE_OS_VARS:-true}"

exec /opt/voxr_gateway/bin/voxr_gateway foreground
