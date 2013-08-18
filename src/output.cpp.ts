declare var cppcodegen: any;

class OutputCPP implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
  needMemoryHeader: boolean = false;
  returnType: WrappedType = null;

  static generate(node: Module): string {
    return cppcodegen.generate(new OutputCPP().visitModule(node), { indent: '  ', nullptr: true }).trim();
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

    assert(type.innerType instanceof ObjectType);
    var result: Object = {
      kind: 'Identifier',
      name: (<ObjectType>type.innerType).name
    };

    if (type.isRawPointer()) {
      return {
        kind: 'PointerType',
        inner: result
      };
    }

    if (type.isOwned()) {
      this.needMemoryHeader = true;
      return {
        kind: 'SpecializeTemplate',
        template: {
          kind: 'MemberType',
          inner: { kind: 'Identifier', name: 'std' },
          member: { kind: 'Identifier', name: 'unique_ptr' }
        },
        parameters: [result]
      };
    }

    if (type.isShared()) {
      this.needMemoryHeader = true;
      return {
        kind: 'SpecializeTemplate',
        template: {
          kind: 'MemberType',
          inner: { kind: 'Identifier', name: 'std' },
          member: { kind: 'Identifier', name: 'shared_ptr' }
        },
        parameters: [result]
      };
    }

    return result;
  }

  forwardDeclareObjectType(node: ObjectDeclaration): Object {
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

  needsVirtualDestructor(node: ObjectDeclaration): boolean {
    var type: ObjectType = node.symbol.type.asObject();
    return type.baseType === null && type.hasDerivedTypes;
  }

  declareObjectType(node: ObjectDeclaration): Object {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>
      node.block.statements.filter(n => n instanceof VariableDeclaration);
    return {
      kind: 'ObjectDeclaration',
      type: {
        kind: 'ObjectType',
        keyword: 'struct',
        id: this.visitIdentifier(node.id),
        bases: node.base === null ? [] : [node.base.acceptExpressionVisitor(this)],
        body: {
          kind: 'BlockStatement',
          body: this.createVariables(variables).map(n => <Object>{
            kind: 'VariableDeclaration',
            qualifiers: [],
            variables: [n]
          }).concat(this.generateFunctionsForObjectType(node).map(n => {
            n.id = n.id.member;
            n.body = n.initializations = null;
            return n;
          }), !this.needsVirtualDestructor(node) ? [] : [
            this.generateEmptyVirtualDestructor(node)
          ])
        }
      }
    };
  }

  getBaseVariables(node: Expression): VariableDeclaration[] {
    if (node instanceof SymbolExpression) {
      var base: ObjectDeclaration = <ObjectDeclaration>(<SymbolExpression>node).symbol.node;
      return this.getBaseVariables(base.base).concat(base.block.statements.filter(n => n instanceof VariableDeclaration));
    }
    return [];
  }

  generateConstructor(node: ObjectDeclaration): Object {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>
      node.block.statements.filter(n => n instanceof VariableDeclaration);
    var baseVariables: VariableDeclaration[] = this.getBaseVariables(node.base);

    // Initialize member variables using an initialization list
    var initializations: Object[] = variables.map(n => ({
      kind: 'CallExpression',
      callee: this.visitIdentifier(n.id),
      'arguments': [n.value !== null ? this.insertImplicitConversion(n.value, n.symbol.type) : this.visitIdentifier(n.id)]
    }));

    // Call the inherited constructor
    if (node.base !== null) {
      initializations.unshift({
        kind: 'CallExpression',
        callee: node.base.acceptExpressionVisitor(this),
        'arguments': baseVariables.map(n => this.visitIdentifier(n.id))
      });
    }

    // Create the constructor function
    return {
      kind: 'FunctionDeclaration',
      qualifiers: [],
      type: {
        kind: 'FunctionType',
        'arguments': this.createVariables(baseVariables.concat(variables.filter(n => n.value === null)))
      },
      id: {
        kind: 'MemberType',
        inner: this.visitIdentifier(node.id),
        member: this.visitIdentifier(node.id)
      },
      initializations: initializations,
      body: {
        kind: 'BlockStatement',
        body: []
      }
    };
  }

  generateEmptyVirtualDestructor(node: ObjectDeclaration): Object {
    return {
      kind: 'FunctionDeclaration',
      type: {
        kind: 'FunctionType',
        'arguments': []
      },
      id: { kind: 'Identifier', name: '~' + node.id.name },
      qualifiers: [
        { kind: 'Identifier', name: 'virtual' }
      ],
      body: {
        kind: 'BlockStatement',
        body: []
      }
    };
  }

  generateMemberFunctions(node: ObjectDeclaration): Object[] {
    var functions: FunctionDeclaration[] = <FunctionDeclaration[]>
      node.block.statements.filter(n => n instanceof FunctionDeclaration);
    return functions.map(n => {
      var result: any = this.visitFunctionDeclaration(n);
      result.id = {
        kind: 'MemberType',
        inner: this.visitIdentifier(node.id),
        member: result.id
      };
      return result;
    });
  }

  generateFunctionsForObjectType(node: ObjectDeclaration): any[] {
    return [this.generateConstructor(node)].concat(this.generateMemberFunctions(node));
  }

  insertImplicitConversion(from: Expression, to: WrappedType): Object {
    if (from.computedType.isOwned() && to.isOwned() && from.computedType.isStorage()) {
      return {
        kind: 'CallExpression',
        callee: {
          kind: 'MemberType',
          inner: { kind: 'Identifier', name: 'std' },
          member: { kind: 'Identifier', name: 'move' }
        },
        arguments: [from.acceptExpressionVisitor(this)]
      };
    }

    if (from.computedType.isOwned() && to.isShared()) {
      if (from instanceof NewExpression) {
        var node: NewExpression = <NewExpression>from;
        var functionType: FunctionType = node.type.computedType.asObject().constructorType;
        this.needMemoryHeader = true;
        return {
          kind: 'CallExpression',
          callee: {
            kind: 'SpecializeTemplate',
            template: {
              kind: 'MemberType',
              inner: { kind: 'Identifier', name: 'std' },
              member: { kind: 'Identifier', name: 'make_shared' }
            },
            parameters: [{ kind: 'Identifier', name: to.asObject().name }]
          },
          arguments: node.args.map((n, i) => this.insertImplicitConversion(n, functionType.args[i]))
        };
      }
      return {
        kind: 'CallExpression',
        callee: this.visitType(to),
        arguments: [from.acceptExpressionVisitor(this)]
      };
    }

    if ((from.computedType.isOwned() || from.computedType.isShared()) && to.isRawPointer()) {
      return {
        kind: 'CallExpression',
        callee: {
          kind: 'MemberExpression',
          operator: '.',
          object: from.acceptExpressionVisitor(this),
          member: { kind: 'Identifier', name: 'get' }
        },
        arguments: []
      };
    }

    return from.acceptExpressionVisitor(this);
  }

  declareFunction(node: FunctionDeclaration): Object {
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
      body: null
    };
  }

  visitModule(node: Module): Object {
    var objects: ObjectDeclaration[] = node.sortedObjectDeclarations();
    var result: any = {
      kind: 'Program',
      body: flatten([
        objects.map(n => this.forwardDeclareObjectType(n)),
        objects.map(n => this.declareObjectType(n)),
        node.block.statements.filter(n => n instanceof VariableDeclaration).map(n => n.acceptStatementVisitor(this)),
        node.block.statements.filter(n => n instanceof FunctionDeclaration).map(n => this.declareFunction(n)),
        flatten(objects.map(n => this.generateFunctionsForObjectType(n))),
        node.block.statements.filter(n => n instanceof FunctionDeclaration).map(n => n.acceptStatementVisitor(this)),
      ])
    };

    // Include headers as needed
    if (this.needMemoryHeader) {
      result.body.unshift({
        kind: 'IncludeStatement',
        text: '<memory>'
      });
    }

    return result;
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
      argument: node.value !== null ? this.insertImplicitConversion(node.value, this.returnType) : null
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

  visitObjectDeclaration(node: ObjectDeclaration): Object {
    assert(false);
    return null;
  }

  visitFunctionDeclaration(node: FunctionDeclaration): Object {
    this.returnType = node.symbol.type.asFunction().result;
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
        init: node.value !== null ? this.insertImplicitConversion(node.value, node.symbol.type) : null
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
      right: node.op === '=' ? this.insertImplicitConversion(node.right, node.left.computedType) : node.right.acceptExpressionVisitor(this)
    };
  }

  visitTernaryExpression(node: TernaryExpression): Object {
    return {
      kind: 'ConditionalExpression',
      test: node.value.acceptExpressionVisitor(this),
      consequent: node.trueValue.acceptExpressionVisitor(this), // TODO: May need insertImplicitConversion
      alternate: node.falseValue.acceptExpressionVisitor(this) // TODO: May need insertImplicitConversion
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

  visitThisExpression(node: ThisExpression): Object {
    return {
      kind: 'ThisExpression'
    };
  }

  visitCallExpression(node: CallExpression): Object {
    var functionType: FunctionType = node.value.computedType.asFunction();
    return {
      kind: 'CallExpression',
      callee: node.value.acceptExpressionVisitor(this),
      arguments: node.args.map((n, i) => this.insertImplicitConversion(n, functionType.args[i]))
    };
  }

  visitNewExpression(node: NewExpression): Object {
    var functionType: FunctionType = node.type.computedType.asObject().constructorType;
    this.needMemoryHeader = true;
    return {
      kind: 'CallExpression',
      callee: {
        kind: 'SpecializeTemplate',
        template: {
          kind: 'MemberType',
          inner: { kind: 'Identifier', name: 'std' },
          member: { kind: 'Identifier', name: 'unique_ptr' }
        },
        parameters: [node.type.acceptExpressionVisitor(this)]
      },
      arguments: [{
        kind: 'NewExpression',
        callee: node.type.acceptExpressionVisitor(this),
        arguments: node.args.map((n, i) => this.insertImplicitConversion(n, functionType.args[i]))
      }]
    };
  }

  visitModifierExpression(node: ModifierExpression): Object {
    assert(false);
    return null;
  }
}
