
~~~~bash

pnpm build --base /typst-collab/
du -sh dist
mv dist typst-collab
@send-to-dl-dir typst-collab
rm -rf typst-collab

~~~~
