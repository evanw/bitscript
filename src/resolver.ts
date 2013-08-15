class ResolverContext {
  constructor(
    public scope: Scope) {
  }

  clone(): ResolverContext {
    return new ResolverContext(
      this.scope);
  }

  cloneWithScope(scope: Scope) {
    var clone = this.clone();
    clone.scope = scope;
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
    this.resolver.initializeBlock(node.block);

    // Create the struct type
    var type: StructType = new StructType(node.symbol.name, node.block.scope);
    return type.wrap(0);
  }

  visitFunctionDeclaration(node: FunctionDeclaration): WrappedType {
    this.resolver.resolveAsType(node.result);
    return SpecialType.ERROR.wrap(0);
  }

  visitVariableDeclaration(node: VariableDeclaration): WrappedType {
    this.resolver.resolveAsType(node.type);
    return node.type.computedType.innerType.wrap(node.modifiers | Modifier.INSTANCE);
  }
}

class Resolver implements StatementVisitor<void>, DeclarationVisitor<void>, ExpressionVisitor<void> {
  stack: ResolverContext[] = [];
  context: ResolverContext = new ResolverContext(Resolver.createGlobalScope());
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
    if (node.computedType === null) {
      node.computedType = SpecialType.ERROR.wrap(0);
      node.acceptExpressionVisitor(this);
    }
  }

  resolveAsExpression(node: Expression) {
    this.resolve(node);

    // Must be an instance
    if (!node.computedType.isError() && !node.computedType.isInstance()) {
      semanticErrorUnexpectedExpression(this.log, node.range, node.computedType);
      node.computedType = SpecialType.ERROR.wrap(0);
    }
  }

  resolveAsType(node: Expression) {
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

  initializeSymbol(symbol: Symbol, range: TRange): Symbol {
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

  findSymbol(range: TRange, name: string): Symbol {
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
      node.statements.forEach(s => {
        if (s instanceof Declaration) {
          this.define(<Declaration>s);
        }
      });
    }
  }

  visitExpressionStatement(node: ExpressionStatement) {
    this.resolveAsExpression(node.value);
  }

  visitIfStatement(node: IfStatement) {
    this.resolveAsExpression(node.test);
    this.visitBlock(node.thenBlock);
    if (node.elseBlock !== null) {
      this.visitBlock(node.elseBlock);
    }
  }

  visitWhileStatement(node: WhileStatement) {
    this.resolveAsExpression(node.test);
    this.visitBlock(node.block);
  }

  visitReturnStatement(node: ReturnStatement) {
    if (node.value !== null) {
      this.resolveAsExpression(node.value);
    }
  }

  visitBreakStatement(node: BreakStatement) {
  }

  visitContinueStatement(node: ContinueStatement) {
  }

  visitDeclaration(node: Declaration) {
    node.acceptDeclarationVisitor(this);
  }

  visitStructDeclaration(node: StructDeclaration) {
    this.ensureDeclarationIsInitialized(node);
    this.visitBlock(node.block);
  }

  visitFunctionDeclaration(node: FunctionDeclaration) {
    this.ensureDeclarationIsInitialized(node);
    this.resolveAsType(node.result);
    node.args.forEach(n => n.acceptDeclarationVisitor(this));
    this.visitBlock(node.block);
  }

  visitVariableDeclaration(node: VariableDeclaration) {
    this.ensureDeclarationIsInitialized(node);

    // Check the value
    if (node.value !== null) {
      this.resolveAsExpression(node.value);
      this.checkImplicitCast(node.symbol.type, node.value);
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
  }

  visitBinaryExpression(node: BinaryExpression) {
    this.resolveAsExpression(node.left);
    this.resolveAsExpression(node.right);
  }

  visitTernaryExpression(node: TernaryExpression) {
    this.resolveAsExpression(node.value);
    this.resolveAsExpression(node.trueValue);
    this.resolveAsExpression(node.falseValue);
  }

  visitMemberExpression(node: MemberExpression) {
    this.resolveAsExpression(node.value);
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
    node.computedType = SpecialType.NULL.wrap(Modifier.INSTANCE);
  }

  visitCallExpression(node: CallExpression) {
    this.resolveAsExpression(node.value);
    node.args.forEach(n => n.acceptExpressionVisitor(this));
  }

  visitNewExpression(node: NewExpression) {
    this.resolveAsType(node.type);

    if (!node.type.computedType.isError()) {
      node.computedType = node.type.computedType.innerType.wrap(Modifier.INSTANCE | Modifier.OWNED);
    }
  }
}
