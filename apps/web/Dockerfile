FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host is not optional here. Vite binds 127.0.0.1 by default, which inside a
# container means the container's own loopback: the published port forwards to
# nothing and the browser gets a connection reset with no error in the logs.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
