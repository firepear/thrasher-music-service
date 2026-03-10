# tms-backend containerfile

# first-stage (builder) image is where we build tms-backend itself
FROM docker.io/golang:alpine as builder
RUN apk --no-cache add gcc musl-dev
WORKDIR /tms
COPY --parents ./thrasher-music-* /tms
WORKDIR /tms/thrasher-music-service
ENV CGO_ENABLED=1 CGO_CFLAGS="-DSQLITE_ENABLE_JSON1"
RUN go build ./cmd/tms-backend

# second stage: copy things from various places into a clean image
# with bo build deps
FROM docker.io/alpine:latest
ARG tmslisten
ARG tmsports
ARG configfile
RUN apk --no-cache add busybox sqlite jq
RUN echo "listen '$tmslisten' ports '$tmsports' clientdir '$clientdir' cf '$configfile'"
COPY --from=builder /tms/thrasher-music-service/tms-backend /usr/local/bin/
COPY --from=builder /tms/thrasher-music-service/$configfile /etc/tmc.json
COPY --from=builder /tms/thrasher-music-service/client/ /var/local/tms-backend
EXPOSE $tmslisten
EXPOSE $tmsports
CMD ["/usr/local/bin/tms-backend"]
