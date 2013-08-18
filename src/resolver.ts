class ResolverFlag {
  static IN_LOOP: number = 1;
  static IN_STRUCT: number = 2;
  static IN_FUNCTION: number = 4;
}

class ResolverContext {
  constructor(
    public scope: Scope,
    public flags: number,
    public result: WrappedType) {
  }

  inLoop(): boolean {
    return (this.flags & ResolverFlag.IN_LOOP) !== 0;
  }

  inStruct(): boolean {
    return (this.flags & ResolverFlag.IN_STRUCT) !== 0;
  }

  inFunction(): boolean {
    return (this.flags & ResolverFlag.IN_FUNCTION) !== 0;
  }

  clone(): ResolverContext {
    return new ResolverContext(
      this.scope,
      this.flags,
      this.result);
  }

  cloneWithScope(scope: Scope) {
    var clone = this.clone();
    clone.scope = scope;
    return clone;
  }

  cloneWithFlag(flag: number) {
    var clone = this.clone();
    clone.flags |= flag;
    return clone;
  }

  cloneWithReturnType(result: WrappedType) {
    var clone = this.clone();
    clone.flags |= ResolverFlag.IN_FUNCTION;
    clone.result = result;
    return clone;
  }
}

class Initializer implements DeclarationVisitor<WrappedType> {
  constructor(
    public resolver: Resolver) {
  }

  visitStructDeclaration(node: StructDeclaration): WrappedType {
    // Create and populate the block scope
    node.block.scope = new Scope(this.resolver.context.scope);
    this.resolver.pushContext(this.resolver.context.cloneWithScope(node.block.scope));
    this.resolver.initializeBlock(node.block);
    this.resolver.popContext();

    // Create the struct type including the constructor
    var type: StructType = new StructType(node.symbol.name, node.block.scope);
    node.symbol.type = type.wrap(0); // Cheat and set this early before we initialize member variables
    type.constructorType = new FunctionType(null, node.block.statements
      .filter(n => n instanceof VariableDeclaration && n.value === null)
      .map(n => (this.resolver.ensureDeclarationIsInitialized(n), (<VariableDeclaration>n).symbol.type)));
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
      return n.symbol.type.wrapWith(Modifier.INSTANCE);
    });
    this.resolver.popContext();

    return new FunctionType(node.result.computedType.wrapWith(Modifier.INSTANCE), args).wrap(Modifier.INSTANCE | Modifier.STORAGE);
  }

  visitVariableDeclaration(node: VariableDeclaration): WrappedType {
    this.resolver.resolveAsType(node.type);
    return node.type.computedType.wrapWith(Modifier.INSTANCE | Modifier.STORAGE);
  }
}

class Resolver implements StatementVisitor<void>, DeclarationVisitor<void>, ExpressionVisitor<void> {
  stack: ResolverContext[] = [];
  context: ResolverContext = new ResolverContext(Resolver.createGlobalScope(), 0, null);
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

