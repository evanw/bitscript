default: build

SOURCES= \
	src/common.ts \
	src/diagnostics.ts \
	src/tokens.ts \
	src/types.ts \
	src/symbols.ts \
	src/ast.ts \
	src/parser.ts \
	src/grammar.ts \
	src/typelogic.ts \
	src/resolver.ts \
	src/compiler.ts

TESTS= \
	tests/common.ts \
	tests/statements.ts \
	tests/modifiers.ts

build:
	time tsc $(SOURCES) --sourcemap --out compiled.js

watch:
	tsc $(SOURCES) --sourcemap --out compiled.js -w

test:
	time tsc $(SOURCES) $(TESTS) --sourcemap --out test.js
	mocha
