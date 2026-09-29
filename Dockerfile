FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Unprivileged variant: runs as a non-root user and listens on 8080 (needed for runAsNonRoot in Kubernetes).
FROM nginxinc/nginx-unprivileged:1.29-alpine
# The official image renders /etc/nginx/templates/*.template with envsubst at startup.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV MERCHANT_SERVICE_URL=http://merchant-service:8081 \
    PAYMENT_SERVICE_URL=http://payment-service:8082 \
    TOKEN_SERVICE_URL=http://tokenization-service:8083 \
    SETTLEMENT_SERVICE_URL=http://settlement-service:8084
# The assistant is optional: by default it points nowhere and the Assistant page shows "unavailable".
# Set it to e.g. http://assistant:8085 when payment-assistant is running.
ENV ASSISTANT_SERVICE_URL=http://127.0.0.1:9
EXPOSE 8080
