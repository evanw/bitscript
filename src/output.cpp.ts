declare var cppcodegen: any;

enum OutputCPPMode {
  NORMAL,
  DEFINE_STRUCT,
  IMPLEMENT_STRUCT
}

class OutputCPP implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
  mode: OutputCPPMode = OutputCPPMode.NORMAL;

  static generate(node: Module): string {
    return cppcodegen.generate(new OutputCPP().visitModule(node), { indent: '  ' });
  }

  defaultForType(type: WrappedType): Object {
    switch (type.innerType) {
    case SpecialType.INT:
      return {
        kind: 'IntegerLiteral',
        value: 0
      };

    case SpecialType.DOUBLE:
      return {
        kind: 'DoubleLiteral',
        value: 0
      };

    case SpecialType.BOOL:
      return {
        kind: 'BooleanLiteral',
        value: false
      };
    }

    return {
      kind: 'NullLiteral'
    };
  }

  visitType(type: WrappedType): Object {
    switch (type.innerType) {
    case SpecialType.INT: return { kind: 'Identifier', name: 'int' };
    case SpecialType.VOID: return { kind: 'Identifier', name: 'void' };
    case SpecialType.BOOL: return { kind: 'Identifier', name: 'bool' };
    case SpecialType.DOUBLE: return { kind: 'Identifier', name: 'double' };
    }

    assert(type.innerType instanceof StructType);
    var inner: Object = {
      kind: 'Identifier',
      name: (<StructType>type.innerType).name
    };
    return type.isPointer() ? { kind: 'PointerType', inner: inner } : inner;
  }

  forwardDeclareType(node: StructDeclaration): Object {
    return {
      kind: 'ObjectDeclaration',
      type: {
        kind: 'ObjectType',
        keyword: 'struct',
        id: this.visitIdentifier(node.id),
        bases: [],
        body: null
      }
    };
  }

  declareType(node: StructDeclaration): Object {
    this.mode = OutputCPPMode.DEFINE_STRUCT;
    var body: any = this.visitBlock(node.block);
    this.mode = OutputCPPMode.NORMAL;

    body.body = body.body.concat(
      // Forward-declare constructor
      {
        kind: 'FunctionDeclaration',
        qualifiers: [],
        type: {
          kind: 'FunctionType',
          'return': null,
          'arguments': []
        },
        id: this.visitIdentifier(node.id),
        body: null
      },

      // Forward-declare destructor
      {
        kind: 'FunctionDeclaration',
        qualifiers: [],
        type: {
          kind: 'FunctionType',
          'return': null,
          'arguments': []
        },
        id: {
          kind: 'Identifier',
          name: '~' + node.id.name
        },
        body: null
      }
    );

    return {
      kind: 'ObjectDeclaration',
      type: {
        kind: 'ObjectType',
        keyword: 'struct',
        id: this.visitIdentifier(node.id),
        bases: [],
        body: body
      }
    };
  }

  implementType(node: StructDeclaration): Object[] {
    return [
      // Implement constructor
      {
        kind: 'FunctionDeclaration',
        qualifiers: [],
        type: {
          kind: 'FunctionType',
          'return': null,
          'arguments': []
        },
        id: {
          kind: 'MemberType',
          inner: this.visitIdentifier(node.id),
          member: this.visitIdentifier(node.id)
        },
        body: {
          kind: 'BlockStatement',
          body: []
        }
      },

      // Implement destructor
      {
        kind: 'FunctionDeclaration',
        qualifiers: [],
        type: {
          kind: 'FunctionType',
          'return': null,
          'arguments': []
        },
        id: {
          kind: 'MemberType',
          inner: this.visitIdentifier(node.id),
          member: {
            kind: 'Identifier',
            name: '~' + node.id.name
          }
        },
        body: {
          kind: 'BlockStatement',
          body: []
        }
      }
    ];
  }

  visitModule(node: Module): Object {
    return {
      kind: 'Program',
      body: flatten([
        node.block.statements.filter(n => n instanceof StructDeclaration).map(n => this.forwardDeclareType(n)),
        node.block.statements.filter(n => n instanceof StructDeclaration).map(n => this.declareType(n)),
        flatten(node.block.statements.filter(n => n instanceof StructDeclaration).map(n => this.implementType(n))),
        node.block.statements.filter(n => !(n instanceof StructDeclaration)).map(n => n.acceptStatementVisitor(this))])
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
      kind: 'BreakStatement'
    };
  }

  visitContinueStatement(node: ContinueStatement): Object {
    return {
      kind: 'ContinueStatement'
    };
  }

  visitDeclaration(node: Declaration): Object {
    return node.acceptDeclarationVisitor(this);
  }

  visitStructDeclaration(node: StructDeclaration): Object {
    assert(false);
    return null;
  }

  visitFunctionDeclaration(node: FunctionDeclaration): Object {
    return {
      kind: 'FunctionDeclaration',
      qualifiers: [],
      type: {
        kind: 'FunctionType',
        'return': this.visitType(node.result.computedType),
        'arguments': node.args.map(n => ({
          kind: 'Variable',
          type: this.visitType(n.type.computedType),
          id: this.visitIdentifier(n.id),
          init: null
        }))
      },
      id: this.visitIdentifier(node.id),
      body: this.visitBlock(node.block)
    };
  }

  visitVariableDeclaration(node: VariableDeclaration): Object {
    return {
      kind: 'VariableDeclaration',
      qualifiers: [],
      variables: [{
        kind: 'Variable',
        type: this.visitType(node.type.computedType),
        id: this.visitIdentifier(node.id),
        init: node.value !== null && this.mode !== OutputCPPMode.DEFINE_STRUCT ?
          node.value.acceptExpressionVisitor(this) : null
      }]
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
      operator: node.value.computedType.isPointer() ? '->' : '.',
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
