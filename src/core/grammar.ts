// The same operator precedence as C
enum Power {
  LOWEST,
  COMMA,
  ASSIGN,
  TERNARY,
  OR,
  AND,
  BITOR,
  BITXOR,
  BITAND,
  EQ_NEQ,
  COMPARE,
  SHIFT,
  ADD_SUB,
  MUL_DIV,
  UNARY,
  CALL,
  MEMBER,
}

function parseGroup(context: ParserContext): Expression {
  if (!context.expect('(')) return null;
  var value: Expression = pratt.parse(context, Power.LOWEST); if (value === null) return null;
  if (!context.expect(')')) return null;
  return value;
}

function parseBlock(context: ParserContext, hint: StatementHint): Block {
  var token: Token = context.current();
  if (!context.expect('{')) return null;
  var statements: Statement[] = parseStatements(context, hint); if (statements === null) return null;
  if (!context.expect('}')) return null;
  return new Block(context.spanSince(token.range), statements);
}

function parseBlockOrStatement(context: ParserContext): Block {
  if (context.peek('{')) return parseBlock(context, StatementHint.NORMAL);
  var statement: Statement = parseStatement(context, StatementHint.NORMAL);
  if (statement === null) return null;
  return new Block(statement.range, [statement]);
}

function parseIdentifier(context: ParserContext): Identifier {
  var token: Token = context.current(); if (!context.expect('IDENTIFIER')) return null;
  return new Identifier(token.range, token.text);
}

function parseType(context: ParserContext): Expression {
  var range: SourceRange = context.current().range;
  var value: Expression = pratt.parse(context, Power.MEMBER - 1); if (value === null) return null;
  var kind: TypeKind =
    context.eat('*') ? TypeKind.POINTER :
    context.eat('&') ? TypeKind.REFERENCE :
    TypeKind.VALUE;
  if (context.peek('*') || context.peek('&')) {
    syntaxErrorUnexpectedToken(context.log, context.current());
    return null;
  }
  return kind === TypeKind.VALUE ? value : new TypeKindExpression(context.spanSince(range), value, kind);
}

function parseArguments(context: ParserContext): VariableDeclaration[] {
  var args: VariableDeclaration[] = [];
  if (!context.expect('(')) return null;
  while (!context.peek(')')) {
    if (args.length > 0 && !context.expect(',')) return null;
    var modifiers: number = parseSymbolModifiers(context);
    var type: Expression = parseType(context); if (type === null) return null;
    var id: Identifier = parseIdentifier(context); if (id === null) return null;
    args.push(new VariableDeclaration(spanRange(type.range, id.range), id, modifiers, type, null));
  }
  if (!context.expect(')')) return null;
  return args;
}

function parseInitializers(context: ParserContext): Initializer[] {
  var initializers: Initializer[] = [];

  // The superclass initializer can have multiple arguments
  if (context.peek('super')) {
    var token: Token = context.next();
    var id: Identifier = new Identifier(token.range, token.text);
    if (!context.expect('(')) return null;
    var values: Expression[] = parseExpressions(context); if (values === null) return null;
    if (!context.expect(')')) return null;
    initializers.push(new Initializer(context.spanSince(id.range), id, values));
    if (!context.eat(',')) return initializers;
  }

  // Each member variable initializer has one argument
  do {
    var id: Identifier = parseIdentifier(context); if (id === null) return null;
    if (!context.expect('(')) return null;
    var value: Expression = pratt.parse(context, Power.LOWEST); if (value === null) return null;
    if (!context.expect(')')) return null;
    initializers.push(new Initializer(context.spanSince(id.range), id, [value]));
  } while(context.eat(','));

  return initializers;
}

function parseStatements(context: ParserContext, hint: StatementHint): Statement[] {
  var statements: Statement[] = [];
  while (!context.peek('}') && !context.peek('END')) {
    var statement: Statement = parseStatement(context, hint); if (statement === null) return null;
    statements.push(statement);
  }
  return statements;
}

function parseSymbolModifiers(context: ParserContext): number {
  function checkModifier(flag: SymbolModifier, name: string): boolean {
    var token: Token = context.current();
    if (!context.eat(name)) return false;
    if (modifiers & flag) semanticErrorDuplicateModifier(context.log, token.range, name);
    modifiers |= flag;
    return true;
  }
  var modifiers: number = 0;
  while (
    checkModifier(SymbolModifier.OVER, 'over') ||
    checkModifier(SymbolModifier.FINAL, 'final') ||
    checkModifier(SymbolModifier.STATIC, 'static')) {
  }
  return modifiers;
}

