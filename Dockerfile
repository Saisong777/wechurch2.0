FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build the frontend
RUN npm run build

# Set production environment
ENV NODE_ENV=production

# Expose the port Railway will assign via $PORT
EXPOSE 8080

# Start the app with tsx directly
CMD ["node_modules/.bin/tsx", "server/index.ts"]
