enum ImplicitConversion {
  NORMAL,
  ASSIGNMENT,
}

class ResolverContext {
  constructor(
    public scope: Scope,
    public staticContext: boolean,
    public enclosingLoop: boolean,
    public enclosingObject: ObjectType,
    public enclosingFunction: FunctionType) {
  }

  static globalContext(scope: Scope): ResolverContext {
    return new ResolverContext(scope, false, false, null, null);
  }

  canAccessThis(): boolean {
    return this.isInObject() && !this.staticContext;
  }

  isInLoop(): boolean {
    return this.enclosingLoop;
  }

  isInObject(): boolean {
    return this.enclosingObject !== null;
  }

  isInFunction(): boolean {
    return this.enclosingFunction !== null;
  }

  clone(): ResolverContext {
    return new ResolverContext(
      this.scope,
      this.staticContext,
      this.enclosingLoop,
      this.enclosingObject,
      this.enclosingFunction);
  }

  cloneWithScope(scope: Scope): ResolverContext {
    var clone = this.clone();
    clone.scope = scope;
    return clone;
  }

  cloneForLoop(): ResolverContext {
    var clone = this.clone();
    clone.enclosingLoop = true;
    return clone;
  }

  cloneForObject(symbol: Symbol): ResolverContext {
    var clone = this.clone();
    clone.enclosingObject = symbol.type.asObject();
    return clone;
  }

  cloneForFunction(symbol: Symbol): ResolverContext {
    var clone = this.clone();
    clone.staticContext = symbol.isStatic();
    clone.enclosingFunction = symbol.type.asFunction();
    return clone;
  }

  cloneForVariable(symbol: Symbol): ResolverContext {
    var clone = this.clone();
    clone.staticContext = true;
    return clone;
  }
}

class DeclarationInitializer implements DeclarationVisitor<WrappedType> {
  constructor(
    public resolver: Resolver) {
  }

  visitObjectDeclaration(node: ObjectDeclaration): WrappedType {
    // Check modifiers
    this.resolver.ignoreModifier(node, SymbolModifier.OVER, 'over', 'on a class declaration');
    this.resolver.ignoreModifier(node, SymbolModifier.FINAL, 'final', 'on a class declaration');
    this.resolver.ignoreModifier(node, SymbolModifier.STATIC, 'static', 'on a class declaration');

    // Create the block scope
    node.block.scope = new Scope(this.resolver.context.scope);
    var type: ObjectType = new ObjectType(node.symbol.name, node.block.scope);

    // Find the base class if there is one
    if (node.base !== null) {
      this.resolver.resolveAsType(node.base);

      // Avoid reporting further errors
      var baseType: WrappedType = node.base.computedType;
      if (baseType.isError()) {
        return NativeTypes.ERROR.wrapValue();
      }

      // Can only inherit from objects
      if (!baseType.isValue() || !baseType.isObject() || baseType.asObject().isSealed) {
        semanticErrorBadBaseType(this.resolver.log, node.base.range, baseType);
        return NativeTypes.ERROR.wrapValue();
      }

      // Base type is valid (no need to check for cycles since
      // cycle detection is done for all declarations anyway)
      type.baseType = baseType.asObject();
      type.baseType.hasDerivedTypes = true;

      // Mix the symbols from the base scope in with this block's symbols
      // to make detecting abstract vs fully implemented types easier
      type.baseType.scope.symbols().forEach(s => node.block.scope.replace(s));
    }

    // Populate the block scope
    this.resolver.pushContext(this.resolver.context.cloneWithScope(node.block.scope));
    this.resolver.initializeBlock(node.block);
    this.resolver.popContext();

    // Link all member variable symbols with this type
    node.block.statements.forEach(n => {
      if (n instanceof Declaration) {
        (<Declaration>n).symbol.enclosingObject = type;
      }
    });

    // Lazily compute some class information (see ObjectType for the reason why)
    type.lazyInitializer = () => {
      node.block.scope.symbols().forEach(s => this.resolver.ensureDeclarationIsInitialized(s.node));
      var baseArgTypes: WrappedType[] = type.baseType !== null ? type.baseType.constructorType().args : [];
      var argTypes: WrappedType[] = node.block.statements
        .filter(n => n instanceof VariableDeclaration && (<VariableDeclaration>n).value === null)
        .map(n => (<VariableDeclaration>n).symbol.type);
      type._isAbstract = node.block.scope.containsAbstractSymbols();
      type._constructorType = new FunctionType(null, baseArgTypes.concat(argTypes));
    };

    // TODO: A type is invalid if it contains, directly or indirectly,
    // infinite storage due to containing a value of itself

    return type.wrapValueType();
  }

