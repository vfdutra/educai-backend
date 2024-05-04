FROM node:20.11.1

WORKDIR /usr/src/app

COPY . ./

RUN npm install
RUN npm run build
COPY .env build/
COPY google-credentials.json build/
RUN cd build/ && npm ci --production

EXPOSE 3333

CMD [ "node", "build/server.js" ]