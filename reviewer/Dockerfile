FROM node:24-alpine AS engine
RUN apk add --no-cache build-base cmake eigen-dev zlib-dev curl
ARG KATAGO_VERSION=1.16.5
RUN curl --retry 3 -fsSL "https://codeload.github.com/lightvector/KataGo/tar.gz/refs/tags/v${KATAGO_VERSION}" -o /tmp/kata.tar.gz \
 && mkdir /src && tar -xzf /tmp/kata.tar.gz -C /src --strip-components=1 \
 && cmake -S /src/cpp -B /build -DUSE_BACKEND=EIGEN -DCMAKE_CXX_FLAGS="-include endian.h" -DUSE_AVX2=1 -DNO_GIT_REVISION=1 -DCMAKE_BUILD_TYPE=Release \
 && cmake --build /build -j3
FROM node:24-alpine
WORKDIR /app
ADD --checksum=sha256:637746e44f0efe00ad1245a50aa9bbf0716efe364c43965ead97bd6835d84ab5 --chmod=0444 https://github.com/lightvector/KataGo/releases/download/v1.15.0/b18c384nbt-humanv0.bin.gz /app/assets/human.bin.gz
COPY --from=engine /build/katago /usr/local/bin/katago
COPY reviewer reviewer
COPY public/engine.js ./assets/engine.cjs
COPY public/katago/g170-b6c96.bin.gz public/katago/LICENSE-KataGo.txt ./assets/
RUN chmod 0755 /app/assets
USER node
CMD ["node","reviewer/run.mjs"]
