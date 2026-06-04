
~~~~bash

pnpm build --base /typst-collab/
du -sh dist
mv dist typst-collab
@send-to-dl-dir typst-collab
rm -rf typst-collab



## DALC

pnpm build --base /apps/typst-collab/
rsync -avzu --delete dist/ dalc:/var/www/html/apps/typst-collab/ && touch .lastsync-dalc

~~~~
