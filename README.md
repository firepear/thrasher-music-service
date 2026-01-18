# thrasher-music-service
UI client and service for Thrasher

This is the piece you need to listen to music with Thrasher. You'll
need
[thrasher-music-tool](https://github.com/firepear/thrasher-music-tool)
(and its docs) to create and manage your music catalog. Once you have
that sorted, come back here.

## Running

The server is not yet daemonized or containerized. Running under
`tmux` is recommended.

```
cd server
go run .
```

- The server uses the same config file as
  [thrasher-music-tool](https://github.com/firepear/thrasher-music-tool)
  for most configuration points. See its README for config file
  documentation (and how to build/manage your catalog)
- The server should not be run as root. Point it at non-privileged
  ports in your config
- Do `go run . -h` to see all server command line options
- Point a browser at the `host:listen` that you speficied to
  launch a player instance
  - Each connection on the `listen` port spawns a new player
    server on an unused port from the `ports` range
  - This is to enable support for mTLS in the future
- There is a compact, more finger-friendly mobile UI at
  `host:listen/m.html`

## Proxies/PWA

To use the mobile UI in PWA mode, it must be served from an `https`
URL with a non-self-signed cert. The easiest way to do this is to run
nginx as a proxy, using a configuration like:

```
server {
    server_name HOSTNAME;
    listen IP:LISTEN ssl; # the connection server, running on LISTEN port

    listen IP:PORT_0 ssl; # first player server, using the first port in
                          # PORTS. repeat this line for all other PORTS

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
        proxy_pass http://127.0.0.1:$server_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

And a TMC config file like:

```
{ "artist_cutoff": 4,
  "musicdir": "/path/to/music",
  "dbfile": "/path/to/thrashermusic.db",
  "listen": "127.0.0.1:7189",
  "ports": "7190-7199",
  "hostname": "HOSTNAME" }
```

Next, in `/PATH/TO/thrasher_music_service/client` do

`cp app.webmanifest.sample app.webmanifest && cp 500.html.sample 500.html`

and edit them to supply the correct values for your system.

Finally, run the server with https redirects enabled: `go run . -tls`


## Attributions

- Client audio capabilities by [Howler,js](https://github.com/goldfire/howler.js)
- Client notifications by [AlertifyJS](https://github.com/MohammadYounes/AlertifyJS)
