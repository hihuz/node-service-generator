FROM node:18

WORKDIR /opt/service

EXPOSE 3001

ENTRYPOINT ["/opt/service/bin/dev.sh"]