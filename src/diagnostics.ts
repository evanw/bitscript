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

function syntaxErrorDuplicateModifier(log: Log, token: Token) {
  log.error(token.range, 'duplicate ' + token.text + ' modifier');
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
  log.error(range, 'cannot convert from ' + from + ' to ' + to);
}

function semanticErrorCircularType(log: Log, range: TRange) {
  log.error(range, 'circular type');
}

function semanticErrorUnknownSymbol(log: Log, range: TRange, name: string) {
  log.error(range, name + ' is not defined');
}

function semanticErrorUnexpectedExpression(log: Log, range: TRange, type: WrappedType) {
  log.error(range, 'unexpected ' + type);
}

function semanticErrorPointerModifierConflict(log: Log, range: TRange) {
  log.error(range, 'can only use one of ref, shared, or owned');
}

function semanticErrorInvalidPointerModifier(log: Log, range: TRange, type: WrappedType) {
  log.error(range, 'cannot make a pointer to ' + type);
}

function semanticErrorUnexpectedStatement(log: Log, range: TRange, text: string) {
  log.error(range, 'cannot use ' + text + ' here');
}

function semanticErrorInvalidNew(log: Log, range: TRange, type: WrappedType) {
  log.error(range, 'cannot use new on ' + type);
}

function semanticErrorInvalidCall(log: Log, range: TRange, type: WrappedType) {
  log.error(range, 'cannot call ' + type);
}

function semanticErrorArgumentCount(log: Log, range: TRange, expected: number, found: number) {
  log.error(range,
    'expected ' + expected + ' argument' + (expected === 1 ? '' : 's') +
    ' but found ' + found + ' argument' + (found === 1 ? '' : 's'));
}

function semanticErrorRValueToRef(log: Log, range: TRange) {
  log.error(range, 'new object will be deleted immediately (store it somewhere with an owned or shared type instead)');
}

function semanticErrorNoMembers(log: Log, range: TRange, type: WrappedType) {
  log.error(range, 'no members on ' + type);
}

function semanticErrorUnknownMemberSymbol(log: Log, range: TRange, name: string, type: WrappedType) {
  log.error(range, name + ' is not defined on ' + type);
}