enum StatementHint {
  NORMAL,
  IN_CLASS,
}

function parseStatement(context: ParserContext, hint: StatementHint): Statement {
  var range: SourceRange = context.current().range;
  var modifiers: number = parseSymbolModifiers(context);

  // Special function declarations
  if (hint === StatementHint.IN_CLASS) {
    var token: Token = context.current();
    var functionKind: FunctionKind =
      context.eat('new') ? FunctionKind.CONSTRUCTOR :
      context.eat('copy') ? FunctionKind.COPY_CONSTRUCTOR :
      context.eat('delete') ? FunctionKind.DESTRUCTOR :
      context.eat('move') ? FunctionKind.MOVE_DESTRUCTOR :
      FunctionKind.NORMAL;
    if (functionKind !== FunctionKind.NORMAL) {
      var id: Identifier = new Identifier(token.range, token.text);
      var isDefault: boolean = false;
      var type: Expression = null;
      var args: VariableDeclaration[] = [];
      var initializers: Initializer[] = [];
      var block: Block = null;
      if (context.eat('=')) {
        if (!context.expect('default') || !context.expect(';')) return null;
        isDefault = true;
      } else {
        args = parseArguments(context); if (args === null) return null;
        if (context.eat(':')) {
          initializers = parseInitializers(context); if (initializers === null) return null;;
        }
        if (!context.eat(';')) {
          block = parseBlock(context, StatementHint.NORMAL); if (block === null) return null;
        }
      }
      return new FunctionDeclaration(context.spanSince(range), id, modifiers, functionKind, isDefault, type, initializers, args, block);
    }
  }

  // Object declaration
  if (context.eat('class')) {
    var id: Identifier = parseIdentifier(context); if (id === null) return null;
    var base: Expression = null;
    if (context.eat(':')) {
      base = pratt.parse(context, Power.CALL); if (base === null) return null;
    }
    var block: Block = parseBlock(context, StatementHint.IN_CLASS); if (block === null) return null;
    return new ObjectDeclaration(context.spanSince(range), id, modifiers, base, block);
  }

  // Disambiguate identifiers used in expressions from identifiers used
  // as types in symbol declarations by starting to parse a type and
  // switching over to parsing an expression if it doesn't work out
  if (modifiers !== 0 || context.peek('IDENTIFIER')) {
    var type: Expression = parseType(context); if (type === null) return null;
    if (modifiers === 0 && !context.peek('IDENTIFIER')) {
      var value: Expression = pratt.resume(context, Power.LOWEST, type); if (value === null) return null;
      if (!context.expect(';')) return null;
      return new ExpressionStatement(context.spanSince(range), value);
    }
    var id: Identifier = parseIdentifier(context); if (id === null) return null;

    // Function declaration
    if (context.peek('(')) {
      var isDefault: boolean = false;
      var args: VariableDeclaration[] = parseArguments(context); if (args === null) return null;
      var initializers: Initializer[] = [];
      var block: Block = null;
      if (!context.eat(';')) {
        block = parseBlock(context, StatementHint.NORMAL); if (block === null) return null;
      }
      return new FunctionDeclaration(context.spanSince(range), id, modifiers, FunctionKind.NORMAL, isDefault, type, initializers, args, block);
    }

    // Variable declaration
    var value: Expression = null;
    if (context.eat('=')) {
      value = pratt.parse(context, Power.LOWEST); if (value === null) return null;
    }
    if (!context.expect(';')) return null;
    return new VariableDeclaration(context.spanSince(range), id, modifiers, type, value);
  }

  // If statement
  if (context.eat('if')) {
    var value: Expression = parseGroup(context); if (value === null) return null;
    var thenBlock: Block = parseBlockOrStatement(context); if (thenBlock === null) return null;
    var elseBlock: Block = null;
    if (context.eat('else')) {
      elseBlock = parseBlockOrStatement(context); if (elseBlock === null) return null;
    }
    return new IfStatement(context.spanSince(range), value, thenBlock, elseBlock);
  }

  // While statement
  if (context.eat('while')) {
    var value: Expression = parseGroup(context); if (value === null) return null;
    var block: Block = parseBlockOrStatement(context); if (block === null) return null;
    return new WhileStatement(context.spanSince(range), value, block);
  }

  // For statement
  if (context.eat('for')) {
    if (!context.expect('(')) return null;
    var setup: Expression = null;
    var test: Expression = null;
    var update: Expression = null;
    if (!context.peek(';')) {
      setup = pratt.parse(context, Power.LOWEST); if (setup === null) return null;
    }
    if (!context.expect(';')) return null;
    if (!context.peek(';')) {
      test = pratt.parse(context, Power.LOWEST); if (test === null) return null;
    }
    if (!context.expect(';')) return null;
    if (!context.peek(')')) {
      update = pratt.parse(context, Power.LOWEST); if (update === null) return null;
    }
    if (!context.expect(')')) return null;
    var block: Block = parseBlockOrStatement(context); if (block === null) return null;
    return new ForStatement(context.spanSince(range), setup, test, update, block);
  }

  // Return statement
  if (context.eat('return')) {
    var value: Expression = null;
    if (!context.eat(';')) {
      value = pratt.parse(context, Power.LOWEST); if (value === null) return null;
      if (!context.expect(';')) return null;
    }
    return new ReturnStatement(context.spanSince(range), value);
  }

  // Delete statement
  if (context.eat('delete')) {
    var value: Expression = pratt.parse(context, Power.LOWEST); if (value === null) return null;
    if (!context.expect(';')) return null;
    return new DeleteStatement(context.spanSince(range), value);
  }

  // Break statement
  if (context.eat('break')) {
    if (!context.expect(';')) return null;
    return new BreakStatement(context.spanSince(range));
  }

  // Continue statement
  if (context.eat('continue')) {
    if (!context.expect(';')) return null;
    return new ContinueStatement(context.spanSince(range));
  }

  // Expression statement
  var value: Expression = pratt.parse(context, Power.LOWEST); if (value === null) return null;
  if (!context.expect(';')) return null;
  return new ExpressionStatement(context.spanSince(range), value);
}

