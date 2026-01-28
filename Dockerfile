# tms-backend dockerfile
#

FROM docker.io/golang:alpine as builder
RUN apk --no-cache add gcc musl-dev
WORKDIR /tms
COPY . /tms/
WORKDIR cmd/tms-backend
ENV CGO_ENABLED=1 CGO_CFLAGS="-DSQLITE_ENABLE_JSON1"
RUN go build


FROM docker.io/nginx:stable-alpine
ARG tms-listen
ARG tms-ports
RUN apk --no-cache add busybox sqlite jq
COPY --from=builder /tms/cmd/tms-backend/tms-backend /usr/local/bin/
EXPOSE $tms-listen
EXPOSE $tms-portrange
CMD ["/usr/local/bin/tms-backend"]
