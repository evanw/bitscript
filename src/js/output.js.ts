class OutputJS implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
  needExtendsPolyfill: boolean = false;
  needMultiplicationPolyfill: boolean = false;
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
      // Source map support in escodegen is pretty bad. Every single object
      // that escodegen touches must have a valid location or it puts NaNs in
      // the map. This unfortunately means that the source map is way too
      // fine-grained and doesn't accurately represent the source code in
      // many places. Oh well, it's quick and dirty and better than nothing.
      // It still seems to generate a few NaNs in between functions :(
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

  insertCopyConstructorCall(node: Expression, result: Object, type: WrappedType): Object {
    if (type.innerType === NativeTypes.LIST) {
      assert(type.substitutions.length === 1 && type.substitutions[0].parameter === NativeTypes.LIST_T);

      if (type.substitutions[0].type.isPrimitive()) {
        return this.wrap(node, {
          type: 'CallExpression',
          callee: this.wrap(node, {
            type: 'MemberExpression',
            object: result,
            property: { type: 'Identifier', name: 'slice' }
          }),
          arguments: []
        });
      }

      return this.wrap(node, {
        type: 'CallExpression',
        callee: this.wrap(node, {
          type: 'MemberExpression',
          object: result,
          property: { type: 'Identifier', name: 'map' }
        }),
        arguments: [this.wrap(node, {
          type: 'FunctionExpression',
          params: [{ type: 'Identifier', name: 'x' }],
          body: this.wrap(node, {
            type: 'BlockStatement',
            body: [{
              type: 'ReturnStatement',
              argument: this.insertCopyConstructorCall(node, { type: 'Identifier', name: 'x' }, type.substitutions[0].type)
            }]
          })
        })]
      });
    }

    return this.wrap(node, {
      type: 'NewExpression',
      callee: OutputJS.mangledCopyConstructorIdentifier(type.asObject()),
      arguments: [result]
    });
  }

  insertImplicitConversion(from: Expression, to: WrappedType): Object {
    if (to.isObject() && to.isValue()) {
      return this.insertCopyConstructorCall(from, from.acceptExpressionVisitor(this), to);
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

    if (this.needMultiplicationPolyfill) {
      result.body = esprima.parse([
        'if (!Math.imul) {',
        '  Math.imul = function(a, b) {',
        '    var al = a & 0xFFFF, bl = b & 0xFFFF;',
        '    return al * bl + ((a >>> 16) * bl + al * (b >>> 16) << 16) | 0;',
        '  };',
        '}',
      ].join('\n')).body.concat(result.body);
    }

    if (this.needExtendsPolyfill) {
      result.body = esprima.parse([
        'function __extends(d, b) {',
        '  function c() {}',
        '  c.prototype = b.prototype;',
        '  d.prototype = new c();',
        '  d.prototype.constructor = d;',
        '}',
      ].join('\n')).body.concat(result.body);
    }

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
      params: baseVariables.concat(variables.filter(n => n.value === null)).map(n => this.visitIdentifier(n.id)),
      id: this.visitIdentifier(node.id),
      body: this.wrap(node, {
        type: 'BlockStatement',
        body: variables.map(n => this.wrap(node, {
          type: 'ExpressionStatement',
          expression: this.wrap(node, {
            type: 'AssignmentExpression',
            operator: '=',
            left: this.wrap(node, {
              type: 'MemberExpression',
              object: this.wrap(node, {
                type: 'ThisExpression'
              }),
              property: this.visitIdentifier(n.id)
            }),
            right: n.value !== null ? n.value.acceptExpressionVisitor(this) : this.visitIdentifier(n.id)
          })
        }))
      })
    })];

    // Inherit from the base class
    if (node.base !== null) {
      // Add a call to the constructor for the base class
      result[0].body.body.unshift(this.wrap(node, {
        type: 'ExpressionStatement',
        expression: this.wrap(node, {
          type: 'CallExpression',
          callee: this.wrap(node, {
            type: 'MemberExpression',
            object: node.base.acceptExpressionVisitor(this),
            property: this.wrap(node, { type: 'Identifier', name: 'call' })
          }),
          arguments: [this.wrap(node, { type: 'ThisExpression' })].concat(baseVariables.map(n => this.visitIdentifier(n.id)))
        })
      }));

      // Add a call to __extends()
      this.needExtendsPolyfill = true;
      result.push(this.wrap(node, {
        type: 'ExpressionStatement',
        expression: this.wrap(node, {
          type: 'CallExpression',
          callee: this.wrap(node, { type: 'Identifier', name: '__extends' }),
          arguments: [
            this.visitIdentifier(node.id),
            node.base.acceptExpressionVisitor(this)
          ]
        })
      }));
    }

    return result;
  }

  generateCopyConstructor(node: ObjectDeclaration): Object[] {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>node.block.statements.filter(n => n instanceof VariableDeclaration);
    var mangledName: Object = this.wrap(node.id, OutputJS.mangledCopyConstructorIdentifier(node.symbol.type.asObject()));
    var $this: Object = this.wrap(node, { type: 'Identifier', name: '$this' });

    // Create the constructor function
    var result: any[] = [this.wrap(node, {
      type: 'FunctionDeclaration',
      params: [$this],
      id: mangledName,
      body: this.wrap(node, {
        type: 'BlockStatement',
        body: variables.map(n => this.wrap(node, {
          type: 'ExpressionStatement',
          expression: this.wrap(node, {
            type: 'AssignmentExpression',
            operator: '=',
            left: this.wrap(node, {
              type: 'MemberExpression',
              object: this.wrap(node, {
                type: 'ThisExpression'
              }),
              property: this.visitIdentifier(n.id)
            }),
            right: this.wrap(node, {
              type: 'MemberExpression',
              object: $this,
              property: this.visitIdentifier(n.id)
            })
          })
        }))
      })
    })];

    // Inherit from the base class
    if (node.base !== null) {
      // Add a call to the constructor for the base class
      result[0].body.body.unshift(this.wrap(node, {
        type: 'ExpressionStatement',
        expression: this.wrap(node, {
          type: 'CallExpression',
          callee: this.wrap(node, {
            type: 'MemberExpression',
            object: this.wrap(node.base, OutputJS.mangledCopyConstructorIdentifier(node.base.computedType.asObject())),
            property: this.wrap(node, { type: 'Identifier', name: 'call' })
          }),
          arguments: [this.wrap(node, { type: 'ThisExpression' })].concat($this)
        })
      }));
    }

    // The copy constructor should share the class prototype
    var prototype: Object = this.wrap(node, { type: 'Identifier', name: 'prototype' });
    result.push(this.wrap(node, {
      type: 'ExpressionStatement',
      expression: this.wrap(node, {
        type: 'AssignmentExpression',
        operator: '=',
        left: this.wrap(node, {
          type: 'MemberExpression',
          object: mangledName,
          property: prototype
        }),
        right: this.wrap(node, {
          type: 'MemberExpression',
          object: this.visitIdentifier(node.id),
          property: prototype
        })
      })
    }));

    return result;
  }

  generateMemberFunctions(node: ObjectDeclaration): Object[] {
    return node.block.statements.filter(n => n instanceof FunctionDeclaration && n.block !== null).map(n => {
      var result: any = this.visitFunctionDeclaration(n);
      result.type = 'FunctionExpression';
      result.id = null;
      return this.wrap(n, {
        type: 'ExpressionStatement',
        expression: this.wrap(n, {
          type: 'AssignmentExpression',
          operator: '=',
          left: this.wrap(n, {
            type: 'MemberExpression',
            object: this.wrap(n, {
              type: 'MemberExpression',
              object: this.visitIdentifier(node.id),
              property: this.wrap(n, { type: 'Identifier', name: 'prototype' })
            }),
            property: this.visitIdentifier(n.id)
          }),
          right: result
        })
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
      params: node.args.map(n => this.visitIdentifier(n.id)),
      id: this.visitIdentifier(node.id),
      body: this.visitBlock(node.block)
    });
  }

  visitVariableDeclaration(node: VariableDeclaration): Object {
    return this.wrap(node, {
      type: 'VariableDeclaration',
      kind: 'var',
      declarations: [this.wrap(node, {
        type: 'VariableDeclarator',
        id: this.visitIdentifier(node.id),
        init: node.value !== null ? node.value.acceptExpressionVisitor(this) : this.defaultForType(node.symbol.type)
      })]
    });
  }

  visitSymbolExpression(node: SymbolExpression): Object {
    var result: Object = this.wrap(node, {
      type: 'Identifier',
      name: node.name
    });

    // Insert "this." before object fields
    if (node.symbol.enclosingObject !== null) {
      return this.wrap(node, {
        type: 'MemberExpression',
        object: this.wrap(node, {
          type: 'ThisExpression'
        }),
        property: result
      });
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
      right: this.wrap(node, {
        type: 'Literal',
        value: 0
      })
    });
  }

  visitMoveExpression(node: MoveExpression): Object {
    return node.value.acceptExpressionVisitor(this);
  }

  visitUnaryExpression(node: UnaryExpression): Object {
    var result: Object = this.wrap(node, {
      type: 'UnaryExpression',
      operator: node.op,
      argument: node.value.acceptExpressionVisitor(this),
      prefix: true
    });

    // Cast the result to an integer if needed (- -2147483648 is still -2147483648)
    if (!OutputJS.INTEGER_OPS[node.op] && node.computedType.innerType === SpecialType.INT) {
      result = this.wrapIntegerOperator(node, result);
    }

    return result;
  }

  visitBinaryExpression(node: BinaryExpression): Object {
    // Special-case integer multiplication
    if (node.op === '*' && node.computedType.innerType === SpecialType.INT) {
      this.needMultiplicationPolyfill = true;
      return this.wrap(node, {
        type: 'CallExpression',
        callee: this.wrap(node, {
          type: 'MemberExpression',
          object: this.wrap(node, { type: 'Identifier', name: 'Math' }),
          property: this.wrap(node, { type: 'Identifier', name: 'imul' })
        }),
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
        if (node.right instanceof NewExpression) {
          return this.wrap(node, {
            type: 'CallExpression',
            callee: this.wrap(node, {
              type: 'MemberExpression',
              object: { type: 'Identifier', name: to.asObject().name },
              property: { type: 'Identifier', name: 'call' }
            }),
            arguments: [node.left.acceptExpressionVisitor(this)].concat((<NewExpression>node.right).args.map(n => n.acceptExpressionVisitor(this)))
          });
        }

        return this.wrap(node, {
          type: 'CallExpression',
          callee: this.wrap(node, {
            type: 'MemberExpression',
            object: OutputJS.mangledCopyConstructorIdentifier(to.asObject()),
            property: { type: 'Identifier', name: 'call' }
          }),
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

    return result;
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
          return {
            type: 'BinaryExpression',
            operator: '|',
            left: node.args[0].acceptExpressionVisitor(this),
            right: { type: 'Literal', value: 0 }
          };
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
            left: this.wrap(node, {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: node.args[0].acceptExpressionVisitor(this),
              computed: true
            }),
            right: node.args[1].acceptExpressionVisitor(this)
          });

        case NativeTypes.LIST_PUSH:
          assert(node.args.length === 1);
          return this.wrap(node, {
            type: 'CallExpression',
            callee: this.wrap(node, {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: this.wrap(node, { type: 'Identifier', name: 'push' })
            }),
            arguments: [node.args[0].acceptExpressionVisitor(this)]
          });

        case NativeTypes.LIST_POP:
          assert(node.args.length === 0);
          return this.wrap(node, {
            type: 'CallExpression',
            callee: this.wrap(node, {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: this.wrap(node, { type: 'Identifier', name: 'pop' })
            }),
            arguments: []
          });

        case NativeTypes.LIST_UNSHIFT:
          assert(node.args.length === 1);
          return this.wrap(node, {
            type: 'CallExpression',
            callee: this.wrap(node, {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: this.wrap(node, { type: 'Identifier', name: 'unshift' })
            }),
            arguments: [node.args[0].acceptExpressionVisitor(this)]
          });

        case NativeTypes.LIST_SHIFT:
          assert(node.args.length === 0);
          return this.wrap(node, {
            type: 'CallExpression',
            callee: this.wrap(node, {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: this.wrap(node, { type: 'Identifier', name: 'shift' })
            }),
            arguments: []
          });

        case NativeTypes.LIST_INDEX_OF:
          assert(node.args.length === 1);
          return this.wrap(node, {
            type: 'CallExpression',
            callee: this.wrap(node, {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: this.wrap(node, { type: 'Identifier', name: 'indexOf' })
            }),
            arguments: [node.args[0].acceptExpressionVisitor(this)]
          });

        case NativeTypes.LIST_INSERT:
          assert(node.args.length === 2);
          return this.wrap(node, {
            type: 'CallExpression',
            callee: this.wrap(node, {
              type: 'MemberExpression',
              object: member.value.acceptExpressionVisitor(this),
              property: this.wrap(node, { type: 'Identifier', name: 'splice' })
            }),
            arguments: [
              node.args[0].acceptExpressionVisitor(this),
              this.wrap(node, { type: 'Literal', value: 0 }),
              node.args[1].acceptExpressionVisitor(this)
            ]
          });

        case NativeTypes.LIST_REMOVE:
          assert(node.args.length === 1);
          return this.wrap(node, {
            type: 'MemberExpression',
            object: this.wrap(node, {
              type: 'CallExpression',
              callee: this.wrap(node, {
                type: 'MemberExpression',
                object: member.value.acceptExpressionVisitor(this),
                property: this.wrap(node, { type: 'Identifier', name: 'splice' })
              }),
              arguments: [
                node.args[0].acceptExpressionVisitor(this),
                this.wrap(node, { type: 'Literal', value: 1 })
              ]
            }),
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
