FROM node:14.13.1
RUN apt-get update && apt-get install -y apache2 vim curl && a2enmod rewrite lbmethod_byrequests proxy proxy_http proxy_balancer
RUN mkdir -p /usr/app /opt
COPY entrypoint.sh /opt
RUN chmod +x /opt/entrypoint.sh
WORKDIR /usr/app
COPY package* ./
RUN npm install --no-save --production
COPY . .
CMD ["sh", "/opt/entrypoint.sh"]