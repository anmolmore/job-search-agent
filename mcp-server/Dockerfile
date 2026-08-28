FROM node:20-slim

WORKDIR /app

COPY mcp-server/package*.json ./mcp-server/
COPY lib ./lib
RUN cd mcp-server && npm install --omit=dev

COPY mcp-server ./mcp-server

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:4000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
CMD ["node", "mcp-server/src/index.js"]
