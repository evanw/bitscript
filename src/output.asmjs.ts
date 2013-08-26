// Note: This whole thing was hacked up really fast and is pretty messy. It's
// also currently incomplete and doesn't yet support things you probably want
// like lists, virtual functions, and shared pointers, and freeing memory.
class OutputAsmJS implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
  returnType: WrappedType = null;
  usesIntegerMultiplication: boolean = false;

  static generate(node: Module, moduleName: string): string {
    BinaryLayout.run(node);
    return escodegen.generate(new OutputAsmJS().visitModule(node, moduleName), {
      parse: esprima.parse,
      format: { indent: { style: '  ' } }
    });
  }

  defaultValueForType(type: WrappedType): Object {
    if (type.isDouble()) {
      return {
        type: 'Literal',
        raw: '0.0',
        value: 0
      };
    }
    return {
      type: 'Literal',
      value: 0
    };
  }

  wrapWithTypeAnnotation(result: any, type: WrappedType): any {
    if (type.isDouble()) {
      if (result.type === 'UnaryExpression' && ['+', '-'].indexOf(result.operator) >= 0) {
        return result;
      }
      return {
        type: 'UnaryExpression',
        operator: '+',
        argument: result
      };
    }

    if (type.isInt() || type.isPointer() || type.isBool()) {
      if (result.type === 'BinaryExpression' && ['&', '|', '^', '<<', '>>'].indexOf(result.operator) >= 0) {
        return result;
      }
      return {
        type: 'BinaryExpression',
        operator: '|',
        left: result,
        right: { type: 'Literal', value: 0 }
      };
    }

    // Should never get here
    assert(false);
  }

  mangleSymbolName(symbol: Symbol): string {
    if (symbol.enclosingObject !== null) {
      return symbol.enclosingObject.name + '$' + symbol.name;
    }
    return symbol.name;
  }

  dereferenceMemory(pointer: any, symbol: Symbol): any {
    return {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: symbol.type.isDouble() ? 'F64' : 'I32' },
      property: {
        type: 'BinaryExpression',
        operator: '>>',
        left: {
          type: 'BinaryExpression',
          operator: '+',
          left: pointer,
          right: { type: 'Literal', value: symbol.byteOffset }
        },
        right: { type: 'Literal', value: symbol.type.isDouble() ? 3 : 2 }
      },
      computed: true
    };
  }

  visitModule(node: Module, moduleName: string): Object {
    var body: any[] = [];
    var polyfills: any[] = [];
    var objects: ObjectDeclaration[] = <ObjectDeclaration[]>node.block.statements.filter(n => n instanceof ObjectDeclaration);
    var varibles: VariableDeclaration[] = <VariableDeclaration[]>node.block.statements.filter(n => n instanceof VariableDeclaration);
    var functions: FunctionDeclaration[] = <FunctionDeclaration[]>node.block.statements.filter(n => n instanceof FunctionDeclaration && n.block !== null);
    var functionBodies: any[] =
      functions.map(this.visitFunctionDeclaration, this).concat(
      objects.map(this.generateConstructor, this)).
      concat(flatten(objects.map(this.generateMemberFunctions, this)));

    // Start with the asm.js pragma
    body.push({
      type: 'ExpressionStatement',
      expression: { type: 'Literal', value: 'use asm' }
    });

    // Then emit all imports
    if (this.usesIntegerMultiplication) {
      polyfills = body.concat(esprima.parse([
        'if (!Math.imul) {',
        '  Math.imul = function(a, b) {',
        '    var al = a & 0xFFFF, bl = b & 0xFFFF;',
        '    return al * bl + ((a >>> 16) * bl + al * (b >>> 16) << 16) | 0;',
        '  };',
        '}',
      ].join('\n')).body);
      body = body.concat(esprima.parse([
        'var Math_imul = global.Math.imul;',
      ].join('\n')).body);
    }

    // TODO: Remove the ones we don't need
    body = body.concat(esprima.parse([
      'var I32 = new global.Int32Array(heap);',
      'var F64 = new global.Float64Array(heap);',
      'var SP = foreign.initialStackPointer | 0;',
    ].join('\n')).body);

    // TODO
    body = body.concat(esprima.parse([
      'function malloc(bytes) {',
      '  bytes = bytes | 0;',
      '  SP = SP - bytes | 0;',
      '  return SP | 0;',
      '}',
    ].join('\n')).body);

    // Then emit all functions
    body = body.concat(functionBodies);

    // End with the export list
    body.push({
      type: 'ReturnStatement',
      argument: {
        type: 'ObjectExpression',
        properties: functions.map(n => ({
          type: 'Property',
          key: this.visitIdentifier(n.id),
          value: this.visitIdentifier(n.id)
        }))
      }
    });

    // Wrap the body in an asm.js module
    return {
      type: 'Program',
      body: polyfills.concat({
        type: 'FunctionDeclaration',
        params: [
          { type: 'Identifier', name: 'global' },
          { type: 'Identifier', name: 'foreign' },
          { type: 'Identifier', name: 'heap' }
        ],
        id: { type: 'Identifier', name: moduleName },
        body: {
          type: 'BlockStatement',
          body: body
        }
      })
    };
  }

  visitBlock(node: Block): Object {
    return {
      type: 'BlockStatement',
      body: node.statements
        .filter(n => !(n instanceof VariableDeclaration) || n.value !== null) // Ignore empty variable declarations
        .map(n => n.acceptStatementVisitor(this))
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

  visitForStatement(node: ForStatement): Object {
    return {
      type: 'ForStatement',
      init: node.setup !== null ? node.setup.acceptExpressionVisitor(this) : null,
      test: node.test !== null ? node.test.acceptExpressionVisitor(this) : null,
      update: node.update !== null ? node.update.acceptExpressionVisitor(this) : null,
      body: this.visitBlock(node.block)
    };
  }

  visitReturnStatement(node: ReturnStatement): Object {
    return {
      type: 'ReturnStatement',
      argument: node.value !== null ? this.wrapWithTypeAnnotation(node.value.acceptExpressionVisitor(this), this.returnType) : null
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

  generateConstructor(node: ObjectDeclaration): Object {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>node.block.statements.filter(n => n instanceof VariableDeclaration);
    var baseVariables: VariableDeclaration[] = this.getBaseVariables(node.base).filter(n => n.value === null);
    var args: VariableDeclaration[] = baseVariables.concat(variables.filter(n => n.value === null));
    var self: Object = { type: 'Identifier', name: 'self' };

    // Create the constructor function
    var result: any = {
      type: 'FunctionDeclaration',
      params: [self].concat(args.map(n => this.visitIdentifier(n.id))),
      id: this.visitIdentifier(node.id),
      body: {
        type: 'BlockStatement',
        body: [].concat(
          // Type annotation for "this"
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'AssignmentExpression',
              operator: '=',
              left: self,
              right: this.wrapWithTypeAnnotation(self, node.symbol.type)
            }
          },

          // Emit argument type annotations
          this.emitTypeAnnotationsForArguments(args),

          // Add a call to the constructor for the base class
          node.base === null ? [] : <any>{
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: node.base.acceptExpressionVisitor(this),
              arguments: [self].concat(baseVariables.map(n => this.visitIdentifier(n.id)))
            }
          },

          // Initialize each variable
          variables.map(n => ({
            type: 'ExpressionStatement',
            expression: {
              type: 'AssignmentExpression',
              operator: '=',
              left: this.dereferenceMemory(self, n.symbol),
              right: this.wrapWithTypeAnnotation(n.value !== null ? n.value.acceptExpressionVisitor(this) : this.visitIdentifier(n.id), n.symbol.type)
            }
          })),

          // Return the "this" pointer
          {
            type: 'ReturnStatement',
            argument: this.wrapWithTypeAnnotation(self, node.symbol.type)
          }
        )
      }
    };

    return result;
  }

  generateMemberFunctions(node: ObjectDeclaration): Object[] {
    return node.block.statements.filter(n => n instanceof FunctionDeclaration && n.block !== null).map(n => {
      var result: any = this.visitFunctionDeclaration(n);
      var self: Object = { type: 'Identifier', name: 'self' };
      result.id.name = this.mangleSymbolName((<FunctionDeclaration>n).symbol);
      result.params.unshift(self);
      result.body.body.unshift({
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: self,
          right: this.wrapWithTypeAnnotation(self, node.symbol.type)
        }
      });
      return result;
    });
  }

  visitObjectDeclaration(node: ObjectDeclaration): Object {
    assert(false);
    return null;
  }

  emitTypeAnnotationsForArguments(args: VariableDeclaration[]): any[] {
    return args.map(n => ({
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: this.visitIdentifier(n.id),
        right: this.wrapWithTypeAnnotation(this.visitIdentifier(n.id), n.symbol.type)
      }
    }));
  }

  visitFunctionDeclaration(node: FunctionDeclaration): Object {
    function searchBlock(node: Block) {
      node.statements.forEach(n => {
        if (n instanceof VariableDeclaration) {
          localSymbols.push((<VariableDeclaration>n).symbol);
        }

        else if (n instanceof IfStatement) {
          searchBlock((<IfStatement>n).thenBlock);
          if ((<IfStatement>n).elseBlock !== null) {
            searchBlock((<IfStatement>n).elseBlock);
          }
        }

        else if (n instanceof WhileStatement) {
          searchBlock((<WhileStatement>n).block);
        }

        else if (n instanceof ForStatement) {
          searchBlock((<ForStatement>n).block);
        }
      });
    }

    assert(node.block !== null);
    this.returnType = node.symbol.type.asFunction().result;

    // Emit type annotations for arguments
    var args: any[] = this.emitTypeAnnotationsForArguments(node.args);

    // Declare all variables now (TODO: prevent duplicate symbols by renaming)
    var localSymbols: Symbol[] = [];
    searchBlock(node.block);
    var locals: any[] = localSymbols.map(symbol => ({
      type: 'VariableDeclaration',
      declarations: [{
        type: 'VariableDeclarator',
        id: { type: 'Identifier', name: symbol.name },
        init: this.defaultValueForType(symbol.type)
      }],
      kind: 'var'
    }));

    var body: any = this.visitBlock(node.block);
    body.body = args.concat(locals, body.body);
    return {
      type: 'FunctionDeclaration',
      params: node.args.map(n => this.visitIdentifier(n.id)),
      id: this.visitIdentifier(node.id),
      body: body
    };
  }

  visitVariableDeclaration(node: VariableDeclaration): Object {
    assert(node.value !== null);
    return {
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: this.visitIdentifier(node.id),
        right: this.wrapWithTypeAnnotation(node.value.acceptExpressionVisitor(this), node.symbol.type)
      }
    };
  }

  visitSymbolExpression(node: SymbolExpression): Object {
    // Access object fields off of "this"
    if (node.symbol.enclosingObject !== null) {
      return this.dereferenceMemory({ type: 'Identifier', name: 'self' }, node.symbol);
    }

    return {
      type: 'Identifier',
      name: node.name
    };
  }

  visitMoveExpression(node: MoveExpression): Object {
    return node.value.acceptExpressionVisitor(this);
  }

  visitUnaryExpression(node: UnaryExpression): Object {
    return this.wrapWithTypeAnnotation({
      type: 'UnaryExpression',
      operator: node.op === '!' ? '~' : node.op,
      argument: this.wrapWithTypeAnnotation(node.value.acceptExpressionVisitor(this), node.value.computedType),
      prefix: true
    }, node.computedType);
  }

  visitBinaryExpression(node: BinaryExpression): Object {
    var type: WrappedType = TypeLogic.commonImplicitType(node.left.computedType, node.right.computedType);
    var left: any = node.left.acceptExpressionVisitor(this);
    var right: any = node.right.acceptExpressionVisitor(this);

    // Add type annotations. Each value sometimes needs to be wrapped twice.
    // For example, using double + on an int and a double requires the int
    // to first be cast to int, then to double.
    if (node.op !== '=') left = this.wrapWithTypeAnnotation(this.wrapWithTypeAnnotation(left, node.left.computedType), type);
    right = this.wrapWithTypeAnnotation(this.wrapWithTypeAnnotation(right, node.right.computedType), type);

    // Special-case integer multiplication
    if (node.op === '*' && node.computedType.innerType === SpecialType.INT) {
      this.usesIntegerMultiplication = true;
      return this.wrapWithTypeAnnotation({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'Math_imul' },
        arguments: [left, right]
      }, node.computedType);
    }

    var result: any = {
      type: node.op === '=' ? 'AssignmentExpression' : 'BinaryExpression',
      operator: node.op === '&&' || node.op == '||' ? node.op[0] : node.op,
      left: left,
      right: right
    };
    return node.op === '=' ? result : this.wrapWithTypeAnnotation(result, node.computedType);
  }

  visitTernaryExpression(node: TernaryExpression): Object {
    var type: WrappedType = TypeLogic.commonImplicitType(node.trueValue.computedType, node.falseValue.computedType);
    return this.wrapWithTypeAnnotation({
      type: 'ConditionalExpression',
      test: this.wrapWithTypeAnnotation(node.value.acceptExpressionVisitor(this), node.value.computedType),
      consequent: this.wrapWithTypeAnnotation(this.wrapWithTypeAnnotation(node.trueValue.acceptExpressionVisitor(this), node.trueValue.computedType), type),
      alternate: this.wrapWithTypeAnnotation(this.wrapWithTypeAnnotation(node.falseValue.acceptExpressionVisitor(this), node.falseValue.computedType), type)
    }, node.computedType);
  }

  visitMemberExpression(node: MemberExpression): Object {
    return this.dereferenceMemory(
      this.wrapWithTypeAnnotation(node.value.acceptExpressionVisitor(this), node.value.computedType),
      node.symbol);
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
      value: +node.value
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
      value: 0
    };
  }

  visitThisExpression(node: ThisExpression): Object {
    return {
      type: 'Identifier',
      name: 'self'
    };
  }

  visitCallExpression(node: CallExpression): Object {
    var functionType: FunctionType = node.value.computedType.asFunction();
    var args: any[] = node.args.map((n, i) => this.wrapWithTypeAnnotation(n.acceptExpressionVisitor(this), functionType.args[i]));

    // Call member functions directly
    if (node.value instanceof MemberExpression) {
      var value: Expression = (<MemberExpression>node.value).value;
      return {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: this.mangleSymbolName((<MemberExpression>node.value).symbol) },
        arguments: [this.wrapWithTypeAnnotation(value.acceptExpressionVisitor(this), value.computedType)].concat(args)
      };
    }

    return {
      type: 'CallExpression',
      callee: node.value.acceptExpressionVisitor(this),
      arguments: args
    };
  }

  visitNewExpression(node: NewExpression): Object {
    var constructorType: FunctionType = node.computedType.asObject().constructorType();
    return {
      type: 'CallExpression',
      callee: node.type.acceptExpressionVisitor(this),
      arguments: [this.wrapWithTypeAnnotation({
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'malloc' },
        arguments: [{ type: 'Literal', value: node.computedType.asObject().byteSize }]
      }, node.computedType)].concat(node.args.map((n, i) => this.wrapWithTypeAnnotation(n.acceptExpressionVisitor(this), constructorType.args[i])))
    };
  }

  visitTypeModifierExpression(node: TypeModifierExpression): Object {
    assert(false);
    return null;
  }

  visitTypeParameterExpression(node: TypeParameterExpression): Object {
    return node.type.acceptExpressionVisitor(this);
  }
}
