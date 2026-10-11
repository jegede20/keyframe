#!/bin/bash
# Extract the handful of system libraries Chrome needs, without root.
# Installs into /home/user/.libs/chrome-deps; run browser suites with
#   export LD_LIBRARY_PATH=/home/user/.libs/chrome-deps/usr/lib/x86_64-linux-gnu
set -u
POOL=${POOL:-http://deb.debian.org/debian/pool/main}
DEST=${DEST:-/home/user/.libs/chrome-deps}
mkdir -p "$DEST"

grab() {  # $1 = pool dir, $2 = regex for the .deb name
  local dir="$1" pat="$2" url
  url=$(curl -sfL "$POOL/$dir/" | grep -oE "$pat" | sort -V | tail -1)
  if [ -z "$url" ]; then echo "  !! not found: $pat"; return 1; fi
  curl -sfL "$POOL/$dir/$url" -o "/tmp/$url" && dpkg-deb -x "/tmp/$url" "$DEST" && echo "  + $url"
}

grab n/nspr      'libnspr4_[0-9][^"]*_amd64\.deb'
grab n/nss       'libnss3_[^"]*_amd64\.deb'
grab a/atk1.0    'libatk1\.0-0[^"]*_amd64\.deb'
grab a/at-spi2-atk 'libatk-bridge2\.0-0[^"]*_amd64\.deb'
grab a/at-spi2-core 'libatspi2\.0-0[^"]*_amd64\.deb'
grab c/cups      'libcups2[^"]*_amd64\.deb'
grab a/alsa-lib  'libasound2[^"]*_amd64\.deb'
grab libx/libxkbcommon 'libxkbcommon0[^"]*_amd64\.deb'
grab libx/libxdamage   'libxdamage1[^"]*_amd64\.deb'
grab a/avahi     'libavahi-client3[^"]*_amd64\.deb'
grab a/avahi     'libavahi-common3[^"]*_amd64\.deb'

echo
echo "libs in $DEST. Sanity check:"
CHROME=${CHROME:-$(choreo_get_chrome 2>/dev/null | tail -1)}
LD_LIBRARY_PATH="$DEST/usr/lib/x86_64-linux-gnu" "$CHROME" --version 2>&1 | tail -1
