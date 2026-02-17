# tms-backend dockerfile
#

FROM docker.io/golang:alpine as builder_dev
RUN apk --no-cache add gcc musl-dev
WORKDIR /tms/thrasher-music-catalog
COPY ./thrasher-music-catalog /tms/thrasher-music-catalog
WORKDIR /tms/thrasher-music-service
COPY ./thrasher-music-service /tms/thrasher-music-service
WORKDIR /tms/thrasher-music-service/cmd/tms-backend
ENV CGO_ENABLED=1 CGO_CFLAGS="-DSQLITE_ENABLE_JSON1"
RUN go build


FROM docker.io/golang:alpine as builder_prod
RUN apk --no-cache add gcc musl-dev
WORKDIR /tms/thrasher-music-service
COPY ./thrasher-music-service /tms/thrasher-music-service
WORKDIR /tms/thrasher-music-service/cmd/tms-backend
ENV CGO_ENABLED=1 CGO_CFLAGS="-DSQLITE_ENABLE_JSON1"
RUN go build


FROM docker.io/alpine:latest
ARG tmslisten
ARG tmsports
ARG configfile
ARG env=prod
RUN apk --no-cache add busybox sqlite jq
RUN echo "listen '$tmslisten' ports '$tmsports' clientdir '$clientdir' cf '$configfile' builder_$env"
COPY --from=builder_$env /tms/thrasher-music-service/cmd/tms-backend/tms-backend /usr/local/bin/
COPY --from=builder_$env /tms/thrasher-music-service/$configfile /etc/tmc.json
COPY --from=builder_$env /tms/thrasher-music-service/client/ /var/local/tms-backend
EXPOSE $tmslisten
EXPOSE $tmsports
CMD ["/usr/local/bin/tms-backend"]
