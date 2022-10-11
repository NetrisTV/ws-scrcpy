FROM alpine:3.14 AS builder

ADD . /ws-scrcpy
RUN apk add --no-cache nodejs npm python3 make g++
WORKDIR /ws-scrcpy
RUN npm install
RUN npm run dist
WORKDIR dist
RUN npm install

FROM alpine:3.14 AS runner
LABEL maintainer="Vitaly Repin <vitaly.repin@gmail.com>"

RUN apk add --no-cache android-tools npm
COPY --from=builder /ws-scrcpy/dist /root/ws-scrcpy

WORKDIR /root/ws-scrcpy
CMD ["npm", "start"]
