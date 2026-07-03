#!/bin/sh
set -eu

awk '{
  result = ""
  rest = $0
  while (match(rest, /\$[{]?[A-Za-z_][A-Za-z_0-9]*[}]?/)) {
    token = substr(rest, RSTART, RLENGTH)
    varname = token
    sub(/^\$\{?/, "", varname)
    sub(/\}?$/, "", varname)
    if (varname in ENVIRON) {
      result = result substr(rest, 1, RSTART - 1) ENVIRON[varname]
    } else {
      result = result substr(rest, 1, RSTART + RLENGTH - 1)
    }
    rest = substr(rest, RSTART + RLENGTH)
  }
  print result rest
}' /home/kong/temp.yml > "$KONG_DECLARATIVE_CONFIG"

exec /docker-entrypoint.sh kong docker-start
