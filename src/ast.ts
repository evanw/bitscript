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

  objectDeclarations(): ObjectDeclaration[] {
    return <ObjectDeclaration[]>this.statements.filter(n => n instanceof ObjectDeclaration);
  }

  // Sort objects so base objects come before derived objects
  sortedObjectDeclarations(): ObjectDeclaration[] {
    var list = this.objectDeclarations();
    for (var i = 0; i < list.length; i++) {
      var I = list[i].symbol.type.asObject();
      for (var j = 0; j < i; j++) {
        var J = list[j].symbol.type.asObject();
        if (TypeLogic.isBaseTypeOf(J, I)) {
          list.splice(j, 0, list.splice(i, 1)[0]);
          i = j - 1;
        }
      }
    }
    return list;
  }

  variableDeclarations(): VariableDeclaration[] {
    return <VariableDeclaration[]>this.statements.filter(n => n instanceof VariableDeclaration);
  }

  variableDeclarationsWithValues(): VariableDeclaration[] {
    return this.variableDeclarations().filter(n => n.value !== null);
  }

  variableDeclarationsWithoutValues(): VariableDeclaration[] {
    return this.variableDeclarations().filter(n => n.value !== null);
  }

  functionDeclarations(): FunctionDeclaration[] {
    return <FunctionDeclaration[]>this.statements.filter(n => n instanceof FunctionDeclaration);
  }

  functionDeclarationsWithBlocks(): FunctionDeclaration[] {
    return this.functionDeclarations().filter(n => n.block !== null);
  }

  functionDeclarationsWithoutBlocks(): FunctionDeclaration[] {
    return this.functionDeclarations().filter(n => n.block !== null);
  }
}

////////////////////////////////////////////////////////////////////////////////
// Statements
////////////////////////////////////////////////////////////////////////////////

interface StatementVisitor<T> {
  visitExpressionStatement(node: ExpressionStatement): T;
  visitIfStatement(node: IfStatement): T;
  visitWhileStatement(node: WhileStatement): T;
  visitForStatement(node: ForStatement): T;
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

class ForStatement extends Statement {
  constructor(
    range: SourceRange,
    public setup: Expression,
    public test: Expression,
    public update: Expression,
    public block: Block) {
    super(range);
  }

  acceptStatementVisitor<T>(visitor: StatementVisitor<T>): T {
    return visitor.visitForStatement(this);
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
  // Store a separate scope for the function arguments because the function
  // may be abstract, in which case we can't use the scope of the body block
  scope: Scope = null;

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
  visitMoveExpression(node: MoveExpression): T;
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
  visitTypeParameterExpression(node: TypeParameterExpression): T;
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

// A move expression is the only way to convert from an owned L-value.
// Originally you could transfer ownership with a simple assignment, but
// that led to too many dangling pointer mistakes. This way, ownership
// transfers are explicit and easy to see when reading your code.
class MoveExpression extends Expression {
  constructor(
    range: SourceRange,
    public value: Expression) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitMoveExpression(this);
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

class TypeParameterExpression extends Expression {
  constructor(
    range: SourceRange,
    public type: Expression,
    public parameters: Expression[]) {
    super(range);
  }

  acceptExpressionVisitor<T>(visitor: ExpressionVisitor<T>): T {
    return visitor.visitTypeParameterExpression(this);
  }
}
