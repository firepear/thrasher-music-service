#!/bin/bash
dockercmd=$(which docker 2>&1 || true)
if [[ "${dockercmd}" =~ ^which ]]; then
    dockercmd=$(which podman 2>&1 || true)
fi
if [[ "${dockercmd}" =~ ^which ]]; then
    echo "error: neither docker or podman found in PATH; bailing"
    exit 2
fi

${dockercmd} container stop tms-backend && \
    ${dockercmd} container rm tms-backend && \
    ${dockercmd} image rm tms-backend
${dockercmd} image prune -f
${dockercmd} build --tag tms-backend .
#${dockercmd} volume create gwg || true
${dockercmd} run --name tms-backend -d --restart always -p 9098:80 -p 11099:11099 -v gwg:/usr/share/nginx/html tms-backend

# copy the tms-backend config if the user didn't
if [[ ! -x tms-backend-config.json ]]; then
    cp assets/tms-backend-config.json .
fi
# copy config and web assets into container
${dockercmd} cp tms-backend-config.json tms-backend:/usr/share/nginx/html/
${dockercmd} cp assets/web/index.html tms-backend:/usr/share/nginx/html/
${dockercmd} cp assets/web/main.js tms-backend:/usr/share/nginx/html/

