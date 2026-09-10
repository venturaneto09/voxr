# SPDX-License-Identifier: AGPL-3.0-or-later
FROM erlang:28-slim AS build

ARG LOGGER_LEVEL=info
ARG RUST_TOOLCHAIN=1.93.0

ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
	git \
	curl \
	make \
	gcc \
	g++ \
	libc6-dev \
	gettext-base \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

RUN curl --retry 5 --retry-delay 2 --retry-all-errors -fsSL https://github.com/erlang/rebar3/releases/download/3.24.0/rebar3 -o /usr/local/bin/rebar3 && \
	chmod +x /usr/local/bin/rebar3

RUN curl --retry 5 --retry-delay 2 --retry-all-errors --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | \
	sh -s -- -y --profile minimal --default-toolchain "${RUST_TOOLCHAIN}"

COPY . .
WORKDIR /usr/src/app/voxr_gateway
RUN rebar3 compile --deps_only

RUN LOGGER_LEVEL=${LOGGER_LEVEL} envsubst < config/sys.config.template > config/sys.config && \
	rebar3 as prod release

FROM erlang:28-slim

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="voxr-gateway"
LABEL org.opencontainers.image.description="Voxr realtime gateway"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="Voxr"
LABEL org.opencontainers.image.url="https://voxr.app"
LABEL org.opencontainers.image.documentation="https://docs.voxr.app"
LABEL org.opencontainers.image.source="https://github.com/voxrapp/voxr"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.voxr.build-version="${BUILD_VERSION}"

WORKDIR /opt/voxr_gateway

RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	curl \
	libstdc++6 \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/src/app/voxr_gateway/_build/prod/rel/voxr_gateway .
COPY voxr_gateway/scripts/docker_entrypoint.sh /opt/voxr_gateway/bin/docker_entrypoint.sh
COPY voxr_gateway/scripts/voxr_gateway_release_wrapper.sh /opt/voxr_gateway/bin/voxr_gateway.wrapper

RUN mv /opt/voxr_gateway/bin/voxr_gateway /opt/voxr_gateway/bin/voxr_gateway.real && \
	mv /opt/voxr_gateway/bin/voxr_gateway.wrapper /opt/voxr_gateway/bin/voxr_gateway && \
	chmod +x /opt/voxr_gateway/bin/docker_entrypoint.sh /opt/voxr_gateway/bin/voxr_gateway && \
	groupadd -r -g 65532 voxr && \
	useradd -r -u 65532 -g 65532 -s /sbin/nologin -d /opt/voxr_gateway voxr && \
	chown -R 65532:65532 /opt/voxr_gateway

USER 65532:65532

ENV BUILD_VERSION="${BUILD_VERSION}"

EXPOSE 8080 8081 4369

ENTRYPOINT ["/opt/voxr_gateway/bin/docker_entrypoint.sh"]
