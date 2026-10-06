FROM docker:cli
RUN apk add --no-cache git
COPY updater.sh /updater.sh
RUN chmod +x /updater.sh
ENTRYPOINT ["/updater.sh"]
