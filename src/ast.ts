////////////////////////////////////////////////////////////////////////////////
// Nodes
////////////////////////////////////////////////////////////////////////////////

class AST {
  uniqueID: number;
  static nextUniqueID: number = 0;

  constructor(
    public range: TRange) {
    this.uniqueID = AST.nextUniqueID++;
  }
}

class Module extends AST {
  constructor(
    range: TRange,
    public block: Block) {
    super(range);
  }
}

class Identifier extends AST {
  constructor(
    range: TRange,
    public name: string) {
    super(range);
  }
}

class Block extends AST {
  scope: Scope = null;

  constructor(
    range: TRange,
    public statements: Statement[]) {
    super(range);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Statements
////////////////////////////////////////////////////////////////////////////////

interface StatementVisitor<T> {
  visitExpressionStatement(node: ExpressionStatement): T;
  visitIfStatement(node: IfStatement): T;
  visitWhileStatement(node: WhileStatement): T;
  visitReturnStatement(node: ReturnStatement): T;
  visitBreakStatement(node: BreakStatement): T;
  visitContinueStatement(node: ContinueStatement): T;
  visitDeclaration(node: Declaration): T;
}

class Statement extends AST {
  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    assert(false);
    return null;
  }
}

class ExpressionStatement extends Statement {
  constructor(
    range: TRange,
    public value: Expression) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitExpressionStatement(this);
  }
}

class IfStatement extends Statement {
  constructor(
    range: TRange,
    public test: Expression,
    public thenBlock: Block,
    public elseBlock: Block) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitIfStatement(this);
  }
}

class WhileStatement extends Statement {
  constructor(
    range: TRange,
    public test: Expression,
    public block: Block) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitWhileStatement(this);
  }
}

class ReturnStatement extends Statement {
  constructor(
    range: TRange,
    public value: Expression) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitReturnStatement(this);
  }
}

class BreakStatement extends Statement {
  constructor(
    range: TRange) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitBreakStatement(this);
  }
}

class ContinueStatement extends Statement {
  constructor(
    range: TRange) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitContinueStatement(this);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Declarations
////////////////////////////////////////////////////////////////////////////////

interface DeclarationVisitor<T> {
  visitStructDeclaration(node: StructDeclaration): T;
  visitFunctionDeclaration(node: FunctionDeclaration): T;
  visitVariableDeclaration(node: VariableDeclaration): T;
}

class Declaration extends Statement {
  symbol: Symbol = null;

  constructor(
    range: TRange,
    public id: Identifier) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitDeclaration(this);
  }

  acceptDeclarationVisitor<T>(visitor: DeclarationVisitor<T>): T {
    assert(false);
    return null;
  }
}

class StructDeclaration extends Declaration {
  constructor(
    range: TRange,
    id: Identifier,
    public block: Block) {
    super(range, id);
  }

  acceptDeclarationVisitor<T>(visitor: DeclarationVisitor<T>): T {
    return visitor.visitStructDeclaration(this);
  }
}

class FunctionDeclaration extends Declaration {
  constructor(
    range: TRange,
    id: Identifier,
    public result: Expression,
    public args: VariableDeclaration[],
    public block: Block) {
    super(range, id);
  }

  acceptDeclarationVisitor<T>(visitor: DeclarationVisitor<T>): T {
    return visitor.visitFunctionDeclaration(this);
  }
}

class VariableDeclaration extends Declaration {
  constructor(
    range: TRange,
    id: Identifier,
    public type: Expression,
    public value: Expression) {
    super(range, id);
  }

  acceptDeclarationVisitor<T>(visitor: DeclarationVisitor<T>): T {
    return visitor.visitVariableDeclaration(this);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Expressions
////////////////////////////////////////////////////////////////////////////////

interface ExpressionVisitor<T> {
  visitSymbolExpression(node: SymbolExpression): T;
  visitUnaryExpression(node: UnaryExpression): T;
  visitBinaryExpression(node: BinaryExpression): T;
  visitTernaryExpression(node: TernaryExpression): T;
  visitMemberExpression(node: MemberExpression): T;
  visitIntExpression(node: IntExpression): T;
  visitBoolExpression(node: BoolExpression): T;
  visitDoubleExpression(node: DoubleExpression): T;
  visitNullExpression(node: NullExpression): T;
  visitCallExpression(node: CallExpression): T;
  visitNewExpression(node: NewExpression): T;
  visitModifierExpression(node: ModifierExpression): T;
}

class Expression extends AST {
  computedType: WrappedType = null;

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    assert(false);
    return null;
  }
}

class SymbolExpression extends Expression {
  symbol: Symbol = null;

  constructor(
    range: TRange,
    public name: string) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitSymbolExpression(this);
  }
}

class UnaryExpression extends Expression {
  constructor(
    range: TRange,
    public op: string,
    public value: Expression) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitUnaryExpression(this);
  }
}

class BinaryExpression extends Expression {
  constructor(
    range: TRange,
    public op: string,
    public left: Expression,
    public right: Expression) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitBinaryExpression(this);
  }

  isAssignment(): boolean {
    return this.op === '=';
  }
}

class TernaryExpression extends Expression {
  constructor(
    range: TRange,
    public value: Expression,
    public trueValue: Expression,
    public falseValue: Expression) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitTernaryExpression(this);
  }
}

class MemberExpression extends Expression {
  symbol: Symbol = null;

  constructor(
    range: TRange,
    public value: Expression,
    public id: Identifier) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitMemberExpression(this);
  }
}

class IntExpression extends Expression {
  constructor(
    range: TRange,
    public value: number) {
    super(range);
    assert(value === (0 | value));
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitIntExpression(this);
  }
}

class BoolExpression extends Expression {
  constructor(
    range: TRange,
    public value: boolean) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitBoolExpression(this);
  }
}

class DoubleExpression extends Expression {
  constructor(
    range: TRange,
    public value: number) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitDoubleExpression(this);
  }
}

class NullExpression extends Expression {
  constructor(
    range: TRange) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitNullExpression(this);
  }
}

class CallExpression extends Expression {
  constructor(
    range: TRange,
    public value: Expression,
    public args: Expression[]) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitCallExpression(this);
  }
}

class NewExpression extends Expression {
  constructor(
    range: TRange,
    public type: Expression,
    public args: Expression[]) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitNewExpression(this);
  }
}

class ModifierExpression extends Expression {
  constructor(
    range: TRange,
    public type: Expression,
    public modifiers: number) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitModifierExpression(this);
  }
}
