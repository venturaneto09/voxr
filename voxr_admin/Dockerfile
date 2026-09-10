# SPDX-License-Identifier: AGPL-3.0-or-later

FROM rust:1-bookworm AS builder

ARG BUILD_VERSION=""
ARG TARGETARCH

WORKDIR /usr/src/app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates nodejs npm pkg-config \
	&& npm install -g pnpm@10.29.3 \
	&& rm -rf /var/lib/apt/lists/*

RUN npm install --no-audit --no-fund @tailwindcss/cli@4.2.1 tailwindcss@4.2.1
RUN TAILWIND_OXIDE_VERSION="4.2.1" \
	&& case "${TARGETARCH}" in \
		amd64) OXIDE_PKG="@tailwindcss/oxide-linux-x64-gnu" ;; \
		arm64) OXIDE_PKG="@tailwindcss/oxide-linux-arm64-gnu" ;; \
		*) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
	esac \
	&& npm install --no-audit --no-fund "${OXIDE_PKG}@${TAILWIND_OXIDE_VERSION}" \
	&& ls -la node_modules/.bin/tailwindcss

COPY Cargo.lock Cargo.lock
COPY voxr_admin voxr_admin
COPY voxr_common voxr_common
COPY packages/fonts/manifest.json packages/fonts/manifest.json
COPY packages/fonts/NOTICE.md packages/fonts/NOTICE.md
COPY packages/fonts/LICENSE-IBM-PLEX.txt packages/fonts/LICENSE-IBM-PLEX.txt
COPY packages/fonts/files/VoxrSans packages/fonts/files/VoxrSans
COPY packages/fonts/files/VoxrMono packages/fonts/files/VoxrMono
RUN printf '%s\n' \
	'[workspace]' \
	'members = ["voxr_admin", "voxr_common"]' \
	'resolver = "2"' \
	'' \
	'[workspace.package]' \
	'edition = "2024"' \
	'license = "AGPL-3.0-or-later"' \
	'' \
	'[profile.release]' \
	'lto = "fat"' \
	'codegen-units = 1' \
	'strip = "symbols"' \
	> Cargo.toml

ENV VOXR_BUILD_VERSION="${BUILD_VERSION}"

RUN cargo build --release -p voxr_admin \
	&& cp target/release/voxr_admin /usr/local/bin/voxr-admin

RUN test -s target/release/build/voxr_admin-*/out/static/app.css \
	&& echo "Tailwind CSS compiled successfully"

RUN test "$(ls target/release/build/voxr_admin-*/out/static/fonts/*.woff2 | wc -l)" -eq 16 \
	&& ls target/release/build/voxr_admin-*/out/static/fonts/fonts.*.css \
	&& echo "Latin-core fonts bundled successfully"

FROM debian:bookworm-slim AS runtime

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="voxr-admin"
LABEL org.opencontainers.image.description="Voxr admin console"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="Voxr"
LABEL org.opencontainers.image.url="https://voxr.app"
LABEL org.opencontainers.image.documentation="https://docs.voxr.app"
LABEL org.opencontainers.image.source="https://github.com/voxrapp/voxr"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.voxr.build-version="${BUILD_VERSION}"

WORKDIR /usr/local/bin

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/voxr-admin /usr/local/bin/voxr-admin

ENV BUILD_VERSION="${BUILD_VERSION}"
ENV VOXR_ADMIN_HOST="0.0.0.0"
ENV VOXR_ADMIN_PORT="8080"

USER 65532:65532

EXPOSE 8080

CMD ["/usr/local/bin/voxr-admin"]
