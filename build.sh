#!/bin/bash

set -e

# find 'docker' or 'podman'
dockercmd=$(which docker 2>&1 || true)
if [[ "${dockercmd}" =~ ^which ]]; then
    dockercmd=$(which podman 2>&1 || true)
fi
if [[ "${dockercmd}" =~ ^which ]]; then
    echo "error: neither docker or podman found in PATH"
    exit 2
fi

# check for other pre-reqs
preqs="jq sed"
for preq in ${preqs}; do
    loc=$(which "${preq}" 2>&1 || true)
    if [[ "${loc}" =~ ^which ]]; then
        echo "error: '${preq}' is required, but not found in PATH"
        exit 2
    fi
done

# complain if we don't have a config file and can't clone from
# /etc. clone if we can.
if [[ ! -f /etc/tmc.json ]]; then
    echo "error: config file /etc/tmc.json not found"
    echo "       please create, then rerun this script"
    exit 1
fi
if [[ ! -f ./tmc.json ]]; then
    jq . /etc/tmc.json > ./tmc.json
fi

# extract some values from config
listen=$(jq -r '.["listen-port"]' ./tmc.json)
ports=$(jq -r '.["srvr-ports"]' ./tmc.json)
#clientdir=$(jq -r .clientdir ./tmc.json)
musicdir=$(jq -r .musicdir ./tmc.json)

# edit configfile if needed
if [[ "${musicdir}" != "/Music" ]] || [[ "${listen}" != "0.0.0.0" ]]; then
    jq '.musicdir = "/Music" | .["listen-if"] = "0.0.0.0"' ./tmc.json > tmc.new
    mv tmc.new tmc.json
fi

# go.work will screw up the build, so hide it for this process
if [[ -f go.work ]]; then
    mv go.work go.notwork
fi

# set image/container and config file name
name="tms-backend"
config="tmc.json"
if [[ "${1}" != "" ]]; then
    name="${name}-${1}"
    config="tmc-${1}.json"
fi

# contianer and image maintenance
${dockercmd} container stop "${name}" && \
    ${dockercmd} container rm "${name}" && \
    ${dockercmd} image rm "${name}"
${dockercmd} image prune -f

# do the actual build
${dockercmd} build --build-arg tmslisten="${listen}" --build-arg tmsports="${ports}" \
             --build-arg configfile="${config}" --tag "${name}" .

echo "Starting container tms-backend"
${dockercmd} run --name "${name}" -d --restart unless-stopped \
             -p "${listen}:${listen}" -p "${ports}:${ports}" \
             -v "${musicdir}:/Music:ro" "${name}"

# clean up
echo "Cleaning up"
${dockercmd} image prune -f
if [[ -f go.notwork ]]; then
    mv go.notwork go.work
fi
