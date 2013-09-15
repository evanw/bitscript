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

function semanticErrorNeedMoveOrCopy(log: Log, range: SourceRange, from: WrappedType, to: WrappedType) {
  log.error(range, 'need "move" or "copy" to convert from ' + from + ' to ' + to);
}

function semanticErrorBadMoveOrCopy(log: Log, range: SourceRange, type: WrappedType, name: string) {
  log.error(range, 'cannot ' + name + ' ' + type);
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

function semanticErrorInvalidTypeKind(log: Log, range: SourceRange, type: WrappedType, kind: TypeKind) {
  log.error(range, 'cannot make a ' + (kind === TypeKind.POINTER ? 'pointer' : 'reference') + ' to ' + type);
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

function semanticErrorRValueToRef(log: Log, range: SourceRange) {
  log.error(range, 'new object will be deleted immediately (store it in a value or an owned pointer instead)');
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

function semanticErrorDuplicateModifier(log: Log, range: SourceRange, modifier: string) {
  log.error(range, 'duplicate modifier ' + modifier);
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
  log.error(node.range, 'cannot construct abstract ' + node.computedType);
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

function semanticErrorMoveAndUse(log: Log, range: SourceRange, symbol: Symbol) {
  log.error(range, symbol.name + ' is both moved and used in the same expression');
}

function semanticErrorBadMove(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot move ' + type);
}

function semanticErrorExpectedMove(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot move ' + type + ' without a move expression');
}

function semanticErrorBadVariableType(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'cannot create variable of ' + (type.isObject() && type.asObject().isAbstract() ? 'abstract ' : '') + type);
}

function semanticErrorVariableNeedsValue(log: Log, range: SourceRange, type: WrappedType) {
  log.error(range, 'variable of ' + type + ' must be initialized');
}

function semanticErrorWrongMemberOperator(log: Log, range: SourceRange, type: WrappedType, op: string) {
  log.error(range, 'use ' + op + ' to access members of ' + type.withoutModifier(TypeModifier.INSTANCE));
}

function semanticErrorNestedMoveOrCopy(log: Log, range: SourceRange, name: string) {
  log.error(range, 'cannot use ' + name + ' on an expression that has already been moved or copied');
}

function semanticErrorMemberUnexpectedStatic(log: Log, range: SourceRange, name: string) {
  log.error(range, 'cannot access static member ' + name + ' from instance context');
}

function semanticErrorMemberUnexpectedInstance(log: Log, range: SourceRange, name: string) {
  log.error(range, 'cannot access instance member ' + name + ' from static context');
}
