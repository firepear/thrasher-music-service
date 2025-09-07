# thrasher-music-service
UI service and client for Thrasher

## Running

The server is not yet daemonized or containerized.

```
cd server
go run .
```

The server uses the same config file as thrasher-music-tool for most
configuration points. See its README for config file documentation,
and do `go run . -h` to see all server arguments.

## Attributions

- Client audio capabilities by [Howler,js](https://github.com/goldfire/howler.js)
- Client notifications by [AlertifyJS](https://github.com/MohammadYounes/AlertifyJS)
