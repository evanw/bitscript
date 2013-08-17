declare var cppcodegen: any;

class OutputCPP implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
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
        bases: []
      }
    };
  }

  createVariables(variables: VariableDeclaration[]): Object[] {
    return variables.map(n => <Object>{
      kind: 'Variable',
      type: this.visitType(n.type.computedType),
      id: this.visitIdentifier(n.id)
    });
  }

  declareType(node: StructDeclaration): Object {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>
      node.block.statements.filter(n => n instanceof VariableDeclaration);

    return {
      kind: 'ObjectDeclaration',
      type: {
        kind: 'ObjectType',
        keyword: 'struct',
        id: this.visitIdentifier(node.id),
        bases: [],
        body: {
          kind: 'BlockStatement',
          body: this.createVariables(variables).map(n => <Object>{
            kind: 'VariableDeclaration',
            qualifiers: [],
            variables: [n]
          }).concat(
            // Forward-declare constructor
            {
              kind: 'FunctionDeclaration',
              qualifiers: [],
              type: {
                kind: 'FunctionType',
                'arguments': this.createVariables(variables.filter(n => n.value === null))
              },
              id: this.visitIdentifier(node.id)
            },

            // Forward-declare destructor
            {
              kind: 'FunctionDeclaration',
              qualifiers: [],
              type: {
                kind: 'FunctionType',
                'arguments': []
              },
              id: {
                kind: 'Identifier',
                name: '~' + node.id.name
              }
            }
          )
        }
      }
    };
  }

  implementType(node: StructDeclaration): Object[] {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>
      node.block.statements.filter(n => n instanceof VariableDeclaration);

    return [
      // Implement constructor
      {
        kind: 'FunctionDeclaration',
        qualifiers: [],
        type: {
          kind: 'FunctionType',
          'arguments': this.createVariables(variables.filter(n => n.value === null))
        },
        id: {
          kind: 'MemberType',
          inner: this.visitIdentifier(node.id),
          member: this.visitIdentifier(node.id)
        },
        body: {
          kind: 'BlockStatement',
          body: variables.map(n => ({
            kind: 'ExpressionStatement',
            expression: {
              kind: 'AssignmentExpression',
              operator: '=',
              left: n.value !== null ? this.visitIdentifier(n.id) : {
                kind: 'MemberExpression',
                operator: '->',
                object: {
                  kind: 'ThisExpression'
                },
                member: this.visitIdentifier(n.id)
              },
              right: n.value !== null ? n.value.acceptExpressionVisitor(this) : this.visitIdentifier(n.id)
            }
          }))
        }
      },

      // Implement destructor
      {
        kind: 'FunctionDeclaration',
        qualifiers: [],
        type: {
          kind: 'FunctionType',
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
          body: flatten(variables.map(n => {
            if (n.symbol.type.isOwned()) {
              return [{
                kind: 'ExpressionStatement',
                expression: {
                  kind: 'UnaryExpression',
                  operator: 'delete',
                  argument: this.visitIdentifier(n.id)
                }
              }];
            }

            if (n.symbol.type.isShared()) {
              return [{
                kind: 'ExpressionStatement',
                expression: {
                  kind: 'CallExpression',
                  callee: {
                    kind: 'MemberType',
                    inner: {
                      kind: 'Identifier',
                      name: 'bitscript'
                    },
                    member: {
                      kind: 'Identifier',
                      name: 'deref'
                    }
                  },
                  'arguments': [this.visitIdentifier(n.id)]
                }
              }];
            }

            return [];
          }))
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
          id: this.visitIdentifier(n.id)
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
        init: node.value !== null ? node.value.acceptExpressionVisitor(this) : null
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
      argument: node.value.acceptExpressionVisitor(this)
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
      member: this.visitIdentifier(node.id)
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
      arguments: node.args.map(n => n.acceptExpressionVisitor(this))
    };
  }

  visitModifierExpression(node: ModifierExpression): Object {
    assert(false);
    return null;
  }
}
