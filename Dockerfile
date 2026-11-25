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

FROM fuego-build AS leela-build
WORKDIR /leela
RUN curl -fLsS --retry 3 https://codeload.github.com/leela-zero/leela-zero/tar.gz/3f297889563bcbec671982c655996ccff63fa253 -o /tmp/leela.tar.gz \
 && echo '5e10740fef0b786ecd4c24bd175cb3b9234edd75a77bf8b7f38f6cc0d6214330  /tmp/leela.tar.gz' | sha256sum -c - \
 && tar -xzf /tmp/leela.tar.gz --strip-components=1 \
 && curl -fLsS --retry 3 https://codeload.github.com/eigenteam/eigen-git-mirror/tar.gz/cf794d3b741a6278df169e58461f8529f43bce5d -o /tmp/eigen.tar.gz \
 && echo 'c7f57546eaacf7aab2c7471285119a5456f7ccdc86c86530a047eed6ca96aa9c  /tmp/eigen.tar.gz' | sha256sum -c - \
 && tar -xzf /tmp/eigen.tar.gz --strip-components=1 -C src/Eigen
COPY public/bots/leela/source/browser.cpp public/bots/leela/source/browser.patch public/bots/leela/source/build.sh browser/
RUN patch -p1 < browser/browser.patch && sh browser/build.sh
COPY public/bots/leela/source/pack.py browser/
RUN curl -fLsS --retry 3 https://zero.sjeng.org/networks/d13c40993740cb77d85c838b82c08cc9c3f0fbc7d8c3761366e5d59e8f371cbd.gz -o /tmp/elf.gz \
 && echo 'fcc59e47fb19a19e8f4e421b4371bfc12eeca401a3f1c33fc4624c9f878a982e  /tmp/elf.gz' | sha256sum -c - \
 && python3 browser/pack.py /tmp/elf.gz /tmp/elf-v1.gz

FROM scratch AS leela-artifacts
COPY --from=leela-build /leela/browser/engine.js /leela/browser/engine.wasm /tmp/elf-v1.gz /
COPY --from=leela-build /tmp/leela.tar.gz /tmp/eigen.tar.gz /source/

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
    --mount=type=bind,from=leela-artifacts,target=/opt/leela \
    --mount=type=bind,from=bot-models,source=/models,target=/opt/models \
    LEELA_ASSETS=/opt/leela FUEGO_ASSETS=/opt/fuego BOT_MODEL_ASSETS=/opt/models node scripts/build.mjs && mkdir -p /data && chown node:node /data
USER node
CMD ["node", "server/homelab.mjs"]