  visitFunctionDeclaration(node: FunctionDeclaration): WrappedType {
    // Check modifiers
    this.resolver.checkOverModifier(node);
    this.resolver.ignoreModifier(node, SymbolModifier.FINAL, 'final', 'on a function declaration');
    if (node.symbol.enclosingObject === null) {
      this.resolver.ignoreModifier(node, SymbolModifier.STATIC, 'static', 'outside a class');
    }

    // All function symbols are final
    node.symbol.modifiers |= SymbolModifier.FINAL;

    // Special-case the return type for special functions
    var resultType: WrappedType;
    switch (node.kind) {
    case FunctionKind.NORMAL:
      this.resolver.resolveAsType(node.result);
      resultType = node.result.computedType;
      break;

    case FunctionKind.CONSTRUCTOR:
    case FunctionKind.COPY_CONSTRUCTOR:
    case FunctionKind.DESTRUCTOR:
    case FunctionKind.MOVE_DESTRUCTOR:
      resultType = NativeTypes.VOID.wrapValue();
      break;

    default:
      assert(false);
    }

    // Determine whether the function is abstract
    node.symbol.isAbstract = node.block === null;

    // Create the function scope
    node.scope = new Scope(this.resolver.context.scope);
    if (node.block !== null) {
      node.block.scope = new Scope(node.scope);
    }

    // Define the arguments in the function scope
    this.resolver.pushContext(this.resolver.context.cloneWithScope(node.scope));
    var args: WrappedType[] = node.args.map(n => {
      this.resolver.define(n);
      this.resolver.ensureDeclarationIsInitialized(n);
      n.symbol.isArgument = true;
      return n.symbol.type.withModifier(TypeModifier.INSTANCE);
    });
    this.resolver.popContext();

    // Avoid reporting further errors
    if (resultType.isError() || args.some(t => t.isError())) {
      return NativeTypes.ERROR.wrapValue();
    }

    return new FunctionType(resultType.withModifier(TypeModifier.INSTANCE), args).wrapValue().withModifier(TypeModifier.STORAGE);
  }

  visitVariableDeclaration(node: VariableDeclaration): WrappedType {
    // Check modifiers
    this.resolver.ignoreModifier(node, SymbolModifier.OVER, 'over', 'on a variable declaration');
    if (node.symbol.enclosingObject === null) {
      this.resolver.ignoreModifier(node, SymbolModifier.STATIC, 'static', 'outside a class');
    }

    // Resolve the type
    this.resolver.resolveAsType(node.type);

    // Validate variable type
    if (!TypeLogic.isValidVariableType(node.type.computedType)) {
      semanticErrorBadVariableType(this.resolver.log, node.type.range, node.type.computedType);
      return NativeTypes.ERROR.wrapValue();
    }

    return node.type.computedType.withModifier(TypeModifier.INSTANCE | TypeModifier.STORAGE);
  }
}

class Resolver implements StatementVisitor<void>, DeclarationVisitor<void>, ExpressionVisitor<void> {
  stack: ResolverContext[] = [];
  context: ResolverContext = ResolverContext.globalContext(NativeTypes.createGlobalScope());
  isInitialized: { [uniqueID: number]: boolean } = {};
  definitionContext: { [uniqueID: number]: ResolverContext } = {};
  initializer: DeclarationInitializer = new DeclarationInitializer(this);

  constructor(
    public log: Log) {
  }

  static resolve(log: Log, module: Module) {
    new Resolver(log).visitBlock(module.block);
  }

  pushContext(context: ResolverContext) {
    this.stack.push(this.context);
    this.context = context;
  }

