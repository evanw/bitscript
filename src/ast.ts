////////////////////////////////////////////////////////////////////////////////
// Nodes
////////////////////////////////////////////////////////////////////////////////

class AST {
  uniqueID: number;
  static nextUniqueID: number = 0;

  constructor(
    public range: SourceRange) {
    this.uniqueID = AST.nextUniqueID++;
  }
}

class Module extends AST {
  constructor(
    range: SourceRange,
    public block: Block) {
    super(range);
  }

  // Sort objects so base objects come before derived objects
  sortedObjectDeclarations(): ObjectDeclaration[] {
    return <ObjectDeclaration[]>this.block.statements
      .filter(n => n instanceof ObjectDeclaration)
      .sort((a, b) => {
        var A = a.symbol.type.asObject();
        var B = b.symbol.type.asObject();
        return +TypeLogic.isBaseTypeOf(A, B) - +TypeLogic.isBaseTypeOf(B, A);
      });
  }
}

class Identifier extends AST {
  constructor(
    range: SourceRange,
    public name: string) {
    super(range);
  }
}

class Block extends AST {
  scope: Scope = null;

  constructor(
    range: SourceRange,
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
    range: SourceRange,
    public value: Expression) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitExpressionStatement(this);
  }
}

class IfStatement extends Statement {
  constructor(
    range: SourceRange,
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
    range: SourceRange,
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
    range: SourceRange,
    public value: Expression) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitReturnStatement(this);
  }
}

class BreakStatement extends Statement {
  constructor(
    range: SourceRange) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitBreakStatement(this);
  }
}

class ContinueStatement extends Statement {
  constructor(
    range: SourceRange) {
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
  visitObjectDeclaration(node: ObjectDeclaration): T;
  visitFunctionDeclaration(node: FunctionDeclaration): T;
  visitVariableDeclaration(node: VariableDeclaration): T;
}

class Declaration extends Statement {
  symbol: Symbol = null;

  constructor(
    range: SourceRange,
    public id: Identifier,
    public modifiers: number) {
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

class ObjectDeclaration extends Declaration {
  constructor(
    range: SourceRange,
    id: Identifier,
    modifiers: number,
    public base: Expression,
    public block: Block) {
    super(range, id, modifiers);
  }

  acceptDeclarationVisitor<T>(visitor: DeclarationVisitor<T>): T {
    return visitor.visitObjectDeclaration(this);
  }
}

class FunctionDeclaration extends Declaration {
  constructor(
    range: SourceRange,
    id: Identifier,
    modifiers: number,
    public result: Expression,
    public args: VariableDeclaration[],
    public block: Block) {
    super(range, id, modifiers);
  }

  acceptDeclarationVisitor<T>(visitor: DeclarationVisitor<T>): T {
    return visitor.visitFunctionDeclaration(this);
  }
}

class VariableDeclaration extends Declaration {
  constructor(
    range: SourceRange,
    id: Identifier,
    modifiers: number,
    public type: Expression,
    public value: Expression) {
    super(range, id, modifiers);
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
  visitThisExpression(node: ThisExpression): T;
  visitCallExpression(node: CallExpression): T;
  visitNewExpression(node: NewExpression): T;
  visitTypeModifierExpression(node: TypeModifierExpression): T;
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
    range: SourceRange,
    public name: string) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitSymbolExpression(this);
  }
}

class UnaryExpression extends Expression {
  constructor(
    range: SourceRange,
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
    range: SourceRange,
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
    range: SourceRange,
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
    range: SourceRange,
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
    range: SourceRange,
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
    range: SourceRange,
    public value: boolean) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitBoolExpression(this);
  }
}

class DoubleExpression extends Expression {
  constructor(
    range: SourceRange,
    public value: number) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitDoubleExpression(this);
  }
}

class NullExpression extends Expression {
  constructor(
    range: SourceRange) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitNullExpression(this);
  }
}

class ThisExpression extends Expression {
  constructor(
    range: SourceRange) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitThisExpression(this);
  }
}

class CallExpression extends Expression {
  constructor(
    range: SourceRange,
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
    range: SourceRange,
    public type: Expression,
    public args: Expression[]) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitNewExpression(this);
  }
}

class TypeModifierExpression extends Expression {
  constructor(
    range: SourceRange,
    public type: Expression,
    public modifiers: number) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitTypeModifierExpression(this);
  }
}
