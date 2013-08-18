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
  var token: Token = context.current();
  if (!context.expect('(')) return null;
  var value: Expression = pratt.parse(context, Power.LOWEST); if (value === null) return null;
  if (!context.expect(')')) return null;
  return value;
}

function parseBlock(context: ParserContext): Block {
  var token: Token = context.current();
  if (!context.expect('{')) return null;
  var statements: Statement[] = parseStatements(context); if (statements === null) return null;
  if (!context.expect('}')) return null;
  return new Block(context.spanSince(token.range), statements);
}

function parseBlockOrStatement(context: ParserContext): Block {
  if (context.peek('{')) return parseBlock(context);
  var statement: Statement = parseStatement(context);
  if (statement === null) return null;
  return new Block(statement.range, [statement]);
}

function parseIdentifier(context: ParserContext): Identifier {
  var token: Token = context.current(); if (!context.expect('IDENTIFIER')) return null;
  return new Identifier(token.range, token.text);
}

function parseType(context: ParserContext): Expression {
  var range: SourceRange = context.current().range;

  // Parse type modifiers
  var modifiers: number = 0;
  for (;;) {
    var token: Token = context.current();
    var modifier: number = 0;
    if (context.eat('owned')) modifier = TypeModifier.OWNED;
    else if (context.eat('shared')) modifier = TypeModifier.SHARED;
    else break;
    if (modifiers & modifier) syntaxErrorDuplicateModifier(context.log, token);
    modifiers |= modifier;
  }

  var value: Expression = pratt.parse(context, Power.MEMBER - 1); if (value === null) return null;
  return modifiers !== 0 ? new TypeModifierExpression(context.spanSince(range), value, modifiers) : value;
}

function parseArguments(context: ParserContext): VariableDeclaration[] {
  var args: VariableDeclaration[] = [];
  while (!context.peek(')')) {
    if (args.length > 0 && !context.expect(',')) return null;
    var type: Expression = parseType(context); if (type === null) return null;
    var id: Identifier = parseIdentifier(context); if (id === null) return null;
    args.push(new VariableDeclaration(spanRange(type.range, id.range), id, 0, type, null));
  }
  return args;
}

function parseStatements(context: ParserContext): Statement[] {
  var statements: Statement[] = [];
  while (!context.peek('}') && !context.peek('END')) {
    var statement: Statement = parseStatement(context); if (statement === null) return null;
    statements.push(statement);
  }
  return statements;
}

function parseStatement(context: ParserContext): Statement {
  var range: SourceRange = context.current().range;

  // Parse symbol modifiers
  var modifiers: number = 0;
  for (;;) {
    var token: Token = context.current();
    var modifier: number = 0;
    if (context.eat('over')) modifier = SymbolModifier.OVER;
    else break;
    if (modifiers & modifier) syntaxErrorDuplicateModifier(context.log, token);
    modifiers |= modifier;
  }

  // Object declaration
  if (context.eat('class')) {
    var id: Identifier = parseIdentifier(context); if (id === null) return null;
    var base: Expression = null;
    if (context.eat(':')) {
      base = pratt.parse(context, Power.CALL); if (base === null) return null;
    }
    var block: Block = parseBlock(context); if (block === null) return null;
    return new ObjectDeclaration(context.spanSince(range), id, modifiers, base, block);
  }

  // Disambiguate identifiers used in expressions from identifiers used
  // as types in symbol declarations by starting to parse a type and
  // switching over to parsing an expression if it doesn't work out
  if (modifiers !== 0 ||
      context.peek('IDENTIFIER') ||
      context.peek('owned') ||
      context.peek('shared')) {
    var type: Expression = parseType(context); if (type === null) return null;
    if (modifiers === 0 && !context.peek('IDENTIFIER')) {
      var value: Expression = pratt.resume(context, Power.LOWEST, type); if (value === null) return null;
      if (!context.expect(';')) return null;
      return new ExpressionStatement(context.spanSince(range), value);
    }
    var id: Identifier = parseIdentifier(context); if (id === null) return null;

    // Function declaration
    var group: Token = context.current();
    if (context.eat('(')) {
      var args: VariableDeclaration[] = parseArguments(context); if (args === null) return null;
      if (!context.expect(')')) return null;
      var block: Block = parseBlock(context); if (block === null) return null;
      return new FunctionDeclaration(context.spanSince(range), id, modifiers, type, args, block);
    }

    // Variable declaration
    var value: Expression = null;
    if (context.eat('=')) value = pratt.parse(context, Power.LOWEST);
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

  // Return statement
  if (context.eat('return')) {
    var value: Expression = null;
    if (!context.eat(';')) {
      value = pratt.parse(context, Power.LOWEST); if (value === null) return null;
      if (!context.expect(';')) return null;
    }
    return new ReturnStatement(context.spanSince(range), value);
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
    var value: Expression = pratt.parse(context, Power.COMMA);
    if (value === null) return null;
    values.push(value);
  }
  return values;
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
pratt.literal('DOUBLE', (context, token) => new DoubleExpression(token.range, +token.text));
pratt.literal('IDENTIFIER', (context, token) => new SymbolExpression(token.range, token.text));

// Unary expressions
pratt.prefix('+', Power.UNARY, buildUnaryPrefix);
pratt.prefix('-', Power.UNARY, buildUnaryPrefix);
pratt.prefix('!', Power.UNARY, buildUnaryPrefix);
pratt.prefix('~', Power.UNARY, buildUnaryPrefix);

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

// Ternary expression
pratt.parselet('?', Power.TERNARY).infix = (context, left) => {
  context.next();
  var middle: Expression = pratt.parse(context, Power.TERNARY); if (middle === null) return null;
  if (!context.expect(':')) return null;
  var right: Expression = pratt.parse(context, Power.TERNARY - 1); if (right === null) return null;
  return new TernaryExpression(context.spanSince(left.range), left, middle, right);
};

// Member expression
pratt.parselet('.', Power.MEMBER).infix = (context, left) => {
  var token: Token = context.next();
  var id: Identifier = parseIdentifier(context); if (id === null) return null;
  return new MemberExpression(context.spanSince(left.range), left, id);
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

function parse(log: Log, tokens: Token[]): Module {
  var context: ParserContext = new ParserContext(log, tokens);
  var range: SourceRange = context.current().range;
  var statements: Statement[] = parseStatements(context); if (statements === null) return null;
  if (!context.expect('END')) return null;
  range = context.spanSince(range);
  return new Module(range, new Block(range, statements));
}
