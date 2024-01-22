all: client

client:
	echo "#!/bin/sh" > client
	echo "node client.js \"\$$@\"" >> client
	chmod +x client

.PHONY: all client