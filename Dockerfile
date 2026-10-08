# Serves the fixture corpus over HTTP. No dependencies: the server is ~40 lines
# of node:http, so the image is the corpus plus a Node runtime and nothing else.
FROM node:22-alpine
WORKDIR /corpus
COPY . .
EXPOSE 8080
ENV HOST=0.0.0.0 PORT=8080
HEALTHCHECK --interval=5s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/index.html >/dev/null || exit 1
CMD ["node", "serve.mjs"]
