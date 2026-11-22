FROM node:20-alpine
WORKDIR /app

# Install Angular CLI globally so `ng` is always available
RUN npm install -g @angular/cli@18

# Install server dependencies
COPY package*.json ./
RUN npm install

# Install Angular client dependencies
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy all source files
COPY . .

# Build Angular frontend & compile TypeScript backend
RUN npm run build:client && npm run build:server

EXPOSE 3000
CMD ["node", "dist/server/index.js"]
