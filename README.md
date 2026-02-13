# thrasher-music-service
Spotify for your personal music collection.

Linux and Mac OS (with
[`container`](https://github.com/apple/container)) are supported.

- [Server/Backend](#server)
- [Client](#client)
- [PWA Mode](#proxiespwa)
- [Roadmap](#roadmap)
- [Attributions](#attributions)


## Server

_N.B. There is no security or authentication built into this project
at the present time. It should only be run on private/unroutable
networks until v1.0.0. See the Roadmap for more information._

The server (AKA `tms-backend`) uses the same config file as
[thrasher-music-tool](https://github.com/firepear/thrasher-music-tool).
See its README for config file documentation, and how to create and
manage your catalog. When you're done, come back here to start
listening.

Currently, `tms-backend` runs in a container. Creating and launching
the container is handled by the build script (`./build.sh`), which
is compatible with Docker, Podman, and Apple's `container`.

The script will use the config file you set up to create your catalog
(`/etc/tmc.json`) to get the info it needs to build and run the
service. You shouldn't need to change anything if you already have a
working setup, though all fields marked as 'RFS' do need a value.

If the build process fails, or the container isn't behaving properly,
make edits as needed to `/etc/tmc.json` and re-run the build script.


## Client

Point a browser at the `REDIR-HOST:LISTEN-PORT` that you speficied to
launch a player instance

![Desktop client](https://github.com/firepear/thrasher-music-tool/tree/main/docs/dt.jpg)

There is a compact, more finger-friendly mobile UI at
`REDIR-HOST:LISTEN-PORT/m.html`. This is the interface that can be
presented as a PWA

![Mobile client](https://github.com/firepear/thrasher-music-tool/tree/main/docs/m.jpg)


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

- **Post-v0.14 to v1.0**
  - Everything until the 1.0 work will be polish and bugfixing
    work. No new features or capabilities are planned
- **v1.0.0**
  - Version 1.0.0 will happen when mTLS is put in place
  - This is what will allow the server to safely exist on the open
    internet, using X.509 style certs to bidirectionally authenticate
    clients and the server to each other
  - Some of the requirements for this have long been in place, for
    example each client getting its own server upon connecting
  - There is not presently a timeline for the remaining work
- **Post-1.0**
  - There are some additional pieces of functionality that I have
    thought about adding post-1.0
    - Support for other audio formats
    - Supporting music being held in multiple subtrees
  - But at the moment there are no concrete plans for that, and no
    plans at all for larger scale changes.



## Attributions

- Client audio capabilities by [Howler,js](https://github.com/goldfire/howler.js)
- Client notifications by [AlertifyJS](https://github.com/MohammadYounes/AlertifyJS)

All other code handwritten by me.
