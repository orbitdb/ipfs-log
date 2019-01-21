all: build

deps:
	npm install

test: deps
	npm run test
	npm run test:browser
	
build: test
	npm run build
	@echo "Build success!"
	@echo "Built: 'dist/', 'examples/browser/'"

clean:
	rm -rf ipfs/
	rm -rf ipfs-log-benchmarks/
	rm -rf node_modules/
	rm -rf coverage/
	rm -rf test/keystore/

clean-dependencies: clean
	rm -f package-lock.json

rebuild: | clean-dependencies build
	
.PHONY: test
