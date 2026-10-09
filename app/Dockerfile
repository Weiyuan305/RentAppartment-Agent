FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# This is the existing public, read-only map token, compiled into browser code.
# Model credentials are runtime variables and are never build arguments.
ARG VITE_CESIUM_ION_ACCESS_TOKEN
ENV VITE_MAP_PROVIDER=cesium-ion
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /app/.data /app/.sites-runtime && chown -R node:node /app/.data /app/.sites-runtime
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
