# Minimal cron-runner image. Each Railway "cron service" uses this image with
# a different CRON_PATH env var + cron schedule.
FROM alpine:3.20
RUN apk add --no-cache curl ca-certificates
COPY cron-trigger.sh /usr/local/bin/cron-trigger
RUN chmod +x /usr/local/bin/cron-trigger
ENTRYPOINT ["/usr/local/bin/cron-trigger"]
