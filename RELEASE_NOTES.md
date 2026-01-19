# Release notes

## v0.9.2 (2026-01-18)

- Client
  - Fix for not being able to load tracks whose filenames contained
    characters not handled by `encodeURL`
  - Playback errors now result in a dialog which reloads the UI when
    dismissed
  - Network errors are now handled similarly
  - Malformed filter inputs now result in an error dialog, rather than
    silently dropping on the floor
  - Other error handling improvements


## v0.9.1 (2026-01-08)

- Requires `thrasher-music-catalog` v0.8.3, for forward compatibility
- Small fixes related to Catalog update


## v0.9.0 (2025-12-28)

- Server
  - Spawned servers are now terminated when a Catalog update is
    detected. This is a brutalist fix, but it allows a player reload
    to pick up new data while the previous behavior required that and
    a server restart. A more elegant solution will come in the future
  - Spawned server TTL is now configurable via the argument `-ttl`,
    with a default of 60s (an increase from the old hardcoded value of
    40s)
- Client
  - Web client shuffle button moved to player controls, matching
    mobile


## v0.8.1 (2025-12-04)

- Server
  - Doc updates for serving PWA
  - Added redirect page for 502s, for PWA


## v0.8.0 (2025-11-26)

- Requires `thrasher-music-catalog` v0.8
- Server
  - New config element `listen`; support for running proxied
  - New argument `-tls` to enable https redirects
- Client
  - Mobile UI now installable as a PWA
  - Mobile now aware of orientation and reacts to changes
  - Tracklist now displays on mobile in portrait orientation
  - Filter search added to mobile
  - Fix for clearing queue on mobile


## v0.7.2 (2025-11-25)

- Client
  - Fix for non-mobile queue
  - Player now always starts playing when play button is pressed (edge
    cases like Bluetooth disconnects could prevent this, previously)


## v0.7.1 (2025-11-21)

- Client
  - Fix for malformed URL construction
  - Protocol no longer hardcoded, in preparation for PWA
  - Improvements and cleanups for mobile code and styling
  - Facets added to mobile


## v0.7.0 (2025-11-19)

- Server
  - Now uses the same config file as thrasher-music-tool for some
    configuration points
- Client
  - Minimal mobile client added
  - CSS tweaks to browser client


## v0.6.0 (2025-07-05)

- Server
  - Initial server now only redirects to a new connection on a random
    unused port, where an actual music server will be listening. This is
    preparatory work for mTLS auth
    - hostname and port are separate args now
    - Music servers shut down if a keepalive request is not made every
      ~40 seconds
  - 'Recent' button added to enqueue last 25 albums
  - musicPrefix defaults to musicDir in server
  - Default track sort order changed to y,b,n
  - Several command line args renamed
- Client
  - Cover art is now displayed
  - Query help added
  - Page title shows playing track
  - Queue alternates color per album
  - Other UI tweaks

## v0.5.0 (2025-05-12)

- Added current track highlighting
- Error handling improvements
- Batch loading of queue implemented

## v0.4.1 (2025-05-10)

- Initial functionality implemented
- Some niceties underway
