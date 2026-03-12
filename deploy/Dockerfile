# ── Stage 1: Build ──
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* bun.lockb* ./
RUN npm ci --ignore-scripts

COPY . .

# Pass build-time env vars
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_PUBLIC_ROOT_DOMAIN=titanmeet.com

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_PUBLIC_ROOT_DOMAIN=$VITE_PUBLIC_ROOT_DOMAIN

RUN npm run build

# ── Stage 2: Serve ──
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run requires port 8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
