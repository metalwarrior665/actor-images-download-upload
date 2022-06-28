# FROM apify/actor-node-chrome
FROM apify/actor-node

# Copy all files and directories from the directory to the Docker image
COPY . ./

# Install NPM packages, skip optional and development dependencies to keep the image small,
# avoid logging to much and show log the dependency tree

RUN npm install --quiet --only=prod --no-optional \
 && npm list --only=prod --no-optional

# Define that start command
CMD [ "npm", "start" ]
