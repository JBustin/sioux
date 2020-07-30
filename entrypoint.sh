#!/bin/sh
rm -rf /etc/apache2/sites-enabled/*
rm -rf /etc/apache2/sites-available/*
npm run generate:hosts
npm run generate:conf
apachectl configtest
/etc/init.d/apache2 start
npm start
/etc/init.d/apache2 stop