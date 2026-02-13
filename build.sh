#!/usr/bin/env bash

set -e

# check bash version
if [[ "${BASH_VERSINFO[0]}" < "5" ]]; then
    echo "error: bash v5.x+ needed; this is v${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"
    exit 1
fi

# find a way to build containers
echo -n "looking for container tool... "
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

# go.work will screw up the build, so hide it for this process
if [[ -f go.work ]]; then
    mv go.work go.notwork
fi

# contianer and image maintenance
echo ">> Pre-build cleanup"
${dockercmd} container stop "${name}"
${dockercmd} container rm "${name}"
${dockercmd} image rm "${name}"
${dockercmd} image prune -f

echo ">> Building image ${name}"
# do the actual build
${dockercmd} build --build-arg tmslisten="${config['listen-port']}" \
             --build-arg tmsports="${config['srvr-ports']}" \
             --build-arg configfile="${bcf}" --tag "${name}" .

echo ">> Starting container ${name}"
${dockercmd} run --name "${name}" -d --restart unless-stopped \
             -p "${config['listen-port']}:${config['listen-port']}" \
             -p "${config['srvr-ports']}:${config['srvr-ports']}" \
             -v "${config['musicdir']}:/Music:ro" "${name}"

# clean up
echo ">> Post-build cleanup"
${dockercmd} image prune -f
if [[ "${custom}" == "false" ]]; then
    rm "${cf}"
fi
if [[ "${bcf}" != "${cf}" ]]; then
    rm "${bcf}"
fi
if [[ -f go.notwork ]]; then
    mv go.notwork go.work
fi
