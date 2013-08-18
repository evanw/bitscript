class ResolverContext {
  constructor(
    public scope: Scope,
    public enclosingLoop: boolean,
    public enclosingObject: ObjectType,
    public enclosingFunction: FunctionType) {
  }

  inLoop(): boolean {
    return this.enclosingLoop;
  }

  inObject(): boolean {
    return this.enclosingObject !== null;
  }

  inFunction(): boolean {
    return this.enclosingFunction !== null;
  }

  clone(): ResolverContext {
    return new ResolverContext(
      this.scope,
      this.enclosingLoop,
      this.enclosingObject,
      this.enclosingFunction);
  }

  cloneWithScope(scope: Scope) {
    var clone = this.clone();
    clone.scope = scope;
    return clone;
  }

  cloneForLoop() {
    var clone = this.clone();
    clone.enclosingLoop = true;
    return clone;
  }

  cloneForObject(objectType: ObjectType) {
    var clone = this.clone();
    clone.enclosingObject = objectType;
    return clone;
  }

  cloneForFunction(functionType: FunctionType) {
    var clone = this.clone();
    clone.enclosingFunction = functionType;
    return clone;
  }
}

class Initializer implements DeclarationVisitor<WrappedType> {
  constructor(
    public resolver: Resolver) {
  }

  visitObjectDeclaration(node: ObjectDeclaration): WrappedType {
    // Check modifiers
    this.resolver.ignoreModifier(node, SymbolModifier.OVER, 'on a class declaration');

    // Create the block scope
    node.block.scope = new Scope(this.resolver.context.scope);
    var type: ObjectType = new ObjectType(node.symbol.name, node.block.scope);

    // Find the base class if there is one
    if (node.base !== null) {
      this.resolver.resolveAsType(node.base);

      // Avoid reporting further errors
      var baseType: WrappedType = node.base.computedType;
      if (baseType.isError()) {
        return SpecialType.ERROR.wrap(0);
      }

      // Can only inherit from objects
      if (!baseType.isObject()) {
        semanticErrorBadBaseType(this.resolver.log, node.range, baseType);
        return SpecialType.ERROR.wrap(0);
      }

      // Base type is valid (no need to check for cycles since
      // cycle detection is done for all declarations anyway)
      type.baseType = baseType.asObject();
      type.baseType.hasDerivedTypes = true;
      node.block.scope.baseParent = type.baseType.scope;
    }

    // Populate the block scope
    this.resolver.pushContext(this.resolver.context.cloneWithScope(node.block.scope));
    this.resolver.initializeBlock(node.block);
    this.resolver.popContext();

    // Create the object type and set it as the parent of all child symbols
    node.block.statements.forEach(n => {
      if (n instanceof Declaration) {
        (<Declaration>n).symbol.enclosingObject = type;
      }
    });

    // Create the constructor type
    node.symbol.type = type.wrap(0); // Cheat and set this early before we initialize member variables
    var baseArgTypes: WrappedType[] = type.baseType !== null ? type.baseType.constructorType.args : [];
    var argTypes: WrappedType[] = node.block.statements
      .filter(n => n instanceof VariableDeclaration && n.value === null)
      .map(n => (this.resolver.ensureDeclarationIsInitialized(n), (<VariableDeclaration>n).symbol.type));
    type.constructorType = new FunctionType(null, baseArgTypes.concat(argTypes));
    return type.wrap(0);
  }

  visitFunctionDeclaration(node: FunctionDeclaration): WrappedType {
    this.resolver.resolveAsType(node.result);

    // Create the function scope
    node.block.scope = new Scope(this.resolver.context.scope);

    // Define the arguments in the function scope
    this.resolver.pushContext(this.resolver.context.cloneWithScope(node.block.scope));
    var args: WrappedType[] = node.args.map(n => {
      this.resolver.define(n);
      this.resolver.ensureDeclarationIsInitialized(n);
      return n.symbol.type.wrapWith(TypeModifier.INSTANCE);
    });
    this.resolver.popContext();

    return new FunctionType(node.result.computedType.wrapWith(TypeModifier.INSTANCE), args).wrap(TypeModifier.INSTANCE | TypeModifier.STORAGE);
  }

  visitVariableDeclaration(node: VariableDeclaration): WrappedType {
    // Check modifiers
    this.resolver.ignoreModifier(node, SymbolModifier.OVER, 'on a variable declaration');

    // Resolve the type
    this.resolver.resolveAsType(node.type);
    return node.type.computedType.wrapWith(TypeModifier.INSTANCE | TypeModifier.STORAGE);
  }
}

