FROM node:8

WORKDIR /opt/pot

COPY package.json ./
COPY yarn.lock ./
RUN yarn

COPY . .
EXPOSE 10000
CMD [ "node", "index.js" ]