  popContext() {
    assert(this.stack.length > 0);
    this.context = this.stack.pop();
  }

  resolve(node: Expression) {
    // Only resolve once
    if (node.computedType === null) {
      node.computedType = NativeTypes.ERROR.wrapValue();
      node.acceptExpressionVisitor(this);
    }
  }

  resolveAsExpression(node: Expression) {
    // Only resolve once
    if (node.computedType !== null) {
      return;
    }
    this.resolve(node);

    // Must be an instance
    if (!node.computedType.isError() && !node.computedType.isInstance()) {
      semanticErrorUnexpectedExpression(this.log, node.range, node.computedType);
      node.computedType = NativeTypes.ERROR.wrapValue();
    }
  }

  resolveAsType(node: Expression) {
    // Only resolve once
    if (node.computedType !== null) {
      return;
    }
    this.resolve(node);

    // Must not be an instance
    if (!node.computedType.isError() && node.computedType.isInstance()) {
      semanticErrorUnexpectedExpression(this.log, node.range, node.computedType);
      node.computedType = NativeTypes.ERROR.wrapValue();
    }
  }

  define(node: Declaration) {
    // Cache the context used to define the node so that when it's initialized
    // we can pass the context at the definition instead of at the use
    this.definitionContext[node.uniqueID] = this.context;

    // Always set the symbol so every declaration has one
    var scope: Scope = this.context.scope;
    node.symbol = new Symbol(node.id.name, null, scope);
    node.symbol.node = node;
    node.symbol.modifiers = node.modifiers;

    // Only add it to the scope if there isn't any conflict
    var symbol: Symbol = scope.find(node.id.name);
    if (symbol === null || symbol.scope !== scope) {
      scope.replace(node.symbol);
    } else {
      semanticErrorDuplicateSymbol(this.log, node.id.range, symbol);
    }
  }

  ignoreModifier(node: Declaration, modifier: number, name: string, why: string) {
    if ((node.modifiers & modifier) !== 0) {
      semanticErrorUnexpectedModifier(this.log, node.id.range, name, why);
      node.modifiers = node.modifiers & ~modifier;
    }
  }

  checkImplicitConversion(type: WrappedType, node: Expression, kind: ImplicitConversion) {
    if (type.isError() || node.computedType.isError()) {
      return;
    }

    // The implicit conversion must be valid
    if (!TypeLogic.canImplicitlyConvert(node.computedType, type)) {
      semanticErrorIncompatibleTypes(this.log, node.range, node.computedType, type);
      return;
    }

    // Make sure casting to a value type involves a copy or a move
    var isMoveOrCopy: boolean = node instanceof CopyExpression || node instanceof MoveExpression;
    var needsMoveOrCopy: boolean = type.isObject() &&
      (type.isValue() || type.isReference() && kind === ImplicitConversion.ASSIGNMENT) &&
      (!node.computedType.isValue() || node.computedType.isStorage());
    if (needsMoveOrCopy && !isMoveOrCopy) {
      semanticErrorNeedMoveOrCopy(this.log, node.range, node.computedType, type);
      return;
    }
  }

  checkCallArguments(range: SourceRange, type: FunctionType, args: Expression[]) {
    if (type.args.length !== args.length) {
      semanticErrorArgumentCount(this.log, range, type.args.length, args.length);
      return;
    }

    args.forEach((n, i) => {
      this.checkImplicitConversion(type.args[i], n, ImplicitConversion.NORMAL);
    });
  }

  ensureDeclarationIsInitialized(node: Declaration) {
    // Only initialize once (symbol should be set by block initialization)
    assert(node.symbol !== null);
    if (node.symbol.type !== null) {
      return;
    }

    // Set the symbol's type to the circular type sentinel for the duration
    // of the declaration's initialization. This way we can detect cycles
    // that try to use the symbol in its own type, such as 'foo foo;'. The
    // declaration should return NativeTypes.ERROR in this case.
    node.symbol.type = NativeTypes.CIRCULAR.wrapValue();
    this.pushContext(this.definitionContext[node.uniqueID]);
    var type: WrappedType = node.acceptDeclarationVisitor(this.initializer);
    this.popContext();
    assert(type !== null && !type.isCircular());
    node.symbol.type = type;
  }

