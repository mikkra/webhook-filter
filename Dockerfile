FROM node:12-alpine
WORKDIR /w
COPY package*.json ./
RUN chown -R node:node /w
USER node
RUN npm ci -q
COPY --chown=node:node . .
ARG PORT=1337
ENV PORT=${PORT}
EXPOSE ${PORT}
CMD ["npm", "start"]
