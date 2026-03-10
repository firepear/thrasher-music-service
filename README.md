# thrasher-music-service
Spotify for your personal music collection -- search, filter, and
playback on demand.

TMS is one part of the Thrasher system, which forms a complete music
library management system that supports tagging music in whatever way
makes sense to you, and keeps ID3 tags in sync with music catalog
changes so they're always your source of truth.

Linux and Mac OS are supported.

- [Server/Backend](#server)
- [Client](#client)
- [Security](#security)
  - [TLS](#tlsproxy)
  - [PWA mode](#pwamode)
  - [Basic Auth](#basicauth)
- [Roadmap](#roadmap)
- [Attributions](#attributions)


## Server

The server uses the same config file as
[thrasher-music-tool](https://github.com/firepear/thrasher-music-tool).
See its README for config file documentation, and how to create and
manage your catalog. When you're done, come back here to start
listening.

TMS's server component (`tms-backend`) runs in a container. Creating
and launching the container is handled by the script `./build.sh`,
which is compatible with Docker, Podman, and Apple's `container`.

The script will use the config file you set up to create your catalog
(`/etc/tmc.json`) to get the info it needs to build and run the
service. You shouldn't need to change anything if you already have a
working setup, though all fields marked as 'RFS' do need a value.

If the build process fails, or the container isn't behaving properly,
make edits as needed to `/etc/tmc.json` and re-run the build script.


## Client

Point a browser at the `REDIR-HOST:LISTEN-PORT` that you speficied to
launch a player instance

![Desktop client](https://github.com/firepear/thrasher-music-service/blob/main/docs/dt.jpg)

- Select options in the Facets pane to queue music by facet
- Select options in the Artists pane to queue music by artist
  - Use the Filter box to narrow down the artist list
- Type a query filter in the 'Search' box to queue tracks that match the
  filter specified
- Click the 'Recent' button to queue the 25 most recenty added albums
- 'Clear' will unselect everything and clear the playback queue
- Click cover art to see a bigger version (and click again to dismiss)
- Type `h` or `?` to see a keybindings popup

There is a compact, more finger-friendly mobile UI at
`REDIR-HOST:LISTEN-PORT/m.html`. This is the interface that can be
presented as a PWA

![Mobile client](https://github.com/firepear/thrasher-music-service/blob/main/docs/m.jpg)


## Security

TMS, currently, doesn't speak HTTPS. So when it is run "naked" there
is no security. As such, it should only be run like this on private
networks.

### TLS Proxy

To deploy TMS on a public network, you'll need an SSL/TLS terminating
proxy in front of it, like Nginx with a configuration like:

```
server {
    server_name REDIR-HOST;
    listen LISTEN-IF:443 ssl;             # the connection server

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

> Note: this document assumes you are running Nginx as an OS-level
> service, rather than in a container of its own. Tweaking
> configurations to support other modes of operations is too broad to
> be covered here.

Once Nginx is set up correctly, you'll also need to set `"tls": true`
in `/etc/tmc.json` and rebuild the TMS container.

### PWA mode

With TLS enabled, the TMS mobile client UI can be used as a
[Progressice Web App](https://web.dev/learn/pwa/welcome) on platforms
which support them.  To enable this, in
`/PATH/TO/thrasher_music_service/client`, do:

`cp app.webmanifest.sample app.webmanifest && cp 500.html.sample 500.html`

Then edit those files to supply the correct values for your
system. Once satisfied, rebuild the container to have the changes take
effect.

When you load up the client, you should be able to install it
as "Thrasher".

### Basic auth

Eventually (see below in _Roadmap_) TMS will support mTLS
authentication and no longer need a proxy for TLS termination. Until
then, to deploy a public-facing instance with some level of security,
configure your proxy to use Basic Authentication by adding these lines
to the `location / {` block of your Nginx config:

```
            auth_basic "Thrasher login";
            auth_basic_user_file "/PATH/TO/.htpasswd";
```

(Setting up the `htpasswd` file is left as an exercise for the
reader.)

Then restart Nginx and login. It is irritating that you'll have to
login on every port that a server can be spawned on, until your
browser has seen them all, but this is very much a stopgap solution.


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
