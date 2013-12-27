default: build

TSC=node_modules/typescript/bin/tsc
MOCHA=node_modules/mocha/bin/mocha

SOURCES= \
	src/core/common.ts \
	src/core/diagnostics.ts \
	src/core/tokens.ts \
	src/core/types.ts \
	src/core/symbols.ts \
	src/core/nativetypes.ts \
	src/core/ast.ts \
	src/core/parser.ts \
	src/core/grammar.ts \
	src/core/typelogic.ts \
	src/core/resolver.ts \
	src/core/compiler.ts \
	src/core/binarylayout.ts \
	src/js/library.js.ts \
	src/js/output.js.ts \
	src/asmjs/output.asmjs.ts \
	src/cpp/library.cpp.ts\
	src/cpp/output.cpp.ts

TESTS= \
	tests/common.ts \
	tests/conversions.ts \
	tests/final.ts \
	tests/circular.ts
	# tests/cpp.ts \
	# tests/js.ts \
	# tests/statements.ts \
	# tests/operators.ts \
	# tests/modifiers.ts \

build:
	$(TSC) $(SOURCES) src/core/cli.ts --sourcemap --out compiled.js
	python -c 'open("bitc", "w").write(open("compiled.js").read().replace("var usr_bin_env_node;", "#!/usr/bin/env node"))'
	chmod +x bitc

watch:
	$(TSC) $(SOURCES) src/core/cli.ts --sourcemap --out compiled.js -w

test:
	$(TSC) $(SOURCES) $(TESTS) --sourcemap --out test.js
	$(MOCHA)