  checkOverModifier(node: Declaration) {
    // Check for a valid override
    if (node.symbol.enclosingObject === null) {
      this.ignoreModifier(node, SymbolModifier.OVER, 'over', 'outside a class');
      return;
    }
    if (node.symbol.enclosingObject.baseType === null) {
      this.ignoreModifier(node, SymbolModifier.OVER, 'over', 'in a class with no base class');
      return;
    }

    // Find the symbol we are overriding
    var symbol: Symbol = this.findMemberSymbol(node.symbol.enclosingObject.baseType, node.id);
    if (symbol === null) {
      if (node.symbol.isOver()) {
        semanticErrorModifierOverMissingBase(this.log, node.id.range, node.id.name);
      }
      return;
    }

    // Avoid reporting further errors
    if (node.symbol.type.isError() || symbol.type.isError()) {
      return;
    }

    // Make sure the symbols are both function definitions (variables with function types don't count)
    if (!(node instanceof FunctionDeclaration) || !(symbol.node instanceof FunctionDeclaration)) {
      semanticErrorOverrideNotFunctions(this.log, node.id.range, node.id.name, symbol.enclosingObject);
      return;
    }

    // Validate the symbol type
    if (!TypeLogic.isValidOverride(node.symbol.type, symbol.type)) {
      semanticErrorOverrideDifferentTypes(this.log, node.id.range, node.id.name, symbol.type.innerType.wrapValue(), node.symbol.type.innerType.wrapValue());
      return;
    }

    // An "over" annotation is needed when overriding a symbol
    if (!node.symbol.isOver()) {
      semanticErrorModifierMissingOver(this.log, node.id.range, node.id.name);
      return;
    }

    // Mark the override
    node.symbol.overriddenSymbol = symbol;
    symbol.overriddenBySymbols.push(node.symbol);
  }

  checkAssigment(node: Expression) {
    // Can only assign to L-values
    if (!node.computedType.isStorage()) {
      semanticErrorBadStorage(this.log, node.range);
      return;
    }

    // Final symbols can never be redefined
    if (node.computedType.isFinal()) {
      semanticErrorAssigmentToFinal(this.log, node.range);
      return;
    }
  }

  initializeSymbol(symbol: Symbol, range: SourceRange): Symbol {
    // Only initialize the symbol once
    if (symbol.type === null) {
      assert(symbol.node !== null);
      this.pushContext(this.context.cloneWithScope(symbol.scope));
      this.ensureDeclarationIsInitialized(symbol.node);
      this.popContext();
      assert(symbol.type !== null);
    }

    // Detect cyclic symbol references such as 'foo foo;'
    if (symbol.type.isCircular()) {
      semanticErrorCircularType(this.log, range);
      symbol.type = NativeTypes.ERROR.wrapValue();
    }

    return symbol;
  }

  findSymbol(range: SourceRange, name: string): Symbol {
    var symbol: Symbol = this.context.scope.lexicalFind(name);
    return symbol === null ? null : this.initializeSymbol(symbol, range);
  }

  findMemberSymbol(type: ObjectType, id: Identifier): Symbol {
    var symbol: Symbol = type.scope.find(id.name);
    return symbol === null ? null : this.initializeSymbol(symbol, id.range);
  }

  visitBlock(node: Block) {
    // Some nodes (structs, functions) set this scope before calling this method
    if (node.scope === null) {
      node.scope = new Scope(this.context.scope);
    }

    // Resolve all statements
    this.pushContext(this.context.cloneWithScope(node.scope));
    this.initializeBlock(node);
    node.statements.forEach(n => n.acceptStatementVisitor(this));
    this.popContext();
  }

  // Ensures all symbols in this scope exist and are defined but does not resolve them
  initializeBlock(node: Block) {
    // Only initialize once
    if (!this.isInitialized[node.uniqueID]) {
      this.isInitialized[node.uniqueID] = true;

      // Define all declarations that are direct children of this node
      node.statements.forEach(n => {
        if (n instanceof Declaration) {
          this.define(<Declaration>n);
        }
      });
    }
  }

