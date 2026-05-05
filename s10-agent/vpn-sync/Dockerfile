FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    openfortivpn \
    nodejs \
    npm \
    curl \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY sync-agent.js ./
COPY run.sh ./
RUN chmod +x run.sh

ENTRYPOINT ["./run.sh"]
