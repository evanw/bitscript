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

function syntaxErrorBadEscapeSequence(log: Log, range: SourceRange, text: string) {
  log.error(range, 'bad escape sequence "' + text + '"');
}

function syntaxErrorExtraData(log: Log, range: SourceRange, text: string) {
  log.error(range, 'syntax error "' + text + '"');
}

function syntaxErrorDuplicateModifier(log: Log, token: Token) {
  log.error(token.range, 'duplicate ' + token.text + ' modifier');
}

////////////////////////////////////////////////////////////////////////////////
// Semantic diagnostics
////////////////////////////////////////////////////////////////////////////////

function semanticErrorDuplicateSymbol(log: Log, range: SourceRange, symbol: Symbol) {
  log.error(range, symbol.name + ' is already defined ' +
    (symbol.node !== null ? 'on line ' + symbol.node.range.start.line +
    (range.source.name !== symbol.node.range.source.name ? ' of ' +
    symbol.node.range.source.name : '') : 'internally'));
}

function semanticErrorIncompatibleTypes(log: Log, range: SourceRange, from: WrappedType, to: WrappedType) {
  log.error(range, 'cannot convert from ' + from + ' to ' + to);
}

function semanticErrorCircularType(log: Log, range: SourceRange) {
  log.error(range, 'circular type');
}

function semanticErrorUnknownSymbol(log: Log, range: SourceRange, name: string) {
  log.error(range, name + ' is not defined');
}

function semanticErrorUnexpectedExpression(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'unexpected ' + type);
}

function semanticErrorPointerModifierConflict(log: Log, range: SourceRange) {
  log.error(range, 'cannot use both owned and shared');
}

function semanticErrorInvalidPointerModifier(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot make a pointer to ' + type);
}

function semanticErrorUnexpectedStatement(log: Log, range: SourceRange, text: string) {
  log.error(range, 'cannot use ' + text + ' here');
}

function semanticErrorInvalidNew(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot use new on ' + type);
}

function semanticErrorInvalidCall(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot call ' + type);
}

function semanticErrorArgumentCount(log: Log, range: SourceRange, expected: number, found: number) {
  log.error(range,
    'expected ' + expected + ' argument' + (expected === 1 ? '' : 's') +
    ' but found ' + found + ' argument' + (found === 1 ? '' : 's'));
}

function semanticErrorRValueToRawPointer(log: Log, range: SourceRange) {
  log.error(range, 'new object will be deleted immediately (store it somewhere with an owned or shared type instead)');
}

function semanticErrorNoMembers(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'no members on ' + type);
}

function semanticErrorUnknownMemberSymbol(log: Log, range: SourceRange, name: string, type: WrappedType) {
  log.error(range, name + ' is not defined on ' + type);
}

function semanticErrorNoUnaryOperator(log: Log, range: SourceRange, op: string, type: WrappedType) {
  log.error(range, 'no unary operator ' + op + ' for ' + type);
}

function semanticErrorNoBinaryOperator(log: Log, range: SourceRange, op: string, left: WrappedType, right: WrappedType) {
  log.error(range, 'no binary operator ' + op + ' for ' + left + ' and ' + right);
}

function semanticErrorExpectedReturnValue(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'return statement must return ' + type);
}

function semanticErrorBadStorage(log: Log, range: SourceRange) {
  log.error(range, 'cannot store to this location');
}

function semanticErrorBadBaseType(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot inherit from ' + type);
}

function semanticErrorNoCommonType(log: Log, range: SourceRange, a: WrappedType, b: WrappedType) {
  log.error(range, 'no common type for ' + a + ' and ' + b);
}

function semanticErrorUnexpectedModifier(log: Log, range: SourceRange, modifier: string, why: string) {
  log.error(range, 'cannot use the ' + modifier + ' modifier ' + why);
}

function semanticErrorModifierOverMissingBase(log: Log, range: SourceRange, name: string) {
  log.error(range, name + ' has the "over" modifier but does not override anything');
}

function semanticErrorModifierMissingOver(log: Log, range: SourceRange, name: string) {
  log.error(range, name + ' overrides another symbol with the same name but is missing the "over" modifier');
}

function semanticErrorOverrideNotFunctions(log: Log, range: SourceRange, name: string, base: ObjectType) {
  log.error(range, name + ' overrides symbol with the same name in base class ' + base.asString());
}

function semanticErrorOverrideDifferentTypes(log: Log, range: SourceRange, name: string, base: WrappedType, derived: WrappedType) {
  log.error(range, name + ' must have the same signature as the function it overrides (' + derived.asString() + ' overrides ' + base.asString() + ')');
}

function semanticErrorAbstractNew(log: Log, node: Expression) {
  log.error(node.range, 'cannot use new on abstract ' + node.computedType);
}

function semanticErrorCannotParameterize(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot parameterize ' + type);
}

function semanticErrorParameterCount(log: Log, range: SourceRange, expected: number, found: number) {
  log.error(range,
    'expected ' + expected + ' type parameter' + (expected === 1 ? '' : 's') +
    ' but found ' + found + ' type parameter' + (found === 1 ? '' : 's'));
}

function semanticErrorUnparameterizedExpression(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot use unparameterized ' + type);
}

function semanticErrorParameterizedExpression(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot use parameterized ' + type);
}

function semanticErrorBadParameter(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot use ' + type + ' as a type parameter');
}

function semanticErrorReleaseAndUse(log: Log, range: SourceRange, symbol: Symbol) {
  log.error(range, symbol.name + ' is both released and used in the same expression');
}
