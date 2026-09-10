# syntax=docker/dockerfile:1.7
# SPDX-License-Identifier: AGPL-3.0-or-later

FROM caddy:2.10-alpine

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="voxr-static"
LABEL org.opencontainers.image.description="Self-hostable static asset bundle for Voxr"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="Voxr"
LABEL org.opencontainers.image.url="https://voxr.app"
LABEL org.opencontainers.image.documentation="https://docs.voxr.app"
LABEL org.opencontainers.image.source="https://github.com/voxrapp/voxr"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.voxr.build-version="${BUILD_VERSION}"

COPY voxr_static/Caddyfile /etc/caddy/Caddyfile
COPY --chown=65532:65532 voxr_static/avatars /srv/voxr-static/avatars
COPY --chown=65532:65532 voxr_static/badges /srv/voxr-static/badges
COPY --chown=65532:65532 voxr_static/desktop /srv/voxr-static/desktop
COPY --chown=65532:65532 voxr_static/embeds /srv/voxr-static/embeds
COPY --chown=65532:65532 voxr_static/emoji /srv/voxr-static/emoji
COPY --chown=65532:65532 voxr_static/libs /srv/voxr-static/libs
COPY --chown=65532:65532 voxr_static/web /srv/voxr-static/web

RUN setcap -r /usr/bin/caddy \
	&& mkdir -p /config/caddy /data/caddy \
	&& chown -R 65532:65532 /config /data /srv/voxr-static

USER 65532:65532

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -q -O - http://127.0.0.1:8080/_health | grep -q OK
