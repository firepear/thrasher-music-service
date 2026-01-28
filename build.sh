#!/bin/bash

# copy the system config to this dir, for insertion into the container
# later at build time
if [[ -f /etc/tmc.json ]]; then
    cp /etc/tmc.json .
fi
if [[ ! -f ./tmc.json ]]; then
    echo "error: config file ./tmc.json not found"
    echo "       please create one, then rerun this script"
    exit 1
fi

# extract some values from config
jq=$(which jq 2>&1 || true)
if [[ "${jq}" =~ ^which ]]; then
    echo "error: 'jq' is required, but not found in PATH"
    exit 2
fi
listen=$(${jq} -r .listen ./tmc.json)
ports=$(${jq} -r .ports ./tmc.json)
clientdir=$(${jq} -r .clientdir ./tmc.json)
musicdir=$(${jq} -r .musicdir ./tmc.json)

# find 'docker' or 'podman'
dockercmd=$(which docker 2>&1 || true)
if [[ "${dockercmd}" =~ ^which ]]; then
    dockercmd=$(which podman 2>&1 || true)
fi
if [[ "${dockercmd}" =~ ^which ]]; then
    echo "error: neither docker or podman found in PATH"
    exit 2
fi


# contianer and image maintenance
${dockercmd} container stop tms-backend && \
    ${dockercmd} container rm tms-backend && \
    ${dockercmd} image rm tms-backend
${dockercmd} image prune -f

# do the actual build
${dockercmd} build --build-arg tms-listen="${1}" --build-arg tms-ports="${2}" --tag tms-backend .

# copy config and web assets into container
${dockercmd} cp tmc.json tms-backend:/etc/tmc.json
# and clean up copy of config
rm tmc.json

# ${dockercmd} run --name tms-backend -d --restart unless-stopped \
    # -p 9098:80 -p 11099:11099 \
    # -v gwg:/usr/share/nginx/html tms-backend

#${dockercmd} cp assets/web/index.html tms-backend:/usr/share/nginx/html/
#${dockercmd} cp assets/web/main.js tms-backend:/usr/share/nginx/html/

