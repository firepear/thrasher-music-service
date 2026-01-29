# tms-backend dockerfile
#

FROM docker.io/golang:alpine as builder
RUN apk --no-cache add gcc musl-dev
WORKDIR /tms
COPY . /tms/
WORKDIR cmd/tms-backend
ENV CGO_ENABLED=1 CGO_CFLAGS="-DSQLITE_ENABLE_JSON1"
RUN go build


FROM docker.io/alpine:latest
ARG tmslisten
ARG tmsports
ARG clientdir
RUN apk --no-cache add busybox sqlite jq
COPY --from=builder /tms/cmd/tms-backend/tms-backend /usr/local/bin/
COPY --from=builder /tms/tmc.json /etc/tmc.json
COPY --from=builder /tms/client/ $clientdir
EXPOSE $tmslisten
EXPOSE $tmsports
RUN echo "listen $tmslisten ports $tmsports clientdir $clientdir"
CMD ["/usr/local/bin/tms-backend"]
