class ParserContext {
  index: number = 0;

  constructor(
    public log: Log,
    public tokens: Token[]) {
  }

  current(): Token {
    return this.tokens[this.index];
  }

  next(): Token {
    var token: Token = this.current();
    if (this.index + 1 < this.tokens.length) { this.index++; }
    return token;
  }

  spanSince(range: SourceRange): SourceRange {
    return spanRange(range, this.tokens[this.index > 0 ? this.index - 1 : 0].range);
  }

  peek(kind: string): boolean {
    return this.current().kind === kind;
  }

  eat(kind: string): boolean {
    if (this.peek(kind)) {
      this.next();
      return true;
    }
    return false;
  }

  expect(kind: string): boolean {
    if (!this.eat(kind)) {
      syntaxErrorExpectedToken(this.log, this.current(), kind);
      return false;
    }
    return true;
  }
}

class Parselet {
  prefix: (context: ParserContext) => Expression = null;
  infix: (context: ParserContext, left: Expression) => Expression = null;

  constructor(
    public power: number) {
  }
}

// A Pratt parser is a parser that associates up to two operations per token,
// each with its own precedence. Pratt parsers excel at parsing expression
// trees with deeply nested precedence levels. For an excellent writeup, see:
//
//   http://journal.stuffwithstuff.com/2011/03/19/pratt-parsers-expression-parsing-made-easy/
//
class Pratt {
  table: { [index: string]: Parselet } = {};

  parselet(kind: string, power: number): Parselet {
    if (kind in this.table) {
      var parselet: Parselet = this.table[kind];
      if (power > parselet.power) parselet.power = power;
      return parselet;
    }
    return this.table[kind] = new Parselet(power);
  }

  parse(context: ParserContext, power: number): Expression {
    var kind: string = context.current().kind;
    var parselet: Parselet = this.table[kind] || null;
    if (parselet === null || parselet.prefix === null) {
      syntaxErrorUnexpectedToken(context.log, context.current());
      return null;
    }
    return this.resume(context, power, parselet.prefix(context));
  }

  resume(context: ParserContext, power: number, left: Expression): Expression {
    while (left !== null) {
      var kind: string = context.current().kind;
      var parselet: Parselet = this.table[kind] || null;
      if (parselet === null || parselet.infix === null || parselet.power <= power) break;
      left = parselet.infix(context, left);
    }
    return left;
  }

  literal(kind: string, callback: (context: ParserContext, token: Token) => Expression) {
    this.parselet(kind, Power.LOWEST).prefix = context => callback(context, context.next());
  }

  prefix(kind: string, power: number, callback: (context: ParserContext, token: Token, value: Expression) => Expression) {
    this.parselet(kind, Power.LOWEST).prefix = context => {
      var token: Token = context.next();
      var value: Expression = this.parse(context, power);
      return value !== null ? callback(context, token, value) : null;
    };
  }

  postfix(kind: string, power: number, callback: (context: ParserContext, value: Expression, token: Token) => Expression) {
    this.parselet(kind, power).infix = (context, left) => {
      return callback(context, left, context.next());
    };
  }

  infix(kind: string, power: number, callback: (context: ParserContext, left: Expression, token: Token, right: Expression) => Expression) {
    this.parselet(kind, power).infix = (context, left) => {
      var token: Token = context.next();
      var right: Expression = this.parse(context, power);
      return right !== null ? callback(context, left, token, right) : null;
    };
  }

  infixRight(kind: string, power: number, callback: (context: ParserContext, left: Expression, token: Token, right: Expression) => Expression) {
    this.parselet(kind, power).infix = (context, left) => {
      var token: Token = context.next();
      var right: Expression = this.parse(context, power - 1); // Subtract 1 for right-associativity
      return right !== null ? callback(context, left, token, right) : null;
    };
  }
}