    // Only add it to the scope if there isn't any conflict
    var symbol: Symbol = scope.find(node.id.name);
    if (symbol === null) {
      scope.symbols.push(node.symbol);
    } else {
      semanticErrorDuplicateSymbol(this.log, node.id.range, symbol);
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

  checkRValueToRef(type: WrappedType, node: Expression) {
    if (!node.computedType.isError() && type.isRef() && node.computedType.isOwned() && !node.computedType.isStorage()) {
      semanticErrorRValueToRef(this.log, node.range);
    }
  }

  ensureDeclarationIsInitialized(node: Declaration) {
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

  findMemberSymbol(type: StructType, id: Identifier): Symbol {
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
    this.checkImplicitCast(SpecialType.BOOL.wrap(Modifier.INSTANCE), node.test);
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
    this.checkImplicitCast(SpecialType.BOOL.wrap(Modifier.INSTANCE), node.test);
    this.pushContext(this.context.cloneWithFlag(ResolverFlag.IN_LOOP));
    this.visitBlock(node.block);
    this.popContext();
  }

  visitReturnStatement(node: ReturnStatement) {
    if (!this.context.inFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'return statement');
      return;
    }

    if (node.value !== null) {
      this.resolveAsExpression(node.value);
      this.checkImplicitCast(this.context.result, node.value);
      this.checkRValueToRef(this.context.result, node.value);
    } else if (!this.context.result.isVoid()) {
      semanticErrorExpectedReturnValue(this.log, node.range, this.context.result);
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

  visitStructDeclaration(node: StructDeclaration) {
    if (this.context.inStruct() || this.context.inFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'struct declaration');
      return;
    }

    this.ensureDeclarationIsInitialized(node);
    this.pushContext(this.context.cloneWithFlag(ResolverFlag.IN_STRUCT));
    this.visitBlock(node.block);
    this.popContext();
  }

  visitFunctionDeclaration(node: FunctionDeclaration) {
    if (this.context.inStruct() || this.context.inFunction()) {
      semanticErrorUnexpectedStatement(this.log, node.range, 'function declaration');
      return;
    }

    this.ensureDeclarationIsInitialized(node);
    node.args.forEach(n => n.acceptDeclarationVisitor(this));
    this.pushContext(this.context.cloneWithReturnType(node.symbol.type.asFunction().result));
    this.visitBlock(node.block);
    this.popContext();
  }

  visitVariableDeclaration(node: VariableDeclaration) {
    this.ensureDeclarationIsInitialized(node);

    // Check the value
    if (node.value !== null) {
      this.resolveAsExpression(node.value);
      this.checkImplicitCast(node.symbol.type, node.value);
      this.checkRValueToRef(node.symbol.type, node.value);
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

    // Avoid reporting duplicate errors
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

      // Don't use value because it may have modifiers in it (like Modifier.STORAGE)
      if (found) {
        node.computedType = value.innerType.wrap(Modifier.INSTANCE);
        return;
      }
    }

    semanticErrorNoUnaryOperator(this.log, node.range, node.op, value);
  }

  visitBinaryExpression(node: BinaryExpression) {
    this.resolveAsExpression(node.left);
    this.resolveAsExpression(node.right);

    // Avoid reporting duplicate errors
    var left: WrappedType = node.left.computedType;
    var right: WrappedType = node.right.computedType;
    if (left.isError() || right.isError()) {
      return;
    }

    // Special-case assignment logic
    if (node.isAssignment()) {
      this.checkImplicitCast(left, node.right);
      this.checkRValueToRef(left, node.right);
      return;
    }

    // Handle equality separately
    if ((node.op === '==' || node.op === '!=') && (TypeLogic.canImplicitlyConvert(left, right) || TypeLogic.canImplicitlyConvert(right, left))) {
      node.computedType = SpecialType.BOOL.wrap(Modifier.INSTANCE);
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
        node.computedType = result.wrap(Modifier.INSTANCE);
        return;
      }
    }

    semanticErrorNoBinaryOperator(this.log, node.range, node.op, left, right);
  }

  visitTernaryExpression(node: TernaryExpression) {
    this.resolveAsExpression(node.value);
    this.checkImplicitCast(SpecialType.BOOL.wrap(Modifier.INSTANCE), node.value);
    this.resolveAsExpression(node.trueValue);
    this.resolveAsExpression(node.falseValue);
  }

  visitMemberExpression(node: MemberExpression) {
    this.resolveAsExpression(node.value);

    // Avoid reporting duplicate errors
    if (node.value.computedType.isError()) {
      return;
    }

    // Only objects have members
    var structType: StructType = node.value.computedType.asStruct();
    if (structType === null) {
      semanticErrorNoMembers(this.log, node.value.range, node.value.computedType);
      return;
    }

    // Search for the symbol
    node.symbol = this.findMemberSymbol(structType, node.id);
    if (node.symbol === null) {
      semanticErrorUnknownMemberSymbol(this.log, node.id.range, node.id.name, node.value.computedType);
      return;
    }

    node.computedType = node.symbol.type;
  }

  visitIntExpression(node: IntExpression) {
    node.computedType = SpecialType.INT.wrap(Modifier.INSTANCE);
  }

  visitBoolExpression(node: BoolExpression) {
    node.computedType = SpecialType.BOOL.wrap(Modifier.INSTANCE);
  }

  visitDoubleExpression(node: DoubleExpression) {
    node.computedType = SpecialType.DOUBLE.wrap(Modifier.INSTANCE);
  }

  visitNullExpression(node: NullExpression) {
    node.computedType = SpecialType.NULL.wrap(Modifier.INSTANCE | Modifier.OWNED);
  }

  visitCallExpression(node: CallExpression) {
    this.resolveAsExpression(node.value);
    node.args.forEach(n => this.resolveAsExpression(n));

    // Avoid reporting duplicate errors
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

    // Avoid reporting duplicate errors
    if (node.type.computedType.isError()) {
      return;
    }

    // New only works on object types
    var structType: StructType = node.type.computedType.asStruct();
    if (structType === null) {
      semanticErrorInvalidNew(this.log, node.range, node.type.computedType);
      return;
    }

    this.checkCallArguments(node.range, structType.constructorType, node.args);
    node.computedType = structType.wrap(Modifier.INSTANCE | Modifier.OWNED);
  }

  visitModifierExpression(node: ModifierExpression) {
    this.resolveAsType(node.type);

    // Avoid reporting duplicate errors
    if (node.type.computedType.isError()) {
      return;
    }

    var all: number = node.modifiers & (Modifier.REF | Modifier.OWNED | Modifier.SHARED);
    if (all !== Modifier.REF && all !== Modifier.OWNED && all !== Modifier.SHARED) {
      semanticErrorPointerModifierConflict(this.log, node.range);
      return;
    }

    if (all !== 0 && !node.type.computedType.isStruct()) {
      semanticErrorInvalidPointerModifier(this.log, node.range, node.type.computedType);
      return;
    }

    node.computedType = node.type.computedType.wrapWith(node.modifiers);
  }
}
