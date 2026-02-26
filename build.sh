#!/usr/bin/env bash

set -e

# check bash version
if [[ ${BASH_VERSINFO[0]} -lt 5 ]]; then
    echo "error: bash v5+ needed; this is v${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"
    exit 1
fi

# try to find a way to build containers
echo -n "[BUILD] Looking for containerization tool... "
for cmd in "docker" "podman" "container"; do
    dockercmd=$(which "${cmd}" 2>&1 || true)
    if [[ "${dockercmd}" =~ ^/ ]]; then
        break
    fi
done
if [[ "${dockercmd}" == "" ]]; then
    echo "error: no container tool found in PATH"
    exit 2
fi
echo "${dockercmd}"

# check for other pre-reqs
preqs="jq sed"
for preq in ${preqs}; do
    loc=$(which "${preq}" 2>&1 || true)
    if [[ "${loc}" =~ ^which ]]; then
        echo "error: '${preq}' is required, but not found in PATH"
        exit 2
    fi
done

# set image/container and config file name
name="tms-backend"
cf="tmc.json"  # stock config file name
bcf="tmc.json" # config included in build
custom="false"
if [[ "${1}" != "" ]]; then
    # undocumented feature 1: multiple builds. providing an
    # argument modifies the config file we're using and the name of
    # the container
    name="${name}-${1}"
    cf="${1}.json"
    custom="true"
fi


if [[ "${custom}" == "false" ]]; then
    # no custom config. complain if we don't have a system config
    # file; clone it if we can.
    if [[ ! -f /etc/tmc.json ]]; then
        echo "error: no config found at /etc/tmc.json; exiting"
        exit 1
    fi
    jq . /etc/tmc.json > "${cf}"
else
    # custom config specified; make sure it exists
    if [[ ! -f "${cf}" ]]; then
        echo "error: specified config file ${cf} doesn't exist; exiting"
        exit 1
    fi
fi

# extract some values from config
declare -A config
config["musicdir"]=$(jq -r .musicdir "${cf}")
config["listen-if"]=$(jq -r '.["listen-if"]' "${cf}")
config["listen-port"]=$(jq -r '.["listen-port"]' "${cf}")
config["srvr-ports"]=$(jq -r '.["srvr-ports"]' "${cf}")

# complain if any values are null
for attr in "${!config[@]}"; do
    if [[ "${config[${attr}]}" == "" ]]; then
           echo "error: config attribute '${attr}' cannot be null"
           echo "       please edit config file and rerun build.sh"
           exit 2
    fi
done
# and if musicdir doesn't exist
if [[ ! -d "${config['musicdir']}" ]]; then
    echo "error: musicdir (${config['musicdir']}) must exist and be a directory"
    exit 2
fi

# edit config values if needed
if [[ "${config['musicdir']}" != "/Music" ]] || [[ "${config['listen-if']}" != "0.0.0.0" ]]; then
    jq '.musicdir = "/Music" | .["listen-if"] = "0.0.0.0"' "${cf}" > "${cf}.new"
    config['listen-if']="0.0.0.0"
    bcf="${cf}.new"
fi

# contianer and image maintenance
echo "[BUILD] Pre-build cleanup"
${dockercmd} stop "${name}" || true
${dockercmd} rm "${name}" || true
${dockercmd} image rm "${name}" || true

# do the actual build
echo "[BUILD] Building image ${name}"
if [[ -f ./go.work ]]; then
    # undocumented feature 2: dev builds. the presence of go.work
    # requires having the Catalog code in the build image, and until
    # Apple's 'container' supports "COPY --parents" we have to have a
    # separate Dockerfile for this use case
    ${dockercmd} build --build-arg tmslisten="${config['listen-port']}" \
                 --build-arg tmsports="${config['srvr-ports']}" \
                 --build-arg configfile="${bcf}" --tag "${name}" -f ./Containerfile.dev ..
else
    ${dockercmd} build --build-arg tmslisten="${config['listen-port']}" \
                 --build-arg tmsports="${config['srvr-ports']}" \
                 --build-arg configfile="${bcf}" --tag "${name}" -f ./Containerfile ..
fi
# start the container
echo "[BUILD] Starting container ${name}"
    ${dockercmd} run --name "${name}" -d \
                 -p "${config['listen-port']}:${config['listen-port']}" \
                 -p "${config['srvr-ports']}:${config['srvr-ports']}" \
                 -v "${config['musicdir']}:/Music:ro" "${name}"
# and if we're not using 'container', set restart policy
if [[ ! "${dockercmd}" =~ container$ ]]; then
    ${dockercmd} update --restart always "${name}"
fi

# clean up
echo "[BUILD] Post-build cleanup"
if [[ "${custom}" == "false" ]]; then
    rm "${cf}"
fi
if [[ "${bcf}" != "${cf}" ]]; then
    rm "${bcf}"
fi