class Resolver implements StatementVisitor<void>, DeclarationVisitor<void>, ExpressionVisitor<void> {
  stack: ResolverContext[] = [];
  context: ResolverContext = new ResolverContext(Resolver.createGlobalScope(), false, null, null);
  isInitialized: { [uniqueID: number]: boolean } = {};
  definitionContext: { [uniqueID: number]: ResolverContext } = {};
  initializer: Initializer = new Initializer(this);

  constructor(
    public log: Log) {
  }

  static resolve(log: Log, module: Module) {
    new Resolver(log).visitBlock(module.block);
  }

  static createGlobalScope(): Scope {
    var scope: Scope = new Scope(null);
    scope.define('int', SpecialType.INT.wrap(0));
    scope.define('void', SpecialType.VOID.wrap(0));
    scope.define('bool', SpecialType.BOOL.wrap(0));
    scope.define('double', SpecialType.DOUBLE.wrap(0));
    return scope;
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
      node.computedType = SpecialType.ERROR.wrap(0);
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
      node.computedType = SpecialType.ERROR.wrap(0);
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
      node.computedType = SpecialType.ERROR.wrap(0);
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
    if (symbol === null) {
      scope.symbols.push(node.symbol);
    } else {
      semanticErrorDuplicateSymbol(this.log, node.id.range, symbol);
    }
  }

  ignoreModifier(node: Declaration, modifier: number, why: string) {
    if ((node.modifiers & modifier) !== 0) {
      semanticErrorUnexpectedModifier(this.log, node.id.range, 'over', why);
      node.modifiers = node.modifiers & ~modifier;
    }
  }

  checkImplicitCast(type: WrappedType, node: Expression) {
    if (!type.isError() && !node.computedType.isError()) {
      if (!TypeLogic.canImplicitlyConvert(node.computedType, type)) {
        semanticErrorIncompatibleTypes(this.log, node.range, node.computedType, type);
      }
    }
  }

  checkCallArguments(range: SourceRange, type: FunctionType, args: Expression[]) {
    if (type.args.length !== args.length) {
      semanticErrorArgumentCount(this.log, range, type.args.length, args.length);
      return;
    }

    args.forEach((n, i) => {
      this.checkImplicitCast(type.args[i], n);
    });
  }

  checkRValueToRawPointer(type: WrappedType, node: Expression) {
    if (!node.computedType.isError() && type.isRawPointer() && node.computedType.isOwned() && !node.computedType.isStorage()) {
      semanticErrorRValueToRawPointer(this.log, node.range);
    }
  }

  checkStorage(node: Expression) {
    if (!node.computedType.isStorage()) {
      semanticErrorBadStorage(this.log, node.range);
    }
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
    // declaration should return SpecialType.ERROR in this case.
    node.symbol.type = SpecialType.CIRCULAR.wrap(0);
    this.pushContext(this.definitionContext[node.uniqueID]);
    var type: WrappedType = node.acceptDeclarationVisitor(this.initializer);
    this.popContext();
    assert(type !== null && !type.isCircular());
    node.symbol.type = type;
    this.checkOverModifier(node);
  }

  checkOverModifier(node: Declaration) {
    // Check for a valid override
    if (node.symbol.enclosingObject === null) {
      this.ignoreModifier(node, SymbolModifier.OVER, 'outside a class');
      return;
    }
    if (node.symbol.enclosingObject.baseType === null) {
      this.ignoreModifier(node, SymbolModifier.OVER, 'in a class with no base class');
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
      semanticErrorOverrideDifferentTypes(this.log, node.id.range, node.id.name, symbol.type, node.symbol.type);
      return;
    }

    // An "over" annotation is needed when overriding a symbol
    if (!node.symbol.isOver()) {
      semanticErrorModifierMissingOver(this.log, node.id.range, node.id.name);
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
      symbol.type = SpecialType.ERROR.wrap(0);
    }

    return symbol;
  }

  findSymbol(range: SourceRange, name: string): Symbol {
    var symbol: Symbol = this.context.scope.lexicalFind(name);
    return symbol === null ? null : this.initializeSymbol(symbol, range);
  }

  findMemberSymbol(type: ObjectType, id: Identifier): Symbol {
    var symbol: Symbol = type.scope.baseFind(id.name);
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
    if (!this.context.inFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'expression statement');
      return;
    }

