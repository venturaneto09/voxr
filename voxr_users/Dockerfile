# SPDX-License-Identifier: AGPL-3.0-or-later

FROM rust:1-bookworm AS builder

WORKDIR /usr/src/app

COPY . .

RUN cargo build --release -p voxr-users --features scylla

FROM debian:bookworm-slim

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="voxr-users"
LABEL org.opencontainers.image.description="Voxr user storage service"
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

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
	rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/voxr-users /usr/local/bin/voxr-users

ENV BUILD_VERSION="${BUILD_VERSION}"

USER 65532:65532

EXPOSE 8090

CMD ["/usr/local/bin/voxr-users"]