function parseExpressions(context: ParserContext): Expression[] {
  var values: Expression[] = [];
  while (!context.peek(')')) {
    if (values.length > 0 && !context.expect(',')) return null;
    var value: Expression = pratt.parse(context, Power.COMMA); if (value === null) return null;
    values.push(value);
  }
  return values;
}

function parseTypes(context: ParserContext): Expression[] {
  var types: Expression[] = [];
  while (!context.peek('END_PARAMETER_LIST')) {
    if (types.length > 0 && !context.expect(',')) return null;
    var type: Expression = parseType(context); if (type === null) return null;
    types.push(type);
  }
  return types;
}

function buildUnaryPrefix(context: ParserContext, token: Token, node: Expression): Expression {
  return new UnaryExpression(spanRange(token.range, node.range), token.text, node);
}

function buildBinary(context: ParserContext, left: Expression, token: Token, right: Expression): Expression {
  return new BinaryExpression(spanRange(left.range, right.range), token.text, left, right);
}

// Cached parser
var pratt: Pratt = new Pratt();

// Literals
pratt.literal('null', (context, token) => new NullExpression(token.range));
pratt.literal('this', (context, token) => new ThisExpression(token.range));
pratt.literal('INT', (context, token) => new IntExpression(token.range, 0 | token.text));
pratt.literal('true', (context, token) => new BoolExpression(token.range, true));
pratt.literal('false', (context, token) => new BoolExpression(token.range, false));
pratt.literal('FLOAT', (context, token) => new FloatExpression(token.range, +token.text.slice(0, -1)));
pratt.literal('DOUBLE', (context, token) => new DoubleExpression(token.range, +token.text));
pratt.literal('IDENTIFIER', (context, token) => new SymbolExpression(token.range, token.text));

// Unary expressions
pratt.prefix('+', Power.UNARY, buildUnaryPrefix);
pratt.prefix('-', Power.UNARY, buildUnaryPrefix);
pratt.prefix('!', Power.UNARY, buildUnaryPrefix);
pratt.prefix('~', Power.UNARY, buildUnaryPrefix);
pratt.prefix('*', Power.UNARY, buildUnaryPrefix);
pratt.prefix('&', Power.UNARY, buildUnaryPrefix);
pratt.prefix('copy', Power.UNARY, (context, token, node) => new CopyExpression(spanRange(token.range, node.range), node));
pratt.prefix('move', Power.UNARY, (context, token, node) => new MoveExpression(spanRange(token.range, node.range), node));

