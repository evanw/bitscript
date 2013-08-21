default: build

TSC=node_modules/typescript/bin/tsc
MOCHA=node_modules/mocha/bin/mocha

SOURCES= \
	src/common.ts \
	src/diagnostics.ts \
	src/tokens.ts \
	src/types.ts \
	src/symbols.ts \
	src/nativetypes.ts \
	src/ast.ts \
	src/parser.ts \
	src/grammar.ts \
	src/typelogic.ts \
	src/resolver.ts \
	src/compiler.ts \
	src/output.js.ts \
	src/output.cpp.ts \
	src/cli.ts

TESTS= \
	tests/common.ts \
	tests/statements.ts \
	tests/operators.ts \
	tests/modifiers.ts \
	tests/circular.ts

build:
	$(TSC) $(SOURCES) --sourcemap --out bitc.js
	python -c 'data = open("bitc.js").read(); open("bitc.js", "w").write(data.replace("var usr_bin_env_node;", "#!/usr/bin/env node"))'
	chmod +x bitc.js

watch:
	$(TSC) $(SOURCES) --sourcemap --out bitc.js -w

test:
	$(TSC) $(SOURCES) $(TESTS) --sourcemap --out test.js
	$(MOCHA)
