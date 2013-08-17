declare var cppcodegen: any;

class OutputCPP implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
  static generate(node: Module): string {
    return cppcodegen.generate(new OutputCPP().visitModule(node), { indent: '  ' });
  }

  defaultForType(type: WrappedType): Object {
    var t: Type = type.innerType;

    if (t === SpecialType.INT) {
      return {
        kind: 'IntegerLiteral',
        value: 0
      };
    }

    if (t === SpecialType.DOUBLE) {
      return {
        kind: 'DoubleLiteral',
        value: 0
      };
    }

    if (t === SpecialType.BOOL) {
      return {
        kind: 'BooleanLiteral',
        value: false
      };
    }

    return {
      kind: 'NullLiteral'
    };
  }

  visitModule(node: Module): Object {
    return {
      kind: 'Program',
      body: node.block.statements.map(n => n.acceptStatementVisitor(this))
    };
  }

  visitBlock(node: Block): Object {
    return {
      kind: 'BlockStatement',
      body: node.statements.map(n => n.acceptStatementVisitor(this))
    };
  }

  visitIdentifier(node: Identifier): Object {
    return {
      kind: 'Identifier',
      name: node.name
    };
  }

  visitExpressionStatement(node: ExpressionStatement): Object {
    return {
      kind: 'ExpressionStatement',
      expression: node.value.acceptExpressionVisitor(this)
    };
  }

  visitIfStatement(node: IfStatement): Object {
    return {
      kind: 'IfStatement',
      test: node.test.acceptExpressionVisitor(this),
      consequent: this.visitBlock(node.thenBlock),
      alternate: node.elseBlock !== null ? this.visitBlock(node.elseBlock) : null
    };
  }

  visitWhileStatement(node: WhileStatement): Object {
    return {
      kind: 'WhileStatement',
      test: node.test.acceptExpressionVisitor(this),
      body: this.visitBlock(node.block)
    };
  }

  visitReturnStatement(node: ReturnStatement): Object {
    return {
      kind: 'ReturnStatement',
      argument: node.value !== null ? node.value.acceptExpressionVisitor(this) : null
    };
  }

  visitBreakStatement(node: BreakStatement): Object {
    return {
      kind: 'BreakStatement',
      label: null
    };
  }

  visitContinueStatement(node: ContinueStatement): Object {
    return {
      kind: 'ContinueStatement',
      label: null
    };
  }

  visitDeclaration(node: Declaration): Object {
    return node.acceptDeclarationVisitor(this);
  }

  visitStructDeclaration(node: StructDeclaration): Object {
    return {
      kind: 'ExpressionStatement',
      expression: {
        kind: 'NullLiteral'
      }
    };
  }

  visitFunctionDeclaration(node: FunctionDeclaration): Object {
    return {
      kind: 'FunctionDeclaration',
      qualifiers: [],
      type: {
        kind: 'FunctionType',
        'return': { kind: 'Identifier', name: 'TODO' },
        'arguments': []
      },
      id: this.visitIdentifier(node.id),
      body: this.visitBlock(node.block)
    };
  }

  visitVariableDeclaration(node: VariableDeclaration): Object {
    return {
      kind: 'ExpressionStatement',
      expression: {
        kind: 'NullLiteral'
      }
    };
  }

  visitSymbolExpression(node: SymbolExpression): Object {
    return {
      kind: 'Identifier',
      name: node.name
    };
  }

  visitUnaryExpression(node: UnaryExpression): Object {
    return {
      kind: 'UnaryExpression',
      operator: node.op,
      argument: node.value.acceptExpressionVisitor(this),
      prefix: true
    };
  }

  visitBinaryExpression(node: BinaryExpression): Object {
    return {
      kind: node.op === '=' ? 'AssignmentExpression' : 'BinaryExpression',
      operator: node.op,
      left: node.left.acceptExpressionVisitor(this),
      right: node.right.acceptExpressionVisitor(this)
    };
  }

  visitTernaryExpression(node: TernaryExpression): Object {
    return {
      kind: 'ConditionalExpression',
      test: node.value.acceptExpressionVisitor(this),
      consequent: node.trueValue.acceptExpressionVisitor(this),
      alternate: node.falseValue.acceptExpressionVisitor(this)
    };
  }

  visitMemberExpression(node: MemberExpression): Object {
    return {
      kind: 'MemberExpression',
      operator: '->',
      object: node.value.acceptExpressionVisitor(this),
      property: this.visitIdentifier(node.id)
    };
  }

  visitIntExpression(node: IntExpression): Object {
    return {
      kind: 'IntegerLiteral',
      value: node.value
    };
  }

  visitBoolExpression(node: BoolExpression): Object {
    return {
      kind: 'BooleanLiteral',
      value: node.value
    };
  }

  visitDoubleExpression(node: DoubleExpression): Object {
    return {
      kind: 'DoubleLiteral',
      value: node.value
    };
  }

  visitNullExpression(node: NullExpression): Object {
    return {
      kind: 'NullLiteral'
    };
  }

  visitCallExpression(node: CallExpression): Object {
    return {
      kind: 'CallExpression',
      callee: node.value.acceptExpressionVisitor(this),
      arguments: node.args.map(n => n.acceptExpressionVisitor(this))
    };
  }

  visitNewExpression(node: NewExpression): Object {
    return {
      kind: 'NewExpression',
      callee: node.type.acceptExpressionVisitor(this),
      arguments: []
    };
  }

  visitModifierExpression(node: ModifierExpression): Object {
    assert(false);
    return null;
  }
}
