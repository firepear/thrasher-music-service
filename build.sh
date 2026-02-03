#!/bin/bash

# complain if we don't have a config file and can't copy one from /etc
if [[ -f /etc/tmc.json ]] && [[ ! -f ./tmc.json ]]; then
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
listen=$(${jq} -r .listen-port ./tmc.json)
ports=$(${jq} -r .srvr-ports ./tmc.json)
clientdir=$(${jq} -r .clientdir ./tmc.json)
musicdir=$(${jq} -r .musicdir ./tmc.json)

# set client directories
if [[ "${clientdir}" == "" ]]; then
    clientdir="/var/local/tms-backend"
fi
clientbind="$(pwd)/client"

# find 'docker' or 'podman'
dockercmd=$(which docker 2>&1 || true)
if [[ "${dockercmd}" =~ ^which ]]; then
    dockercmd=$(which podman 2>&1 || true)
fi
if [[ "${dockercmd}" =~ ^which ]]; then
    echo "error: neither docker or podman found in PATH"
    exit 2
fi

# go.work will screw up the build, so hide it for this process
if [[ -f go.work ]]; then
    mv go.work go.notwork
fi

# contianer and image maintenance
${dockercmd} container stop tms-backend && \
    ${dockercmd} container rm tms-backend && \
    ${dockercmd} image rm tms-backend
${dockercmd} image prune -f

# do the actual build
${dockercmd} build --build-arg tmslisten="${listen}" --build-arg tmsports="${ports}" \
             --build-arg clientdir="${clientdir}" --tag tms-backend .

# ${dockercmd} run --name tms-backend -d -p "${listen} -p "${srvr-ports}:${srvr-ports}" \
#        -v "${musicdir}:/Music" -v "${clientbind}:${clientdir}" tms-backend

# ${dockercmd} run --name tms-backend -d --restart unless-stopped \
    # -p 9098:80 -p 11099:11099 \
    # -v gwg:/usr/share/nginx/html tms-backend

# clean up
if [[ -f go.notwork ]]; then
    mv go.notwork go.work
fi
