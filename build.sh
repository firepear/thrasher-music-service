#!/bin/bash

set -e

# check for jq
jq=$(which jq 2>&1 || true)
if [[ "${jq}" =~ ^which ]]; then
    echo "error: 'jq' is required, but not found in PATH"
    exit 2
fi

# complain if we don't have a config file and can't clone from /etc
if [[ -f /etc/tmc.json ]] && [[ ! -f ./tmc.json ]]; then
    jq . /etc/tmc.json > ./tmc.json
fi
if [[ ! -f ./tmc.json ]]; then
    echo "error: config file ./tmc.json not found"
    echo "       please create one, then rerun this script"
    exit 1
fi

# extract some values from config
listen=$(${jq} -r '.["listen-port"]' ./tmc.json)
ports=$(${jq} -r '.["srvr-ports"]' ./tmc.json)
#clientdir=$(${jq} -r .clientdir ./tmc.json)
musicdir=$(${jq} -r .musicdir /etc/tmc.json)
# add clientdir if we don't have it in the config file, since we know
# what value needs to go here
#if [[ "${clientdir}" == "null" ]]; then
#    jq '. += {"clientdir": "/var/local/tms-backend"}' tmc.json > tmc.new
#    mv tmc.new tmc.json
#    clientdir=$(${jq} -r .clientdir ./tmc.json)
#fi
# and tell the user if we did have it, but it isn't correct
#if [[ "${clientdir}" != "/var/local/tms-backend" ]]; then
#    echo "error: clientdir must be set to '/var/local/tms-backend' in ./tmc.json"
#    exit 2
#fi
# set client files source
clientsrc="$(pwd)/client"
# edit musicdir if needed
localmd=$(${jq} -r .musicdir ./tmc.json)
if [[ "${localmd}" != "/Music" ]]; then
    jq '.musicdir = "/Music"' ./tmc.json > tmc.new
    mv tmc.new tmc.json
fi

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
             --tag tms-backend .

echo "Starting container tms-backend"
${dockercmd} run --name tms-backend -d --restart unless-stopped \
             -p "${listen}:${listen}" -p "${ports}:${ports}" \
             -v "${musicdir}:/Music:ro" tms-backend

# ${dockercmd} run --name tms-backend -d --restart unless-stopped \
    # -p 9098:80 -p 11099:11099 \
    # -v gwg:/usr/share/nginx/html tms-backend

# clean up
echo "Cleaning up"
${dockercmd} image prune -f
if [[ -f go.notwork ]]; then
    mv go.notwork go.work
fi
