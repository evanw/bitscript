declare var esprima: any;
declare var escodegen: any;

class OutputJS implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
  needExtendsPolyfill: boolean = false;
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
        flatten(node.sortedObjectDeclarations().map(n => this.generateObjectDeclaration(n))),
        node.block.statements.filter(n => n instanceof VariableDeclaration).map(n => n.acceptStatementVisitor(this)),
        node.block.statements.filter(n => n instanceof FunctionDeclaration).map(n => n.acceptStatementVisitor(this)),
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

    if (this.needExtendsPolyfill) {
      result.body.unshift(esprima.parse([
        'function __extends(d, b) {',
        '  function c() {}',
        '  c.prototype = b.prototype;',
        '  d.prototype = new c();',
        '  d.prototype.constructor = d;',
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
    var elseBlock: any = node.elseBlock !== null ? this.visitBlock(node.elseBlock) : null;
    return {
      type: 'IfStatement',
      test: node.test.acceptExpressionVisitor(this),
      consequent: this.visitBlock(node.thenBlock),
      alternate: elseBlock !== null && elseBlock.body.length === 1 && elseBlock.body[0].type === 'IfStatement' ? elseBlock.body[0] : elseBlock
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

  getBaseVariables(node: Expression): VariableDeclaration[] {
    if (node instanceof SymbolExpression) {
      var base: ObjectDeclaration = <ObjectDeclaration>(<SymbolExpression>node).symbol.node;
      return this.getBaseVariables(base.base).concat(base.block.statements.filter(n => n instanceof VariableDeclaration));
    }
    return [];
  }

  generateConstructor(node: ObjectDeclaration): Object[] {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>node.block.statements.filter(n => n instanceof VariableDeclaration);
    var baseVariables: VariableDeclaration[] = this.getBaseVariables(node.base).filter(n => n.value === null);

    // Create the constructor function
    var result: any[] = [{
      type: 'FunctionDeclaration',
      params: baseVariables.concat(variables.filter(n => n.value === null)).map(n => { return this.visitIdentifier(n.id); }),
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
    }];

    // Inherit from the base class
    if (node.base !== null) {
      // Add a call to the constructor for the base class
      result[0].body.body.unshift({
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: node.base.acceptExpressionVisitor(this),
            property: { type: 'Identifier', name: 'call' }
          },
          arguments: [{ type: 'ThisExpression' }].concat(baseVariables.map(n => this.visitIdentifier(n.id)))
        }
      });

      // Add a call to __extends()
      this.needExtendsPolyfill = true;
      result.push({
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: { type: 'Identifier', name: '__extends' },
          arguments: [
            this.visitIdentifier(node.id),
            node.base.acceptExpressionVisitor(this)
          ]
        }
      });
    }

    return result;
  }

  generateMemberFunctions(node: ObjectDeclaration): Object[] {
    return node.block.statements.filter(n => n instanceof FunctionDeclaration && n.block !== null).map(n => {
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

  generateObjectDeclaration(node: ObjectDeclaration): Object[] {
    return this.generateConstructor(node).concat(this.generateMemberFunctions(node));
  }

  visitObjectDeclaration(node: ObjectDeclaration): Object {
    assert(false);
    return null;
  }

  visitFunctionDeclaration(node: FunctionDeclaration): Object {
    return {
      type: 'FunctionDeclaration',
      params: node.args.map(n => this.visitIdentifier(n.id)),
      id: this.visitIdentifier(node.id),
      body: node.block !== null ? this.visitBlock(node.block) : { type: 'BlockStatement', body: [] }
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
    if (node.symbol.enclosingObject !== null) {
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

  wrapIntegerOperator(result: any): any {
    // Don't need to emit anything for unary operators on literals
    // (otherwise all negative values will have "| 0" next to them)
    if (result.type === 'UnaryExpression' && result.argument.type === 'Literal') {
      return result;
    }

    return {
      type: 'BinaryExpression',
      operator: '|',
      left: result,
      right: {
        type: 'Literal',
        value: 0
      }
    };
  }

  visitUnaryExpression(node: UnaryExpression): Object {
    var result: Object = {
      type: 'UnaryExpression',
      operator: node.op,
      argument: node.value.acceptExpressionVisitor(this),
      prefix: true
    };

    // Cast the result to an integer if needed (- -2147483648 is still -2147483648)
    if (!OutputJS.INTEGER_OPS[node.op] && node.computedType.innerType === SpecialType.INT) {
      result = this.wrapIntegerOperator(result);
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
      result = this.wrapIntegerOperator(result);
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
    if (node.value.computedType.innerType === NativeTypes.MATH) {
      switch (node.id.name) {
        case 'NAN':
          return {
            type: 'Identifier',
            name: 'NaN'
          };

        case 'INFINITY':
          return {
            type: 'Identifier',
            name: 'Infinity'
          };
      }
    }

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

  visitTypeModifierExpression(node: TypeModifierExpression): Object {
    assert(false);
    return null;
  }

  visitTypeParameterExpression(node: TypeParameterExpression): Object {
    assert(false);
    return null;
  }
}
