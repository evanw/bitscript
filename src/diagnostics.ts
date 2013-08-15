function tokenKindToText(kind: string): string {
  return new RegExp('\\w').test(kind) ? kind : '"' + kind + '"';
}

////////////////////////////////////////////////////////////////////////////////
// Syntax diagnostics
////////////////////////////////////////////////////////////////////////////////

function syntaxErrorUnexpectedToken(log: Log, token: Token) {
  log.error(token.range, 'unexpected ' + tokenKindToText(token.kind));
}

function syntaxErrorExpectedToken(log: Log, found: Token, expected: string) {
  log.error(found.range, 'expected ' + tokenKindToText(expected) + ' but found ' + tokenKindToText(found.kind));
}

function syntaxErrorBadEscapeSequence(log: Log, range: TRange, text: string) {
  log.error(range, 'bad escape sequence "' + text + '"');
}

function syntaxErrorExtraData(log: Log, range: TRange, text: string) {
  log.error(range, 'syntax error "' + text + '"');
}

////////////////////////////////////////////////////////////////////////////////
// Semantic diagnostics
////////////////////////////////////////////////////////////////////////////////

function semanticErrorDuplicateSymbol(log: Log, range: TRange, symbol: Symbol) {
  log.error(range, symbol.name + ' is already defined ' +
    (symbol.node !== null ? 'on line ' + symbol.node.range.start.line +
    (range.source.name !== symbol.node.range.source.name ? ' of ' +
    symbol.node.range.source.name : '') : 'internally'));
}

function semanticErrorIncompatibleTypes(log: Log, range: TRange, from: WrappedType, to: WrappedType) {
  log.error(range, 'cannot convert from ' + from.asString() + ' to ' + to.asString());
}

function semanticErrorCircularType(log: Log, range: TRange) {
  log.error(range, 'circular type');
}

function semanticErrorUnknownSymbol(log: Log, range: TRange, name: string) {
  log.error(range, name + ' is not defined');
}

function semanticErrorUnexpectedExpression(log: Log, range: TRange, type: WrappedType) {
  log.error(range, 'unexpected ' + type.asString());
}

function semanticErrorModifierConflict(log: Log, range: TRange, a: string, b: string) {
  log.error(range, 'cannot use both ' + a + ' and ' + b);
}
