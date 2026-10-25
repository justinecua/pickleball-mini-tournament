FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public URL baked into QR-code links, e.g. https://picklexp.site
ARG VITE_PUBLIC_URL=
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
