# thrasher-music-service
UI client and service for Thrasher

This is the piece you need to listen to music with Thrasher. You'll
need
[thrasher-music-tool](https://github.com/firepear/thrasher-music-tool)
(and its docs) to create and manage your music catalog. Once you have
that sorted, come back here.

- [Running the backend](#running-the-backend)
  - [Containerized](#containerized)
  - [Non-containerized](#non-containerized)
- [PWA Mode](#proxiespwa)
- [Roadmap](#roadmap)
- [Attributions](#attributions)


## Running the backend

- The server uses the same config file as
  [thrasher-music-tool](https://github.com/firepear/thrasher-music-tool)
  for most configuration points. See its README for config file
  documentation (and how to build/manage your catalog)
- The server should not be run as root. Point it at non-privileged
  ports in your config
- Do `go run ./cmd/tms-backend -h` to see all server command line options
- Point a browser at the `host:listen` that you speficied to
  launch a player instance
  - Each connection on the `listen` port spawns a new player
    server on an unused port from the `ports` range
  - This is to enable support for mTLS in the future
- There is a compact, more finger-friendly mobile UI at
  `host:listen/m.html`

### Containerized

For all the usual safety and ease-of-use reasons, it is preferred to
run `tms-backend` in a container. To do this, run the build script
(`./build.sh`), which should be compatible with both Docker and
Podman, though you'll need to run it as root if you aren't setup for
rootless Podman.

The build script will use the config file you set up to create your
catalog (`/etc/tmc.json`) to get the info it needs to build an image
and container. You shouldn't need to change anything if you already
have a working setup.

If the build process fails, or the container isn't behaving properly,
make edits to `/etc/tmc.json` and re-run the build script.

### Non-continerized

If you do not want to run the backend containerized, running under
`tmux` is recommended.

```
cd cmd/tms-backend
go run .
```



## Proxies/PWA

The TMS mobile client UI can be used standalone or as a PWA. If you
don't want to use the PWA functionality, then Thrasher is a wholly
self-contained system, requiring no extra running software.

TMS itself also doesn't speak HTTPS (by design), so to use it as a PWA
you'll need an HTTPS proxy server to handle the cert and provide TLS
termination.

Documented here is one way to do this is, by running nginx with a
configuration like:

```
server {
    server_name REDIR-HOST;
    listen LISTEN-IF:LISTEN-PORT ssl; # the connection server

    listen LISTEN-IF:SERVER-PORTS[0] ssl; # first port in srvr-ports
                                          # repeat this line for all others

    ssl_certificate     /etc/letsencrypt/live/HOSTNAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/HOSTNAME/privkey.pem;
    ssl_session_cache   shared:SSL:1m;
    ssl_session_timeout 5m;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers  on;

    # custom 502 page, which will redirect to LISTEN. this allows PWAs whose servers
    # have died off to reconnect without manual intervention
    error_page 502 /500.html;
    location /500.html {
        root   /PATH/TO/thrasher-music-service/client;
    }

    # no changes needed in proxy config
    location / {
        proxy_pass http://127.0.0.1:$server_port; # assumes tms-backend is running on
                                                  # the same machine; change if not
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

You'll also need to set `"tls": true` in `/etc/tmc.json` so that
redirects use a scheme of `https` after we rebuild the container in a
few more steps.

Next, in `/PATH/TO/thrasher_music_service/client` do

`cp app.webmanifest.sample app.webmanifest && cp 500.html.sample 500.html`

and edit them to supply the correct values for your system.

Finally, re-run `build.sh` so that all these changes take effect.



## Roadmap

### v1.0.0

- v1.0 will be released when mTLS is implemented and well-tested
- All other initially planned functionality is in place, as of v0.10.0
  - Any releases between v0.10 and v1.0 will be for bugfixes, polish,
    and tweaks

### Post-1.0

There are some additional pieces of functionality that I have thought
about adding post-1.0, like:

- Support for other audio formats
- Supporting music being held in multiple subtrees

But at the moment there are no concrete plans for that, and no plans
at all for larger scale changes.



## Attributions

- Client audio capabilities by [Howler,js](https://github.com/goldfire/howler.js)
- Client notifications by [AlertifyJS](https://github.com/MohammadYounes/AlertifyJS)

All other code handwritten by me.
