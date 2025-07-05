# Release notes


## v0.6.0 (2025-07-xx)

- Server
  - Initial server now only redirects to a new connection on a random
    unused port, where an actual music server will be listening. This is
    preparatory work for mTLS auth
    - hostname and port are separate args now
    - Music servers shut down if a keepalive request is not made every
      ~40 seconds
  - 'Recent' button added to enqueue last 25 albums
  - Cover art is now displayed
  - Other UI tweaks
  - musicPrefix defaults to musicDir in server
  - Default track sort order changed to y,b,n
  - Several command line args renamed
- Client
  - Query help added

## v0.5.0 (2025-05-12)

- Added current track highlighting
- Error handling improvements
- Batch loading of queue implemented

## v0.4.1 (2025-05-10)

- Initial functionality implemented
- Some niceties underway
