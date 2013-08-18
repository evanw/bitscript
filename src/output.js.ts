declare var esprima: any;
declare var escodegen: any;

class OutputJS implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
  needMultiplicationPolyfill: boolean = false;

  static generate(node: Module): string {
    return escodegen.generate(new OutputJS().visitModule(node), { format: { indent: { style: '  ' } } });
  }

  defaultForType(type: WrappedType): Object {
    var t: Type = type.innerType;
    return {
      type: 'Literal',
      value:
        t === SpecialType.INT || t === SpecialType.DOUBLE ? <any>0 :
        t === SpecialType.BOOL ? <any>false :
        <any>null
    };
  }

  visitModule(node: Module): Object {
    var result: any = {
      type: 'Program',
      body: flatten([
        flatten(node.block.statements.filter(n => n instanceof StructDeclaration).map(n => this.generateStructDeclaration(n))),
        node.block.statements.filter(n => !(n instanceof StructDeclaration)).map(n => n.acceptStatementVisitor(this)),
      ])
    };

    if (this.needMultiplicationPolyfill) {
      result.body.unshift(esprima.parse([
        'if (!Math.imul) {',
        '  Math.imul = function(a, b) {',
        '    var al = a & 0xFFFF, bl = b & 0xFFFF;',
        '    return al * bl + ((a >>> 16) * bl + al * (b >>> 16) << 16) | 0;',
        '  };',
        '}',
      ].join('\n')));
    }

    return result;
  }

  visitBlock(node: Block): Object {
    return {
      type: 'BlockStatement',
      body: node.statements.map(n => n.acceptStatementVisitor(this))
    };
  }

  visitIdentifier(node: Identifier): Object {
    return {
      type: 'Identifier',
      name: node.name
    };
  }

  visitExpressionStatement(node: ExpressionStatement): Object {
    return {
      type: 'ExpressionStatement',
      expression: node.value.acceptExpressionVisitor(this)
    };
  }

  visitIfStatement(node: IfStatement): Object {
    return {
      type: 'IfStatement',
      test: node.test.acceptExpressionVisitor(this),
      consequent: this.visitBlock(node.thenBlock),
      alternate: node.elseBlock !== null ? this.visitBlock(node.elseBlock) : null
    };
  }

  visitWhileStatement(node: WhileStatement): Object {
    return {
      type: 'WhileStatement',
      test: node.test.acceptExpressionVisitor(this),
      body: this.visitBlock(node.block)
    };
  }

  visitReturnStatement(node: ReturnStatement): Object {
    return {
      type: 'ReturnStatement',
      argument: node.value !== null ? node.value.acceptExpressionVisitor(this) : null
    };
  }

  visitBreakStatement(node: BreakStatement): Object {
    return {
      type: 'BreakStatement',
      label: null
    };
  }

  visitContinueStatement(node: ContinueStatement): Object {
    return {
      type: 'ContinueStatement',
      label: null
    };
  }

  visitDeclaration(node: Declaration): Object {
    return node.acceptDeclarationVisitor(this);
  }

  generateConstructor(node: StructDeclaration): Object {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>
      node.block.statements.filter(n => n instanceof VariableDeclaration);
    return {
      type: 'FunctionDeclaration',
      params: variables
        .filter(n => n.value === null)
        .map(n => { return this.visitIdentifier(n.id); }),
      id: this.visitIdentifier(node.id),
      body: {
        type: 'BlockStatement',
        body: variables.map(n => {
          return {
            type: 'ExpressionStatement',
            expression: {
              type: 'AssignmentExpression',
              operator: '=',
              left: {
                type: 'MemberExpression',
                object: {
                  type: 'ThisExpression'
                },
                property: this.visitIdentifier(n.id),
                computed: false
              },
              right: n.value !== null ? n.value.acceptExpressionVisitor(this) : this.visitIdentifier(n.id)
            }
          }
        })
      }
    };
  }

  generateMemberFunctions(node: StructDeclaration): Object[] {
    return node.block.statements.filter(n => n instanceof FunctionDeclaration).map(n => {
      var result: any = this.visitFunctionDeclaration(n);
      result.type = 'FunctionExpression';
      result.id = null;
      return {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: {
            type: 'MemberExpression',
            object: {
              type: 'MemberExpression',
              object: this.visitIdentifier(node.id),
              property: { type: 'Identifier', name: 'prototype' }
            },
            property: this.visitIdentifier(n.id)
          },
          right: result
        }
      };
    });
  }

  generateStructDeclaration(node: StructDeclaration): Object[] {
    return [this.generateConstructor(node)].concat(this.generateMemberFunctions(node));
  }

  visitStructDeclaration(node: StructDeclaration): Object {
    assert(false);
    return null;
  }

  visitFunctionDeclaration(node: FunctionDeclaration): Object {
    return {
      type: 'FunctionDeclaration',
      params: node.args.map(n => this.visitIdentifier(n.id)),
      id: this.visitIdentifier(node.id),
      body: this.visitBlock(node.block)
    };
  }

  visitVariableDeclaration(node: VariableDeclaration): Object {
    return {
      type: 'VariableDeclaration',
      kind: 'var',
      declarations: [{
        type: 'VariableDeclarator',
        id: this.visitIdentifier(node.id),
        init: node.value !== null ? node.value.acceptExpressionVisitor(this) : this.defaultForType(node.symbol.type)
      }]
    };
  }

  visitSymbolExpression(node: SymbolExpression): Object {
    var result: Object = {
      type: 'Identifier',
      name: node.name
    };

    // Insert "this." before struct members
    if (node.symbol.enclosingStruct !== null) {
      return {
        type: 'MemberExpression',
        object: {
          type: 'ThisExpression'
        },
        property: result
      };
    }

    return result;
  }

  static INTEGER_OPS : { [op: string]: boolean } = {
    '~': true,
    '|': true,
    '&': true,
    '^': true,
    '<<': true,
    '>>': true,
  };

  visitUnaryExpression(node: UnaryExpression): Object {
    var result: Object = {
      type: 'UnaryExpression',
      operator: node.op,
      argument: node.value.acceptExpressionVisitor(this),
      prefix: true
    };

    // Cast the result to an integer if needed (- -2147483648 is still -2147483648)
    if (!OutputJS.INTEGER_OPS[node.op] && node.computedType.innerType === SpecialType.INT) {
      result = {
        type: 'BinaryExpression',
        operator: '|',
        left: result,
        right: {
          type: 'Literal',
          value: 0
        }
      };
    }

    return result;
  }

  visitBinaryExpression(node: BinaryExpression): Object {
    // Special-case integer multiplication
    if (node.op === '*' && node.computedType.innerType === SpecialType.INT) {
      this.needMultiplicationPolyfill = true;
      return {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'Math' },
          property: { type: 'Identifier', name: 'imul' }
        },
        'arguments': [
          node.left.acceptExpressionVisitor(this),
          node.right.acceptExpressionVisitor(this)
        ]
      };
    }

    var result: Object = {
      type:
        node.op === '=' ? 'AssignmentExpression' :
        node.op === '&&' || node.op === '||' ? 'LogicalExpression' :
        'BinaryExpression',
      operator: node.op,
      left: node.left.acceptExpressionVisitor(this),
      right: node.right.acceptExpressionVisitor(this)
    };

    // Cast the result to an integer if needed (1073741824 + 1073741824 is -2147483648)
    if (!OutputJS.INTEGER_OPS[node.op] && node.computedType.innerType === SpecialType.INT) {
      result = {
        type: 'BinaryExpression',
        operator: '|',
        left: result,
        right: {
          type: 'Literal',
          value: 0
        }
      };
    }

    return result;
  }

  visitTernaryExpression(node: TernaryExpression): Object {
    return {
      type: 'ConditionalExpression',
      test: node.value.acceptExpressionVisitor(this),
      consequent: node.trueValue.acceptExpressionVisitor(this),
      alternate: node.falseValue.acceptExpressionVisitor(this)
    };
  }

  visitMemberExpression(node: MemberExpression): Object {
    return {
      type: 'MemberExpression',
      object: node.value.acceptExpressionVisitor(this),
      property: this.visitIdentifier(node.id)
    };
  }

  visitIntExpression(node: IntExpression): Object {
    return {
      type: 'Literal',
      value: node.value
    };
  }

  visitBoolExpression(node: BoolExpression): Object {
    return {
      type: 'Literal',
      value: node.value
    };
  }

  visitDoubleExpression(node: DoubleExpression): Object {
    return {
      type: 'Literal',
      value: node.value
    };
  }

  visitNullExpression(node: NullExpression): Object {
    return {
      type: 'Literal',
      value: null
    };
  }

  visitThisExpression(node: ThisExpression): Object {
    return {
      type: 'ThisExpression'
    };
  }

  visitCallExpression(node: CallExpression): Object {
    return {
      type: 'CallExpression',
      callee: node.value.acceptExpressionVisitor(this),
      arguments: node.args.map(n => n.acceptExpressionVisitor(this))
    };
  }

  visitNewExpression(node: NewExpression): Object {
    return {
      type: 'NewExpression',
      callee: node.type.acceptExpressionVisitor(this),
      arguments: node.args.map(n => n.acceptExpressionVisitor(this))
    };
  }

  visitModifierExpression(node: ModifierExpression): Object {
    assert(false);
    return null;
  }
}
