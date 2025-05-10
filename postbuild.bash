#!/bin/bash

cd $(dirname $0)
if cd ./dist; then
  find ../src -name "*.tsx" -exec fgrep "<Route " {} \; | perl -pe 's%.*<Route path="(.*?)/?".*%\1%g' | grep -v "^$" | while read P; do
    echo "Creatubg structure for $P ..."
    INDEX_HTML=$(printf '../%.0s' $(seq 1 $(grep -o "/" <<<"$P" | wc -l)))index.html
    if mkdir -p ".$P" && ln -snf $INDEX_HTML ".$P/"; then
      echo "Done :)"
    else
      echo "Failed :("
      exit 1
    fi
  done
fi
