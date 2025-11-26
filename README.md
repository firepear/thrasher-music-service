# thrasher-music-service
UI service and client for Thrasher

## Running

The server is not yet daemonized or containerized.

```
cd server
go run .
```

The server uses the same config file as
[thrasher-music-tool](https://github.com/firepear/thrasher-music-tool)
for most configuration points. See its README for config file
documentation (and how to build/manage your catalog)

Point a browser at the `host:port` that you speficied to launch a
player instance.

## Options

Do `go run . -h` to see all server command line options.

## Proxies/PWA

To use the mobile UI in PWA mode, it must be served from an `https`
URL with a non-self-signed cert. The easiest way to do this is to set
up nginx as a proxy, using a configuration like:

```
server {
        server_name HOSTNAME;
        listen IP_ADDR:7189 ssl; # main server listen port
        listen IP_ADDR:7190 ssl; # repeat this line for each port in the srvr range

        ssl_certificate      /etc/letsencrypt/live/HOSTNAME/fullchain.pem;
        ssl_certificate_key  /etc/letsencrypt/live/HOSTNAME/privkey.pem;
        ssl_session_cache    shared:SSL:1m;
        ssl_session_timeout  5m;
        ssl_ciphers  HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers  on;

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

Finally, run the server with https redirects enabled: `go run . -tls`

## Attributions

- Client audio capabilities by [Howler,js](https://github.com/goldfire/howler.js)
- Client notifications by [AlertifyJS](https://github.com/MohammadYounes/AlertifyJS)
