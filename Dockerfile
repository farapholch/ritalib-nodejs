# Use a Node.js base image
FROM node:22

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the entire project directory (excluding files in .dockerignore)
COPY . .

# Build the TypeScript application (if applicable)
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