  visitExpressionStatement(node: ExpressionStatement) {
    if (!this.context.isInFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'expression statement');
      return;
    }

    this.resolveAsExpression(node.value);
  }

  visitIfStatement(node: IfStatement) {
    if (!this.context.isInFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'if statement');
      return;
    }

    this.resolveAsExpression(node.test);
    this.checkImplicitConversion(NativeTypes.BOOL.wrapValue(), node.test, ImplicitConversion.NORMAL);
    this.visitBlock(node.thenBlock);
    if (node.elseBlock !== null) {
      this.visitBlock(node.elseBlock);
    }
  }

  visitWhileStatement(node: WhileStatement) {
    if (!this.context.isInFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'while statement');
      return;
    }

    this.resolveAsExpression(node.test);
    this.checkImplicitConversion(NativeTypes.BOOL.wrapValue(), node.test, ImplicitConversion.NORMAL);
    this.pushContext(this.context.cloneForLoop());
    this.visitBlock(node.block);
    this.popContext();
  }

  visitForStatement(node: ForStatement) {
    if (!this.context.isInFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'for statement');
      return;
    }

    if (node.setup !== null) {
      this.resolveAsExpression(node.setup);
    }
    if (node.test !== null) {
      this.resolveAsExpression(node.test);
      this.checkImplicitConversion(NativeTypes.BOOL.wrapValue(), node.test, ImplicitConversion.NORMAL);
    }
    if (node.update !== null) {
      this.resolveAsExpression(node.update);
    }
    this.pushContext(this.context.cloneForLoop());
    this.visitBlock(node.block);
    this.popContext();
  }

  visitReturnStatement(node: ReturnStatement) {
    if (!this.context.isInFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'return statement');
      return;
    }

    var returnType: WrappedType = this.context.enclosingFunction.result;
    if (node.value !== null) {
      this.resolveAsExpression(node.value);
      this.checkImplicitConversion(returnType, node.value, ImplicitConversion.NORMAL);
    } else if (!returnType.isVoid()) {
      semanticErrorExpectedReturnValue(this.log, node.range, returnType);
    }
  }

  visitDeleteStatement(node: DeleteStatement) {
    if (!this.context.isInFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'delete statement');
      return;
    }

    // TODO: Check that value is a pointer
  }

  visitBreakStatement(node: BreakStatement) {
    if (!this.context.isInLoop()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'break statement');
      return;
    }
  }

  visitContinueStatement(node: ContinueStatement) {
    if (!this.context.isInLoop()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'continue statement');
      return;
    }
  }

  visitDeclaration(node: Declaration) {
    node.acceptDeclarationVisitor(this);
  }

  visitObjectDeclaration(node: ObjectDeclaration) {
    if (this.context.isInObject() || this.context.isInFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'class declaration');
      return;
    }

    this.ensureDeclarationIsInitialized(node);
    this.pushContext(this.context.cloneForObject(node.symbol));
    this.visitBlock(node.block);
    this.popContext();
  }

  visitFunctionDeclaration(node: FunctionDeclaration) {
    if (this.context.isInFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'function declaration');
      return;
    }

    this.ensureDeclarationIsInitialized(node);

    node.initializers.forEach(n => {
      n.values.forEach(n => {
        this.resolveAsExpression(n);
      });
    })

    node.args.forEach(n => n.acceptDeclarationVisitor(this));

    if (node.block !== null && node.symbol.type.isFunction()) {
      this.pushContext(this.context.cloneForFunction(node.symbol));
      this.visitBlock(node.block);
      this.popContext();
    }
  }

  visitVariableDeclaration(node: VariableDeclaration) {
    this.ensureDeclarationIsInitialized(node);

    // Check the value
    if (node.value !== null) {
      this.pushContext(this.context.cloneForVariable(node.symbol));
      this.resolveAsExpression(node.value);
      this.popContext();
      this.checkImplicitConversion(node.symbol.type, node.value, ImplicitConversion.NORMAL);
    }

    // Value types must be constructable with no arguments
    else if (!node.symbol.isArgument && node.symbol.enclosingObject === null &&
        (node.symbol.isFinal() || !TypeLogic.hasDefaultConstructor(node.symbol.type))) {
      semanticErrorVariableNeedsValue(this.log, node.id.range, node.type.computedType, node.symbol.isFinal());
    }
  }

  visitSymbolExpression(node: SymbolExpression) {
    // Search for the symbol
    node.symbol = this.findSymbol(node.range, node.name);
    if (node.symbol === null) {
      semanticErrorUnknownSymbol(this.log, node.range, node.name);
      return;
    }

    // Validate static vs instance
    if (!node.symbol.isStatic() && node.symbol.enclosingObject !== null && !this.context.canAccessThis()) {
      semanticErrorMemberUnexpectedInstance(this.log, node.range, node.symbol.name);
      return;
    }

    node.computedType = node.symbol.type.withModifier(node.symbol.isFinal() ? TypeModifier.FINAL : 0);
  }

  visitCopyExpression(node: CopyExpression) {
    this.resolveAsExpression(node.value);

    // Can't chain moves and copies
    if (node.value instanceof MoveExpression || node.value instanceof CopyExpression) {
      semanticErrorNestedMoveOrCopy(this.log, node.value.range, 'copy');
      return;
    }

    // Validate the type
    var type: WrappedType = node.value.computedType;
    if (!type.isError() && type.isPointer()) {
      semanticErrorBadMoveOrCopy(this.log, node.value.range, type, 'copy');
      return;
    }

    // A temporary value implies move
    if (type.isValue() && !type.isStorage()) {
      semanticErrorImpliedMove(this.log, node.range);
      return;
    }

    node.computedType = node.value.computedType;
  }

  visitMoveExpression(node: MoveExpression) {
    this.resolveAsExpression(node.value);

    // Can't chain moves and copies
    if (node.value instanceof MoveExpression || node.value instanceof CopyExpression) {
      semanticErrorNestedMoveOrCopy(this.log, node.value.range, 'move');
      return;
    }

    // Validate the type
    var type: WrappedType = node.value.computedType;
    if (!type.isError() && type.isPointer()) {
      semanticErrorBadMoveOrCopy(this.log, node.value.range, type, 'move');
      return;
    }

    // A temporary value implies move
    if (type.isValue() && !type.isStorage()) {
      semanticErrorImpliedMove(this.log, node.range);
      return;
    }

    node.computedType = type;
  }

  visitCastExpression(node: CastExpression) {
    this.resolveAsType(node.type);
    this.resolveAsExpression(node.value);

    // Avoid reporting further errors
    var from: WrappedType = node.value.computedType;
    var to: WrappedType = node.type.computedType.withModifier(TypeModifier.INSTANCE);
    if (from.isError() || to.isError()) {
      return;
    }

    // Validate target type
    if (to.isVoid()) {
      semanticErrorBadCastType(this.log, node.type.range, to);
      return;
    }

    // Check for a valid cast
    if (!TypeLogic.canExplicitlyConvert(from, to)) {
      semanticErrorIncompatibleTypes(this.log, node.value.range, from, to);
      return;
    }

    node.computedType = to;
  }

  visitUnaryExpression(node: UnaryExpression) {
    this.resolveAsExpression(node.value);

    // Avoid reporting further errors
    var value: WrappedType = node.value.computedType;
    if (value.isError()) {
      return;
    }

    // Special-case primitive operators
    if (value.isPrimitive()) {
      var found: boolean = false;

      switch (node.op) {
        case '+':
        case '-':
          found = value.isNumeric();
          break;

        case '!':
          found = value.isBool();
          break;

        case '~':
          found = value.isInt();
          break;
      }

      // Don't use value because it may have modifiers in it (like TypeModifier.STORAGE)
      if (found) {
        node.computedType = value.innerType.wrapValue();
        return;
      }
    }

    // Special-case reference and dereference
    if (value.isObject()) {
      switch (node.op) {
      case '*':
        if (value.isPointer()) {
          node.computedType = value.innerType.wrapValue().withModifier(TypeModifier.STORAGE);
          return;
        }
        break;

      case '&':
        if (!value.isPointer()) {
          node.computedType = value.innerType.wrapPointer();
          return;
        }
        break;
      }
    }

    semanticErrorNoUnaryOperator(this.log, node.range, node.op, value);
  }

  visitBinaryExpression(node: BinaryExpression) {
    this.resolveAsExpression(node.left);
    this.resolveAsExpression(node.right);

    // Avoid reporting further errors
    var left: WrappedType = node.left.computedType;
    var right: WrappedType = node.right.computedType;
    if (left.isError() || right.isError()) {
      return;
    }

    // Special-case assignment logic
    if (node.isAssignment()) {
      this.checkImplicitConversion(left, node.right, ImplicitConversion.ASSIGNMENT);
      this.checkAssigment(node.left);
      node.computedType = left;
      return;
    }

    // Handle equality separately
    if ((node.op === '==' || node.op === '!=') && (TypeLogic.canImplicitlyConvert(left, right) || TypeLogic.canImplicitlyConvert(right, left))) {
      node.computedType = NativeTypes.BOOL.wrapValue();
      return;
    }

    // Special-case primitive operators
    if (left.isPrimitive() && right.isPrimitive()) {
      var result: Type = null;

      switch (node.op) {
        case '+':
        case '-':
        case '*':
        case '/':
          if (left.isNumeric() && right.isNumeric()) {
            result =
              left.isInt() && right.isInt() ? NativeTypes.INT :
              !left.isDouble() && !right.isDouble() ? NativeTypes.FLOAT :
              NativeTypes.DOUBLE;
          }
          break;

        case '%':
        case '<<':
        case '>>':
        case '&':
        case '|':
        case '^':
          if (left.isInt() && right.isInt()) {
            result = NativeTypes.INT;
          }
          break;

        case '&&':
        case '||':
          if (left.isBool() && right.isBool()) {
            result = NativeTypes.BOOL;
          }
          break;

        case '<':
        case '>':
        case '<=':
        case '>=':
          if (left.isNumeric() && right.isNumeric()) {
            result = NativeTypes.BOOL;
          }
          break;
      }

      if (result !== null) {
        node.computedType = result.wrapValue();
        return;
      }
    }

    semanticErrorNoBinaryOperator(this.log, node.range, node.op, left, right);
  }

  visitTernaryExpression(node: TernaryExpression) {
    this.resolveAsExpression(node.value);
    this.checkImplicitConversion(NativeTypes.BOOL.wrapValue(), node.value, ImplicitConversion.NORMAL);
    this.resolveAsExpression(node.trueValue);
    this.resolveAsExpression(node.falseValue);

    // Avoid reporting further errors
    var yes: WrappedType = node.trueValue.computedType;
    var no: WrappedType = node.falseValue.computedType;
    if (yes.isError() || no.isError()) {
      return;
    }

    // Ensure both branches can implicitly convert to a common type
    var commonType: WrappedType = TypeLogic.commonImplicitType(yes, no);
    if (commonType === null) {
      semanticErrorNoCommonType(this.log, spanRange(node.trueValue.range, node.falseValue.range), yes, no);
      return;
    }

    node.computedType = commonType;
  }

  visitMemberExpression(node: MemberExpression) {
    this.resolve(node.value);

    // Avoid reporting further errors
    var type: WrappedType = node.value.computedType;
    if (type.isError()) {
      return;
    }

    // Only objects have members
    var objectType: ObjectType = type.asObject();
    if (objectType === null) {
      semanticErrorNoMembers(this.log, node.value.range, type);
      return;
    }

    // Search for the symbol
    node.symbol = this.findMemberSymbol(objectType, node.id);
    if (node.symbol === null) {
      semanticErrorUnknownMemberSymbol(this.log, node.id.range, node.id.name, type);
      return;
    }

    // Validate static vs instance
    if (type.isInstance() && node.symbol.isStatic()) {
      semanticErrorMemberUnexpectedStatic(this.log, node.id.range, node.symbol.name);
      return;
    } else if (!type.isInstance() && !node.symbol.isStatic()) {
      semanticErrorMemberUnexpectedInstance(this.log, node.id.range, node.symbol.name);
      return;
    }

    // Validate . vs -> but still set the type afterwards for further checking
    // since it's obvious which operator the user meant to use here
    if (type.isPointer() && node.op === '.') {
      semanticErrorWrongMemberOperator(this.log, innerRange(node.value.range, node.id.range), type, '->');
    } else if (!type.isPointer() && node.op === '->') {
      semanticErrorWrongMemberOperator(this.log, innerRange(node.value.range, node.id.range), type, '.');
    }

    // Substitute the type parameters from the object into the member
    // node.computedType = TypeLogic.substitute(node.symbol.type, node.value.computedType.substitutions);
    node.computedType = node.symbol.type.withModifier(node.symbol.isFinal() ? TypeModifier.FINAL : 0);
  }

  visitIntExpression(node: IntExpression) {
    node.computedType = NativeTypes.INT.wrapValue();
  }

  visitBoolExpression(node: BoolExpression) {
    node.computedType = NativeTypes.BOOL.wrapValue();
  }

  visitFloatExpression(node: FloatExpression) {
    node.computedType = NativeTypes.FLOAT.wrapValue();
  }

  visitDoubleExpression(node: DoubleExpression) {
    node.computedType = NativeTypes.DOUBLE.wrapValue();
  }

  visitNullExpression(node: NullExpression) {
    node.computedType = NativeTypes.NULL.wrapValue();
  }

  visitThisExpression(node: ThisExpression) {
    if (!this.context.canAccessThis()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'this expression');
      return;
    }

    node.computedType = this.context.enclosingObject.wrapPointer();
  }

  visitCallExpression(node: CallExpression) {
    this.resolve(node.value);
    node.args.forEach(n => this.resolveAsExpression(n));

    // Avoid reporting further errors
    if (node.value.computedType.isError()) {
      return;
    }
    var type: WrappedType = node.value.computedType;

    // Check for a function call
    if (type.isInstance()) {
      var functionType: FunctionType = type.asFunction();

      // Calls only work on function types
      if (functionType === null) {
        semanticErrorInvalidCall(this.log, node.value.range, type);
        return;
      }

      // Check argument types
      this.checkCallArguments(node.range, functionType, node.args);
      node.computedType = functionType.result;
    }

    // Check for a constructor call
    else {
      // New only works on raw object types
      var objectType: ObjectType = type.asObject();
      if (objectType === null || !type.isValue()) {
        semanticErrorInvalidNew(this.log, node.value.range, type);
        return;
      }

      // Cannot construct an abstract class
      if (objectType.isAbstract()) {
        semanticErrorAbstractNew(this.log, node.value);
        return;
      }

      // Check argument types
      this.checkCallArguments(node.range, objectType.constructorType(), node.args);
      node.computedType = objectType.wrapValue();
    }
  }

  visitNewExpression(node: NewExpression) {
    this.resolveAsType(node.type);
    node.args.forEach(n => this.resolveAsExpression(n));

    // Avoid reporting further errors
    var type: WrappedType = node.type.computedType;
    if (type.isError()) {
      return;
    }

    // New only works on raw object types
    var objectType: ObjectType = type.asObject();
    if (objectType === null || !type.isValue()) {
      semanticErrorInvalidNew(this.log, node.type.range, type);
      return;
    }

    // Cannot construct an abstract class
    if (objectType.isAbstract()) {
      semanticErrorAbstractNew(this.log, node.type);
      return;
    }

    this.checkCallArguments(node.range, objectType.constructorType(), node.args);
    node.computedType = type.withKind(TypeKind.POINTER).withModifier(TypeModifier.INSTANCE);
  }

  visitTypeKindExpression(node: TypeKindExpression) {
    this.resolveAsType(node.type);

    // There is no keyword corresponding to a value type
    assert(node.kind !== TypeKind.VALUE);

    // Avoid reporting further errors
    var type: WrappedType = node.type.computedType;
    if (type.isError()) {
      return;
    }

    // Can only use pointer and reference on object types
    if (!type.isObject()) {
      semanticErrorInvalidTypeKind(this.log, node.range, type, node.kind);
      return;
    }

    node.computedType = type.withKind(node.kind);
  }

  visitTypeParameterExpression(node: TypeParameterExpression) {
  }
}
