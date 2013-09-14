class OutputJS implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
  library: LibraryDataJS = new LibraryDataJS();
  returnType: WrappedType = null;

  constructor(
    public wrap: (node: AST, result: any) => any) {
  }

  static generate(node: Module): string {
    return escodegen.generate(new OutputJS((node, result) => result).visitModule(node), {
      format: { indent: { style: '  ' } }
    });
  }

  static generateWithSourceMap(node: Module, root: string): { code: string; map: string } {
    return escodegen.generate(new OutputJS((node, result) => {
      if (node.range !== null) {
        var start = node.range.start;
        var end = node.range.end;
        result.loc = {
          source: node.range.source.name,
          start: {
            line: start.line,
            column: start.column - 1
          },
          end: {
            line: end.line,
            column: end.column - 1
          }
        };
      }
      return result;
    }).visitModule(node), {
      sourceMap: true,
      sourceMapRoot: root,
      sourceMapWithCode: true,
      format: { indent: { style: '  ' } }
    });
  }

  defaultForType(type: WrappedType): Object {
    if (type.isObject() && type.isValue()) {
      if (type.innerType === NativeTypes.LIST) {
        return {
          type: 'ArrayExpression',
          elements: []
        };
      }
      return {
        type: 'NewExpression',
        callee: { type: 'Identifier', name: type.asObject().name },
        arguments: []
      };
    }

    var t: Type = type.innerType;
    return {
      type: 'Literal',
      value:
        t === SpecialType.INT || t === SpecialType.DOUBLE ? <any>0 :
        t === SpecialType.BOOL ? <any>false :
        <any>null
    };
  }

  static mangledCopyConstructorIdentifier(objectType: ObjectType): Object {
    return { type: 'Identifier', name: objectType.name + '$copy' };
  }

  insertCopyConstructorCall(result: any, type: WrappedType): Object {
    if (type.innerType === NativeTypes.LIST) {
      assert(type.substitutions.length === 1 && type.substitutions[0].parameter === NativeTypes.LIST_T);

      if (type.substitutions[0].type.isPrimitive()) {
        return {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: result,
            property: { type: 'Identifier', name: 'slice' }
          },
          arguments: []
        };
      }

      return {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: result,
          property: { type: 'Identifier', name: 'map' }
        },
        arguments: [{
          type: 'FunctionExpression',
          params: [{ type: 'Identifier', name: 'x' }],
          body: {
            type: 'BlockStatement',
            body: [{
              type: 'ReturnStatement',
              argument: this.insertCopyConstructorCall({ type: 'Identifier', name: 'x' }, type.substitutions[0].type)
            }]
          }
        }]
      };
    }

    return result.type === 'NewExpression' ? result : {
      type: 'NewExpression',
      callee: OutputJS.mangledCopyConstructorIdentifier(type.asObject()),
      arguments: [result]
    };
  }

  insertImplicitConversion(from: Expression, to: WrappedType): Object {
    if (to.isObject() && to.isValue()) {
      return this.insertCopyConstructorCall(from.acceptExpressionVisitor(this), to);
    }

    return from.acceptExpressionVisitor(this);
  }

  visitModule(node: Module): Object {
    var result: any = {
      type: 'Program',
      body: flatten([
        flatten(node.block.sortedObjectDeclarations().map(n => this.generateObjectDeclaration(n))),
        node.block.variableDeclarations().map(n => n.acceptStatementVisitor(this)),
        node.block.functionDeclarationsWithBlocks().map(n => n.acceptStatementVisitor(this)),
      ])
    };
    result.body = this.library.generate().concat(result.body);
    return this.wrap(node, result);
  }

  visitBlock(node: Block): Object {
    return this.wrap(node, {
      type: 'BlockStatement',
      body: node.statements.map(n => n.acceptStatementVisitor(this))
    });
  }

  visitIdentifier(node: Identifier): Object {
    return this.wrap(node, {
      type: 'Identifier',
      name: node.name
    });
  }

  visitExpressionStatement(node: ExpressionStatement): Object {
    return this.wrap(node, {
      type: 'ExpressionStatement',
      expression: node.value.acceptExpressionVisitor(this)
    });
  }

  visitIfStatement(node: IfStatement): Object {
    var elseBlock: any = node.elseBlock !== null ? this.visitBlock(node.elseBlock) : null;
    return this.wrap(node, {
      type: 'IfStatement',
      test: this.insertImplicitConversion(node.test, SpecialType.BOOL.wrapValue()),
      consequent: this.visitBlock(node.thenBlock),
      alternate: elseBlock !== null && elseBlock.body.length === 1 && elseBlock.body[0].type === 'IfStatement' ? elseBlock.body[0] : elseBlock
    });
  }

  visitWhileStatement(node: WhileStatement): Object {
    return this.wrap(node, {
      type: 'WhileStatement',
      test: this.insertImplicitConversion(node.test, SpecialType.BOOL.wrapValue()),
      body: this.visitBlock(node.block)
    });
  }

  visitForStatement(node: ForStatement): Object {
    return this.wrap(node, {
      type: 'ForStatement',
      init: node.setup !== null ? node.setup.acceptExpressionVisitor(this) : null,
      test: node.test !== null ? this.insertImplicitConversion(node.test, SpecialType.BOOL.wrapValue()) : null,
      update: node.update !== null ? node.update.acceptExpressionVisitor(this) : null,
      body: this.visitBlock(node.block)
    });
  }

  visitReturnStatement(node: ReturnStatement): Object {
    return this.wrap(node, {
      type: 'ReturnStatement',
      argument: node.value !== null ? this.insertImplicitConversion(node.value, this.returnType) : null
    });
  }

  visitBreakStatement(node: BreakStatement): Object {
    return this.wrap(node, {
      type: 'BreakStatement',
      label: null
    });
  }

  visitContinueStatement(node: ContinueStatement): Object {
    return this.wrap(node, {
      type: 'ContinueStatement',
      label: null
    });
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
    var result: any[] = [this.wrap(node, {
      type: 'FunctionDeclaration',
      params: baseVariables.concat(variables.filter(n => n.value === null)).map(n => ({ type: 'Identifier', name: n.id.name })),
      id: this.visitIdentifier(node.id),
      body: this.wrap(node.block, {
        type: 'BlockStatement',
        body: variables.map(n => this.wrap(n, {
          type: 'ExpressionStatement',
          expression: {
            type: 'AssignmentExpression',
            operator: '=',
            left: {
              type: 'MemberExpression',
              object: { type: 'ThisExpression' },
              property: this.visitIdentifier(n.id)
            },
            right: n.value !== null ? n.value.acceptExpressionVisitor(this) : { type: 'Identifier', name: n.id.name }
          }
        }))
      })
    })];

    // Inherit from the base class
    if (node.base !== null) {
      // Add a call to the constructor for the base class
      result[0].body.body.unshift(this.wrap(node.base, {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: { type: 'Identifier', name: node.base.computedType.asObject().name },
            property: { type: 'Identifier', name: 'call' }
          },
          arguments: [{ type: 'ThisExpression' }].concat(baseVariables.map(n => this.visitIdentifier(n.id)))
        }
      }));

      // Add a call to __extends()
      this.library.need(LibraryJS.EXTENDS);
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

  generateCopyConstructor(node: ObjectDeclaration): Object[] {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>node.block.statements.filter(n => n instanceof VariableDeclaration);
    var $this: Object = { type: 'Identifier', name: '$this' };

    // Create the constructor function
    var result: any[] = [this.wrap(node, {
      type: 'FunctionDeclaration',
      params: [$this],
      id: this.wrap(node.id, OutputJS.mangledCopyConstructorIdentifier(node.symbol.type.asObject())),
      body: this.wrap(node.block, {
        type: 'BlockStatement',
        body: variables.map(n => this.wrap(n, {
          type: 'ExpressionStatement',
          expression: {
            type: 'AssignmentExpression',
            operator: '=',
            left: {
              type: 'MemberExpression',
              object: { type: 'ThisExpression' },
              property: this.visitIdentifier(n.id)
            },
            right: {
              type: 'MemberExpression',
              object: $this,
              property: { type: 'Identifier', name: n.id.name }
            }
          }
        })).concat({
          type: 'ReturnStatement',
          argument: { type: 'ThisExpression' }
        })
      })
    })];

    // Inherit from the base class
    if (node.base !== null) {
      // Add a call to the constructor for the base class
      result[0].body.body.unshift(this.wrap(node.base, {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: OutputJS.mangledCopyConstructorIdentifier(node.base.computedType.asObject()),
            property: { type: 'Identifier', name: 'call' }
          },
          arguments: [<any>{ type: 'ThisExpression' }].concat($this)
        }
      }));
    }

    // The copy constructor should share the class prototype
    var prototype: Object = { type: 'Identifier', name: 'prototype' };
    result.push({
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: {
          type: 'MemberExpression',
          object: OutputJS.mangledCopyConstructorIdentifier(node.symbol.type.asObject()),
          property: prototype
        },
        right: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: node.id.name },
          property: prototype
        }
      }
    });

    return result;
  }

  generateMemberFunctions(node: ObjectDeclaration): Object[] {
    return node.block.statements.filter(n => n instanceof FunctionDeclaration && n.block !== null).map(n => {
      var result: any = this.visitFunctionDeclaration(n);
      result.loc = null;
      result.type = 'FunctionExpression';
      result.id = null;
      return this.wrap(n, {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: {
            type: 'MemberExpression',
            object: {
              type: 'MemberExpression',
              object: { type: 'Identifier', name: node.id.name },
              property: { type: 'Identifier', name: 'prototype' }
            },
            property: this.visitIdentifier(n.id)
          },
          right: result
        }
      });
    });
  }

  generateObjectDeclaration(node: ObjectDeclaration): Object[] {
    return this.generateConstructor(node).concat(this.generateCopyConstructor(node), this.generateMemberFunctions(node));
  }

  visitObjectDeclaration(node: ObjectDeclaration): Object {
    assert(false);
    return null;
  }

  visitFunctionDeclaration(node: FunctionDeclaration): Object {
    this.returnType = node.symbol.type.asFunction().result;
    assert(node.block !== null);
    return this.wrap(node, {
      type: 'FunctionDeclaration',
      params: node.args.map(n => this.wrap(n, this.visitIdentifier(n.id))),
      id: this.visitIdentifier(node.id),
      body: this.visitBlock(node.block)
    });
  }

  visitVariableDeclaration(node: VariableDeclaration): Object {
    return this.wrap(node, {
      type: 'VariableDeclaration',
      kind: 'var',
      declarations: [{
        type: 'VariableDeclarator',
        id: this.visitIdentifier(node.id),
        init: node.value !== null ? node.value.acceptExpressionVisitor(this) : this.defaultForType(node.symbol.type)
      }]
    });
  }

  visitSymbolExpression(node: SymbolExpression): Object {
    var result: Object = {
      type: 'Identifier',
      name: node.name
    };

    // Insert "this." before object fields
    if (node.symbol.enclosingObject !== null) {
      return this.wrap(node, {
        type: 'MemberExpression',
        object: { type: 'ThisExpression' },
        property: result
      });
    }

    return this.wrap(node, result);
  }

  static INTEGER_OPS : { [op: string]: boolean } = {
    '~': true,
    '|': true,
    '&': true,
    '^': true,
    '<<': true,
    '>>': true,

    // This is an integer operator because we force every value to be an integer
    // before we assign it to the symbol, so assignment expressions will always
    // result in an integer
    '=': true,
  };

  wrapIntegerOperator(node: AST, result: any): any {
    // Don't need to emit anything for unary operators on literals
    // (otherwise all negative values will have "| 0" next to them)
    if (result.type === 'UnaryExpression' && result.argument.type === 'Literal') {
      return result;
    }

    return this.wrap(node, {
      type: 'BinaryExpression',
      operator: '|',
      left: result,
      right: {
        type: 'Literal',
        value: 0
      }
    });
  }

  visitMoveExpression(node: MoveExpression): Object {
    return node.value.acceptExpressionVisitor(this);
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
      result = this.wrapIntegerOperator(node, result);
    }

    return this.wrap(node, result);
  }

  visitBinaryExpression(node: BinaryExpression): Object {
    // Special-case integer multiplication
    if (node.op === '*' && node.computedType.innerType === SpecialType.INT) {
      this.library.need(LibraryJS.MATH_IMUL);
      return this.wrap(node, {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'Math' },
          property: { type: 'Identifier', name: 'imul' }
        },
        arguments: [
          node.left.acceptExpressionVisitor(this),
          node.right.acceptExpressionVisitor(this)
        ]
      });
    }

    // Special-case value assignment
    if (node.op === '=') {
      var to: WrappedType = node.left.computedType;
      if (to.isObject() && to.isValue()) {
        if (to.innerType === NativeTypes.LIST) {
          this.library.need(LibraryJS.LIST_ASSIGN);
          return this.wrap(node, {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'List$assign' },
            arguments: [node.left.acceptExpressionVisitor(this)].concat(node.right.acceptExpressionVisitor(this))
          });
        }

        if (node.right instanceof NewExpression) {
          return this.wrap(node, {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: { type: 'Identifier', name: to.asObject().name },
              property: { type: 'Identifier', name: 'call' }
            },
            arguments: [node.left.acceptExpressionVisitor(this)].concat((<NewExpression>node.right).args.map(n => n.acceptExpressionVisitor(this)))
          });
        }

        return this.wrap(node, {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: OutputJS.mangledCopyConstructorIdentifier(to.asObject()),
            property: { type: 'Identifier', name: 'call' }
          },
          arguments: [node.left.acceptExpressionVisitor(this), node.right.acceptExpressionVisitor(this)]
        });
      }
    }

    var result: Object = this.wrap(node, {
      type:
        node.op === '=' ? 'AssignmentExpression' :
        node.op === '&&' || node.op === '||' ? 'LogicalExpression' :
        'BinaryExpression',
      operator: node.op === '==' || node.op === '!=' ? node.op + '=' : node.op,
      left: node.left.acceptExpressionVisitor(this),
      right: node.right.acceptExpressionVisitor(this)
    });

    // Cast the result to an integer if needed (1073741824 + 1073741824 is -2147483648)
    if (!OutputJS.INTEGER_OPS[node.op] && node.computedType.innerType === SpecialType.INT) {
      result = this.wrapIntegerOperator(node, result);
    }

    return this.wrap(node, result);
  }

  visitTernaryExpression(node: TernaryExpression): Object {
    return this.wrap(node, {
      type: 'ConditionalExpression',
      test: this.insertImplicitConversion(node.value, SpecialType.BOOL.wrapValue()),
      consequent: this.insertImplicitConversion(node.trueValue, node.computedType),
      alternate: this.insertImplicitConversion(node.falseValue, node.computedType)
    });
  }

  visitMemberExpression(node: MemberExpression): Object {
    if (node.value.computedType.innerType === NativeTypes.MATH) {
      switch (node.id.name) {
        case 'NAN':
          return this.wrap(node, {
            type: 'Identifier',
            name: 'NaN'
          });

        case 'INFINITY':
          return this.wrap(node, {
            type: 'Identifier',
            name: 'Infinity'
          });
      }
    }

    return this.wrap(node, {
      type: 'MemberExpression',
      object: node.value.acceptExpressionVisitor(this),
      property: this.visitIdentifier(node.id)
    });
  }

  visitIntExpression(node: IntExpression): Object {
    return this.wrap(node, {
      type: 'Literal',
      value: node.value
    });
  }

  visitBoolExpression(node: BoolExpression): Object {
    return this.wrap(node, {
      type: 'Literal',
      value: node.value
    });
  }

  visitDoubleExpression(node: DoubleExpression): Object {
    return this.wrap(node, {
      type: 'Literal',
      value: node.value
    });
  }

  visitNullExpression(node: NullExpression): Object {
    return this.wrap(node, {
      type: 'Literal',
      value: null
    });
  }

  visitThisExpression(node: ThisExpression): Object {
    return this.wrap(node, {
      type: 'ThisExpression'
    });
  }

  visitCallExpression(node: CallExpression): Object {
    if (node.value instanceof MemberExpression) {
      var member: MemberExpression = <MemberExpression>node.value;
      switch (member.value.computedType.innerType) {
      case NativeTypes.MATH:
        if (member.symbol.name === 'trunc') {
          return this.wrap(node, {
            type: 'BinaryExpression',
            operator: '|',
            left: node.args[0].acceptExpressionVisitor(this),
            right: { type: 'Literal', value: 0 }
          });
        }
        break;

      case NativeTypes.LIST:
        switch (member.symbol) {
        case NativeTypes.LIST_GET:
          assert(node.args.length === 1);
          return this.wrap(node, {
            type: 'MemberExpression',
            object: member.value.acceptExpressionVisitor(this),
            property: node.args[0].acceptExpressionVisitor(this),
            computed: true
          });

        case NativeTypes.LIST_SET:
          assert(node.args.length === 2);
          return this.wrap(node, {
            type: 'AssignmentExpression',
            operator: '=',
            left: {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: node.args[0].acceptExpressionVisitor(this),
              computed: true
            },
            right: node.args[1].acceptExpressionVisitor(this)
          });

        case NativeTypes.LIST_PUSH:
        case NativeTypes.LIST_POP:
        case NativeTypes.LIST_UNSHIFT:
        case NativeTypes.LIST_SHIFT:
        case NativeTypes.LIST_INDEX_OF:
          return this.wrap(node, {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: this.visitIdentifier(member.id)
            },
            arguments: node.args.map(n => n.acceptExpressionVisitor(this))
          });

        case NativeTypes.LIST_INSERT:
          assert(node.args.length === 2);
          return this.wrap(node, {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: { type: 'Identifier', name: 'splice' }
            },
            arguments: [
              node.args[0].acceptExpressionVisitor(this),
              { type: 'Literal', value: 0 },
              node.args[1].acceptExpressionVisitor(this)
            ]
          });

        case NativeTypes.LIST_REMOVE:
          assert(node.args.length === 1);
          return this.wrap(node, {
            type: 'MemberExpression',
            object: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: member.value.acceptExpressionVisitor(this),
                property: { type: 'Identifier', name: 'splice' }
              },
              arguments: [
                node.args[0].acceptExpressionVisitor(this),
                { type: 'Literal', value: 1 }
              ]
            },
            property: { type: 'Literal', value: 0 },
            computed: true
          });

        default:
          assert(false);
        }
        break;
      }
    }

    var functionType: FunctionType = node.value.computedType.asFunction();
    return this.wrap(node, {
      type: 'CallExpression',
      callee: node.value.acceptExpressionVisitor(this),
      arguments: node.args.map((n, i) => this.insertImplicitConversion(n, functionType.args[i]))
    });
  }

  visitNewExpression(node: NewExpression): Object {
    if (node.type.computedType.innerType === NativeTypes.LIST) {
      assert(node.args.length === 0);
      return this.wrap(node, {
        type: 'ArrayExpression',
        elements: []
      });
    }

    var functionType: FunctionType = node.type.computedType.asObject().constructorType();
    return this.wrap(node, {
      type: 'NewExpression',
      callee: node.type.acceptExpressionVisitor(this),
      arguments: node.args.map((n, i) => this.insertImplicitConversion(n, functionType.args[i]))
    });
  }

  visitTypeKindExpression(node: TypeKindExpression): Object {
    assert(false);
    return null;
  }

  visitTypeParameterExpression(node: TypeParameterExpression): Object {
    return node.type.acceptExpressionVisitor(this);
  }
}
