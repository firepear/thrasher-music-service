# tms-backend dockerfile
#

FROM docker.io/golang:alpine as builder
#RUN apk --no-cache add gcc musl-dev
#WORKDIR /gwg
#COPY . /gwg/
WORKDIR cmd/gwgather
ENV CGO_ENABLED=1 CGO_CFLAGS="-DSQLITE_ENABLE_JSON1"
RUN go build


FROM docker.io/nginx:stable-alpine
ARG tms-config
ARG tms-listen
ARG tms-portrange
RUN apk --no-cache add busybox sqlite jq
COPY --from=builder /gwg/cmd/gwgather/gwgather /gwg/cmd/gwdump/gwdump /gwg/assets/dockerstart.sh /usr/local/bin/
COPY --from=builder /gwg/assets/gwgather-config.json /etc/gwgather-config.json
EXPOSE $tms-listen
EXPOSE $tms-portrange
CMD ["/usr/local/bin/dockerstart.sh"]