    this.resolveAsExpression(node.value);
  }

  visitIfStatement(node: IfStatement) {
    if (!this.context.inFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'if statement');
      return;
    }

    this.resolveAsExpression(node.test);
    this.checkImplicitCast(SpecialType.BOOL.wrap(TypeModifier.INSTANCE), node.test);
    this.visitBlock(node.thenBlock);
    if (node.elseBlock !== null) {
      this.visitBlock(node.elseBlock);
    }
  }

  visitWhileStatement(node: WhileStatement) {
    if (!this.context.inFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'while statement');
      return;
    }

    this.resolveAsExpression(node.test);
    this.checkImplicitCast(SpecialType.BOOL.wrap(TypeModifier.INSTANCE), node.test);
    this.pushContext(this.context.cloneForLoop());
    this.visitBlock(node.block);
    this.popContext();
  }

  visitReturnStatement(node: ReturnStatement) {
    if (!this.context.inFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'return statement');
      return;
    }

    var returnType: WrappedType = this.context.enclosingFunction.result;
    if (node.value !== null) {
      this.resolveAsExpression(node.value);
      this.checkImplicitCast(returnType, node.value);
      this.checkRValueToRawPointer(returnType, node.value);
    } else if (!returnType.isVoid()) {
      semanticErrorExpectedReturnValue(this.log, node.range, returnType);
    }
  }

  visitBreakStatement(node: BreakStatement) {
    if (!this.context.inLoop()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'break statement');
      return;
    }
  }

  visitContinueStatement(node: ContinueStatement) {
    if (!this.context.inLoop()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'continue statement');
      return;
    }
  }

  visitDeclaration(node: Declaration) {
    node.acceptDeclarationVisitor(this);
  }

  visitObjectDeclaration(node: ObjectDeclaration) {
    if (this.context.inObject() || this.context.inFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'class declaration');
      return;
    }

    this.ensureDeclarationIsInitialized(node);
    this.pushContext(this.context.cloneForObject(node.symbol.type.asObject()));
    this.visitBlock(node.block);
    this.popContext();
  }

  visitFunctionDeclaration(node: FunctionDeclaration) {
    if (this.context.inFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'function declaration');
      return;
    }

    this.ensureDeclarationIsInitialized(node);
    node.args.forEach(n => n.acceptDeclarationVisitor(this));
    this.pushContext(this.context.cloneForFunction(node.symbol.type.asFunction()));
    this.visitBlock(node.block);
    this.popContext();
  }

  visitVariableDeclaration(node: VariableDeclaration) {
    this.ensureDeclarationIsInitialized(node);

    // Check the value
    if (node.value !== null) {
      this.resolveAsExpression(node.value);
      this.checkImplicitCast(node.symbol.type, node.value);
      this.checkRValueToRawPointer(node.symbol.type, node.value);
    }
  }

  visitSymbolExpression(node: SymbolExpression) {
    // Search for the symbol
    node.symbol = this.findSymbol(node.range, node.name);
    if (node.symbol === null) {
      semanticErrorUnknownSymbol(this.log, node.range, node.name);
      return;
    }

    node.computedType = node.symbol.type;
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
          found = value.isInt() || value.isDouble();
          break;

        case '!':
          found = value.isBool();
          break;

        case '~':
          found = value.isInt();
          break;

        default:
          assert(false);
      }

      // Don't use value because it may have modifiers in it (like TypeModifier.STORAGE)
      if (found) {
        node.computedType = value.innerType.wrap(TypeModifier.INSTANCE);
        return;
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
      this.checkImplicitCast(left, node.right);
      this.checkRValueToRawPointer(left, node.right);
      this.checkStorage(node.left);
      return;
    }

    // Handle equality separately
    if ((node.op === '==' || node.op === '!=') && (TypeLogic.canImplicitlyConvert(left, right) || TypeLogic.canImplicitlyConvert(right, left))) {
      node.computedType = SpecialType.BOOL.wrap(TypeModifier.INSTANCE);
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
          if ((left.isInt() || left.isDouble()) &&
              (right.isInt() || right.isDouble())) {
            result = left.isInt() && right.isInt() ? SpecialType.INT : SpecialType.DOUBLE;
          }
          break;

        case '%':
        case '<<':
        case '>>':
        case '&':
        case '|':
        case '^':
          if (left.isInt() && right.isInt()) {
            result = SpecialType.INT;
          }
          break;

        case '&&':
        case '||':
          if (left.isBool() && right.isBool()) {
            result = SpecialType.BOOL;
          }
          break;

        case '<':
        case '>':
        case '<=':
        case '>=':
          if ((left.isInt() || left.isDouble()) &&
              (right.isInt() || right.isDouble())) {
            result = SpecialType.BOOL;
          }
          break;
      }

      if (result !== null) {
        node.computedType = result.wrap(TypeModifier.INSTANCE);
        return;
      }
    }

    semanticErrorNoBinaryOperator(this.log, node.range, node.op, left, right);
  }

  visitTernaryExpression(node: TernaryExpression) {
    this.resolveAsExpression(node.value);
    this.checkImplicitCast(SpecialType.BOOL.wrap(TypeModifier.INSTANCE), node.value);
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

    // Prevent immediate deletion
    this.checkRValueToRawPointer(commonType, node.trueValue);
    this.checkRValueToRawPointer(commonType, node.falseValue);

    node.computedType = commonType;
  }

  visitMemberExpression(node: MemberExpression) {
    this.resolveAsExpression(node.value);

    // Avoid reporting further errors
    if (node.value.computedType.isError()) {
      return;
    }

    // Only objects have members
    var objectType: ObjectType = node.value.computedType.asObject();
    if (objectType === null) {
      semanticErrorNoMembers(this.log, node.value.range, node.value.computedType);
      return;
    }

    // Search for the symbol
    node.symbol = this.findMemberSymbol(objectType, node.id);
    if (node.symbol === null) {
      semanticErrorUnknownMemberSymbol(this.log, node.id.range, node.id.name, node.value.computedType);
      return;
    }

    node.computedType = node.symbol.type;
  }

  visitIntExpression(node: IntExpression) {
    node.computedType = SpecialType.INT.wrap(TypeModifier.INSTANCE);
  }

  visitBoolExpression(node: BoolExpression) {
    node.computedType = SpecialType.BOOL.wrap(TypeModifier.INSTANCE);
  }

  visitDoubleExpression(node: DoubleExpression) {
    node.computedType = SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE);
  }

  visitNullExpression(node: NullExpression) {
    node.computedType = SpecialType.NULL.wrap(TypeModifier.INSTANCE | TypeModifier.OWNED);
  }

  visitThisExpression(node: ThisExpression) {
    if (!this.context.inObject()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'this expression');
      return;
    }

    node.computedType = this.context.enclosingObject.wrap(TypeModifier.INSTANCE);
  }

  visitCallExpression(node: CallExpression) {
    this.resolveAsExpression(node.value);
    node.args.forEach(n => this.resolveAsExpression(n));

    // Avoid reporting further errors
    if (node.value.computedType.isError()) {
      return;
    }

    // Calls only work on function types
    var functionType: FunctionType = node.value.computedType.asFunction();
    if (functionType === null) {
      semanticErrorInvalidCall(this.log, node.range, node.value.computedType);
      return;
    }

    this.checkCallArguments(node.range, functionType, node.args);
    node.computedType = functionType.result;
  }

  visitNewExpression(node: NewExpression) {
    this.resolveAsType(node.type);
    node.args.forEach(n => this.resolveAsExpression(n));

    // Avoid reporting further errors
    if (node.type.computedType.isError()) {
      return;
    }

    // New only works on object types
    var objectType: ObjectType = node.type.computedType.asObject();
    if (objectType === null) {
      semanticErrorInvalidNew(this.log, node.range, node.type.computedType);
      return;
    }

    this.checkCallArguments(node.range, objectType.constructorType, node.args);
    node.computedType = objectType.wrap(TypeModifier.INSTANCE | TypeModifier.OWNED);
  }

  visitTypeModifierExpression(node: TypeModifierExpression) {
    this.resolveAsType(node.type);

    // Avoid reporting further errors
    if (node.type.computedType.isError()) {
      return;
    }

    var all: number = node.modifiers & (TypeModifier.OWNED | TypeModifier.SHARED);
    if (all !== TypeModifier.OWNED && all !== TypeModifier.SHARED) {
      semanticErrorPointerModifierConflict(this.log, node.range);
      return;
    }

    if (all !== 0 && !node.type.computedType.isObject()) {
      semanticErrorInvalidPointerModifier(this.log, node.range, node.type.computedType);
      return;
    }

    node.computedType = node.type.computedType.wrapWith(node.modifiers);
  }
}
