FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 5173
# Install deps at runtime so volume-mounted code always has correct node_modules (postcss-nesting, framer-motion, recharts, etc.)
CMD ["sh", "-c", "npm install && npm run dev -- --host"]