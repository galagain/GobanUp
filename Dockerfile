FROM emscripten/emsdk@sha256:460fff8f8ac87e11b16447fbd66538a686eafa0e4fb977aa0989ed19fe2079f7 AS fuego-build
WORKDIR /src
RUN curl -fLsS --retry 3 'https://codeload.github.com/mesqueeb/FuegoOnAppleSilicon/tar.gz/52e4232cbb81408761ba53cc9993b916d99d54a4' -o /tmp/upstream.tar.gz \
 && echo '4796189716c67cf2a4281c510eff5443fc713dbfdd68d24daf6d1d7760b312e9  /tmp/upstream.tar.gz' | sha256sum -c - \
 && tar -xzf /tmp/upstream.tar.gz --strip-components=1 \
 && curl -fLsS --retry 3 'https://deb.debian.org/debian/pool/main/b/boost1.74/libboost1.74-dev_1.74.0+ds1-21_amd64.deb' -o /tmp/boost.deb \
 && echo 'ba14fe04d7f138f874bd3ab3a20c4fd1e9f654e271449b8f3e48d20f942dbb93  /tmp/boost.deb' | sha256sum -c - \
 && dpkg-deb -x /tmp/boost.deb /tmp/headers && ln -s /tmp/headers/usr/include /boost
COPY public/bots/fuego/source/ browser/
RUN patch -p1 < browser/single-thread.patch \
 && emcmake cmake -S browser -B browser/build -DCMAKE_BUILD_TYPE=Release \
 && cmake --build browser/build -j4

FROM scratch AS fuego-artifacts
COPY --from=fuego-build /src/browser/build/engine.js /src/browser/build/engine.wasm /
COPY --from=fuego-build /tmp/upstream.tar.gz /source/upstream.tar.gz

FROM node:24-alpine AS bot-models
COPY scripts/bot-assets.mjs /bot-assets.mjs
RUN node --input-type=module -e "import {downloadModels} from '/bot-assets.mjs'; await downloadModels('/models')"

FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY scripts scripts
COPY server server
COPY public public
COPY drizzle drizzle
RUN --mount=type=bind,from=fuego-artifacts,target=/opt/fuego \
    --mount=type=bind,from=bot-models,source=/models,target=/opt/models \
    FUEGO_ASSETS=/opt/fuego BOT_MODEL_ASSETS=/opt/models node scripts/build.mjs && mkdir -p /data && chown node:node /data
USER node
CMD ["node", "server/homelab.mjs"]