// Binary expressions
pratt.infix(',', Power.COMMA, buildBinary);
pratt.infixRight('=', Power.ASSIGN, buildBinary);
pratt.infix('||', Power.OR, buildBinary);
pratt.infix('&&', Power.AND, buildBinary);
pratt.infix('|', Power.BITOR, buildBinary);
pratt.infix('^', Power.BITXOR, buildBinary);
pratt.infix('&', Power.BITAND, buildBinary);
pratt.infix('==', Power.EQ_NEQ, buildBinary);
pratt.infix('!=', Power.EQ_NEQ, buildBinary);
pratt.infix('<', Power.COMPARE, buildBinary);
pratt.infix('>', Power.COMPARE, buildBinary);
pratt.infix('<=', Power.COMPARE, buildBinary);
pratt.infix('>=', Power.COMPARE, buildBinary);
pratt.infix('<<', Power.SHIFT, buildBinary);
pratt.infix('>>', Power.SHIFT, buildBinary);
pratt.infix('>>>', Power.SHIFT, buildBinary);
pratt.infix('+', Power.ADD_SUB, buildBinary);
pratt.infix('-', Power.ADD_SUB, buildBinary);
pratt.infix('*', Power.MUL_DIV, buildBinary);
pratt.infix('/', Power.MUL_DIV, buildBinary);
pratt.infix('%', Power.MUL_DIV, buildBinary);

// Parenthetic group
pratt.parselet('(', Power.LOWEST).prefix = context => {
  return parseGroup(context);
};

// Cast expression
pratt.parselet('START_CAST', Power.LOWEST).prefix = context => {
  var token: Token = context.next();
  var type: Expression = parseType(context); if (type === null) return null;
  if (!context.expect('END_CAST')) return null;
  var value: Expression = pratt.parse(context, Power.UNARY); if (value === null) return null;
  return new CastExpression(context.spanSince(token.range), type, value);
};

// Ternary expression
pratt.parselet('?', Power.TERNARY).infix = (context, left) => {
  context.next();
  var middle: Expression = pratt.parse(context, Power.TERNARY); if (middle === null) return null;
  if (!context.expect(':')) return null;
  var right: Expression = pratt.parse(context, Power.TERNARY - 1); if (right === null) return null;
  return new TernaryExpression(context.spanSince(left.range), left, middle, right);
};

// Value member expression
pratt.parselet('.', Power.MEMBER).infix = (context, left) => {
  var token: Token = context.next();
  var id: Identifier = parseIdentifier(context); if (id === null) return null;
  return new MemberExpression(context.spanSince(left.range), '.', left, id);
};

// Pointer member expression
pratt.parselet('->', Power.MEMBER).infix = (context, left) => {
  var token: Token = context.next();
  var id: Identifier = parseIdentifier(context); if (id === null) return null;
  return new MemberExpression(context.spanSince(left.range), '->', left, id);
};

// Call expression
pratt.parselet('(', Power.CALL).infix = (context, left) => {
  var token: Token = context.next();
  var args: Expression[] = parseExpressions(context); if (args === null) return null;
  if (!context.expect(')')) return null;
  return new CallExpression(context.spanSince(left.range), left, args);
};

// Constructor expression
pratt.parselet('new', Power.LOWEST).prefix = context => {
  var token: Token = context.next();
  var type: Expression = parseType(context); if (type === null) return null;
  if (!context.expect('(')) return null;
  var args: Expression[] = parseExpressions(context); if (args === null) return null;
  if (!context.expect(')')) return null;
  return new NewExpression(context.spanSince(token.range), type, args);
};

// Type parameter expression
pratt.parselet('START_PARAMETER_LIST', Power.MEMBER).infix = (context, left) => {
  var token: Token = context.next();
  var parameters: Expression[] = parseTypes(context); if (parameters === null) return null;
  if (!context.expect('END_PARAMETER_LIST')) return null;
  return new TypeParameterExpression(context.spanSince(left.range), left, parameters);
};

function parse(log: Log, tokens: Token[]): Module {
  var context: ParserContext = new ParserContext(log, tokens);
  var range: SourceRange = context.current().range;
  var statements: Statement[] = parseStatements(context, StatementHint.NORMAL); if (statements === null) return null;
  if (!context.expect('END')) return null;
  range = context.spanSince(range);
  return new Module(range, new Block(range, statements));
}
