class OutputCPP implements StatementVisitor<Object>, DeclarationVisitor<Object>, ExpressionVisitor<Object> {
  library: LibraryDataCPP = new LibraryDataCPP();
  returnType: WrappedType = null;

  static generate(node: Module): string {
    var output: OutputCPP = new OutputCPP();
    return cppcodegen.generate(output.visitModule(node), {
      indent: '  ',
      cpp11: true,
      parenthesizeAndInsideOr: true
    }).trim();
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

    if (type.isValue()) {
      return {
        kind: 'CallExpression',
        callee: this.visitType(type),
        arguments: []
      };
    }

    return {
      kind: 'NullLiteral'
    };
  }

  visitType(type: WrappedType): any {
    switch (type.innerType) {
    case SpecialType.INT: return { kind: 'Identifier', name: 'int' };
    case SpecialType.VOID: return { kind: 'Identifier', name: 'void' };
    case SpecialType.BOOL: return { kind: 'Identifier', name: 'bool' };
    case SpecialType.DOUBLE: return { kind: 'Identifier', name: 'double' };
    }

    assert(type.isObject());
    var objectType: ObjectType = type.asObject();
    var result: Object = {
      kind: 'Identifier',
      name: objectType.name
    };

    if (objectType === NativeTypes.LIST) {
      this.library.need(LibraryCPP.VECTOR_HEADER);
      assert(type.substitutions.length === 1 && type.substitutions[0].parameter === NativeTypes.LIST_T);
      result = {
        kind: 'SpecializeTemplate',
        template: {
          kind: 'MemberType',
          inner: { kind: 'Identifier', name: 'std' },
          member: { kind: 'Identifier', name: 'vector' }
        },
        parameters: [this.visitType(type.substitutions[0].type)]
      };
    }

    if (type.isRef()) {
      return {
        kind: 'PointerType',
        inner: result
      };
    }

    if (type.isOwned()) {
      this.library.need(LibraryCPP.MEMORY_HEADER);
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

  getBaseVariables(node: Expression): VariableDeclaration[] {
    if (node instanceof SymbolExpression) {
      var base: ObjectDeclaration = <ObjectDeclaration>(<SymbolExpression>node).symbol.node;
      return this.getBaseVariables(base.base).concat(base.block.statements.filter(n => n instanceof VariableDeclaration));
    }
    return [];
  }

  createFunctionsForObjectType(node: ObjectDeclaration,
      ctor: (result: any) => void,
      dtor: (result: any) => void,
      memberFunction: (node: FunctionDeclaration, result: any) => void) {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>node.block.statements.filter(n => n instanceof VariableDeclaration);
    var functions: FunctionDeclaration[] = <FunctionDeclaration[]>node.block.statements.filter(n => n instanceof FunctionDeclaration);
    var baseVariables: VariableDeclaration[] = this.getBaseVariables(node.base).filter(n => n.value === null);

    // Initialize member variables using an initialization list
    var initializations: Object[] = variables.map(n => ({
      kind: 'CallExpression',
      callee: this.visitIdentifier(n.id),
      arguments: [
        n.value !== null ? this.insertImplicitConversion(n.value, n.symbol.type) :
        n.symbol.type.isOwned() ? {
          kind: 'CallExpression',
          callee: {
            kind: 'MemberType',
            inner: { kind: 'Identifier', name: 'std' },
            member: { kind: 'Identifier', name: 'move' }
          },
          arguments: [this.visitIdentifier(n.id)]
        } :
        this.visitIdentifier(n.id)]
    }));

    // Call the inherited constructor
    if (node.base !== null) {
      initializations.unshift({
        kind: 'CallExpression',
        callee: node.base.acceptExpressionVisitor(this),
        arguments: baseVariables.map(n => this.visitIdentifier(n.id))
      });
    }

    // Create the constructor
    ctor({
      kind: 'FunctionDeclaration',
      type: {
        kind: 'FunctionType',
        arguments: this.createVariables(baseVariables.concat(variables.filter(n => n.value === null)))
      },
      id: {
        kind: 'MemberType',
        inner: this.visitIdentifier(node.id),
        member: this.visitIdentifier(node.id)
      },
      initializations: initializations,
      body: { kind: 'BlockStatement', body: [] }
    });

    // Create the destructor
    dtor({
      kind: 'FunctionDeclaration',
      type: { kind: 'FunctionType', arguments: [] },
      id: {
        kind: 'MemberType',
        inner: this.visitIdentifier(node.id),
        member: { kind: 'Identifier', name: '~' + node.id.name }
      },
      body: { kind: 'BlockStatement', body: [] }
    });

    // Create the member functions
    functions.forEach(n => {
      var result: any = this.visitFunctionDeclaration(n);
      result.id = {
        kind: 'MemberType',
        inner: this.visitIdentifier(node.id),
        member: result.id
      };
      memberFunction(n, result);
    });
  }

  declareObjectType(node: ObjectDeclaration): Object {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>node.block.statements.filter(n => n instanceof VariableDeclaration);

    // Create member variables
    var statements: any[] = this.createVariables(variables).map(n => <Object>{
      kind: 'VariableDeclaration',
      qualifiers: [],
      variables: [n]
    });

    // Forward-declare the constructor, the destructor, and any member functions
    this.createFunctionsForObjectType(node,
      ctor => {
        ctor.id = ctor.id.member;
        ctor.body = ctor.initializations = null;
        statements.push(ctor);
      },
      dtor => {
        if (this.needsVirtualDestructor(node)) {
          dtor.id = dtor.id.member;
          dtor.qualifiers = [{ kind: 'Identifier', name: 'virtual' }];
          statements.push(dtor);
        }
      },
      (n, memberFunction) => {
        memberFunction.id = memberFunction.id.member;
        memberFunction.body = null;
        if (n.symbol.isOverridden || n.symbol.isOver()) {
          memberFunction.qualifiers = [{ kind: 'Identifier', name: 'virtual' }];
          if (n.block === null) {
            memberFunction.body = { kind: 'IntegerLiteral', value: 0 };
          }
        }
        statements.push(memberFunction);
      }
    );

    // Bundle everything in a struct declaration
    return {
      kind: 'ObjectDeclaration',
      type: {
        kind: 'ObjectType',
        keyword: 'struct',
        id: this.visitIdentifier(node.id),
        bases: node.base === null ? [] : [node.base.acceptExpressionVisitor(this)],
        body: {
          kind: 'BlockStatement',
          body: statements
        }
      }
    };
  }

  generateFunctionsForObjectType(node: ObjectDeclaration, callback: (n: FunctionDeclaration, o: any) => Object): any[] {
    var statements: any[] = [];

    // Implement the constructor, and any member functions
    this.createFunctionsForObjectType(node,
      ctor => {
        statements.push(ctor);
      },
      dtor => {
        // The destructor is inline (and so is already implemented)
      },
      (n, memberFunction) => {
        if (n.block !== null) {
          statements.push(memberFunction);
        }
      }
    );

    return statements;
  }

  insertImplicitConversion(from: Expression, to: WrappedType): Object {
    if (from.computedType.isValue() && !from.computedType.isNull() && to.isRef()) {
      return {
        kind: 'UnaryExpression',
        operator: '&',
        argument: from.acceptExpressionVisitor(this)
      };
    }

    if (from.computedType.isRef() && to.isValue()) {
      return {
        kind: 'UnaryExpression',
        operator: '*',
        argument: from.acceptExpressionVisitor(this)
      };
    }

    if (from.computedType.isOwned() && to.isRef()) {
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

    if (from.computedType.isOwned() && to.isValue()) {
      if (from instanceof NewExpression) {
        var node: NewExpression = <NewExpression>from;
        var functionType: FunctionType = node.type.computedType.asObject().constructorType();
        return {
          kind: 'CallExpression',
          callee: this.visitType(node.type.computedType),
          arguments: node.args.map((n, i) => this.insertImplicitConversion(n, functionType.args[i]))
        };
      }

      return {
        kind: 'UnaryExpression',
        operator: '*',
        argument: {
          kind: 'CallExpression',
          callee: {
            kind: 'MemberExpression',
            operator: '.',
            object: from.acceptExpressionVisitor(this),
            member: { kind: 'Identifier', name: 'get' }
          },
          arguments: []
        }
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
        arguments: node.args.map(n => ({
          kind: 'Variable',
          type: this.visitType(n.type.computedType),
          id: this.visitIdentifier(n.id)
        }))
      },
      id: this.visitIdentifier(node.id),
      body: null
    };
  }

  static reorderValueTypeDefinitions(objects: ObjectDeclaration[]) {
    for (var i = 0; i < objects.length; i++) {
      var I: ObjectType = objects[i].symbol.type.asObject();
      var index = i;
      for (var j = i - 1; j >= 0; j--) {
        var J: ObjectType = objects[j].symbol.type.asObject();
        if (J.scope.symbols().some(s => s.type.isValue() && s.type.isObject() && TypeLogic.isBaseTypeOf(s.type.asObject(), I))) {
          index = j;
        }
      }
      if (index !== i) {
        objects.splice(index, 0, objects.splice(i, 1)[0]);
      }
    }
  }

  visitModule(node: Module): Object {
    var objects: ObjectDeclaration[] = node.block.sortedObjectDeclarations();
    OutputCPP.reorderValueTypeDefinitions(objects);
    var result: any = {
      kind: 'Program',
      body: flatten([
        objects.map(n => this.forwardDeclareObjectType(n)),
        objects.map(n => this.declareObjectType(n)),
        node.block.variableDeclarations().map(n => n.acceptStatementVisitor(this)),
        node.block.functionDeclarations().map(n => this.declareFunction(n)),
        flatten(objects.map(n => this.generateFunctionsForObjectType(n, (n, o) => n.block !== null ? o : null))),
        node.block.functionDeclarationsWithBlocks().map(n => n.acceptStatementVisitor(this)),
      ])
    };
    result.body = this.library.generate().concat(result.body);
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
    var elseBlock: any = node.elseBlock !== null ? this.visitBlock(node.elseBlock) : null;
    return {
      kind: 'IfStatement',
      test: node.test.acceptExpressionVisitor(this),
      consequent: this.visitBlock(node.thenBlock),
      alternate: elseBlock !== null && elseBlock.body.length === 1 && elseBlock.body[0].kind === 'IfStatement' ? elseBlock.body[0] : elseBlock
    };
  }

  visitWhileStatement(node: WhileStatement): Object {
    return {
      kind: 'WhileStatement',
      test: node.test.acceptExpressionVisitor(this),
      body: this.visitBlock(node.block)
    };
  }

  visitForStatement(node: ForStatement): Object {
    return {
      kind: 'ForStatement',
      init: node.setup !== null ? node.setup.acceptExpressionVisitor(this) : null,
      test: node.test !== null ? node.test.acceptExpressionVisitor(this) : null,
      update: node.update !== null ? node.update.acceptExpressionVisitor(this) : null,
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
        arguments: node.args.map(n => ({
          kind: 'Variable',
          type: this.visitType(n.type.computedType),
          id: this.visitIdentifier(n.id)
        }))
      },
      id: this.visitIdentifier(node.id),
      body: node.block !== null ? this.visitBlock(node.block) : null
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
        init: node.value !== null ? this.insertImplicitConversion(node.value, node.symbol.type) : this.defaultForType(node.symbol.type)
      }]
    };
  }

  visitSymbolExpression(node: SymbolExpression): Object {
    return {
      kind: 'Identifier',
      name: node.name
    };
  }

  visitMoveExpression(node: MoveExpression): Object {
    return {
      kind: 'CallExpression',
      callee: {
        kind: 'MemberType',
        inner: { kind: 'Identifier', name: 'std' },
        member: { kind: 'Identifier', name: 'move' }
      },
      arguments: [node.value.acceptExpressionVisitor(this)]
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
    // Always do pointer comparisons with raw pointers
    if (node.op === '==' || node.op === '!=') {
      return {
        kind: 'BinaryExpression',
        operator: node.op,
        left: this.insertImplicitConversion(node.left, node.left.computedType.isPrimitive() ? node.left.computedType : node.left.computedType.innerType.wrapRef()),
        right: this.insertImplicitConversion(node.right, node.right.computedType.isPrimitive() ? node.right.computedType : node.right.computedType.innerType.wrapRef())
      };
    }

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
      consequent: this.insertImplicitConversion(node.trueValue, node.computedType),
      alternate: this.insertImplicitConversion(node.falseValue, node.computedType)
    };
  }

  visitMemberExpression(node: MemberExpression): Object {
    switch (node.value.computedType.innerType) {
    case NativeTypes.MATH:
      switch (node.id.name) {
        case 'E':
          return {
            kind: 'DoubleLiteral',
            value: Math.E
          };

        case 'PI':
          return {
            kind: 'DoubleLiteral',
            value: Math.PI
          };

        case 'NAN':
        case 'INFINITY':
        case 'cos':
        case 'sin':
        case 'tan':
        case 'acos':
        case 'asin':
        case 'atan':
        case 'atan2':
        case 'round':
        case 'floor':
        case 'ceil':
        case 'exp':
        case 'log':
        case 'sqrt':
        case 'pow':
          this.library.need(LibraryCPP.MATH_HEADER);
          return this.visitIdentifier(node.id);

        case 'min':
        case 'max':
        case 'abs':
          this.library.need(LibraryCPP.MATH_HEADER);
          return {
            kind: 'Identifier',
            name: 'f' + node.id.name
          };

        case 'random':
          this.library.need(LibraryCPP.MATH_RANDOM);
          return {
            kind: 'Identifier',
            name: 'Math_random'
          };

        default:
          assert(false);
      }
      break;

    case NativeTypes.LIST:
      switch (node.symbol) {
      case NativeTypes.LIST_LENGTH:
        return {
          kind: 'CallExpression',
          callee: {
            kind: 'SpecializeTemplate',
            template: { kind: 'Identifier', name: 'static_cast' },
            parameters: [{ kind: 'Identifier', name: 'int' }]
          },
          arguments: [{
            kind: 'CallExpression',
            callee: {
              kind: 'MemberExpression',
              operator: node.value.computedType.isPointer() ? '->' : '.',
              object: node.value.acceptExpressionVisitor(this),
              member: { kind: 'Identifier', name: 'size' }
            },
            arguments: []
          }]
        };
      }
      break;
    }

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
    var args: Object[] = node.args.map((n, i) => this.insertImplicitConversion(n, functionType.args[i]));

    if (node.value instanceof MemberExpression) {
      var member: MemberExpression = <MemberExpression>node.value;

      switch (member.value.computedType.innerType) {
      case NativeTypes.MATH:
        if (member.symbol.name === 'trunc') {
          return {
            kind: 'CallExpression',
            callee: {
              kind: 'SpecializeTemplate',
              template: { kind: 'Identifier', name: 'static_cast' },
              parameters: [{ kind: 'Identifier', name: 'int' }]
            },
            arguments: args
          };
        }
        break;

      case NativeTypes.LIST:
        switch (member.symbol) {
        case NativeTypes.LIST_GET:
          assert(args.length === 1);
          var result: Object = {
            kind: 'BinaryExpression',
            operator: '[]',
            left: member.value.computedType.isValue() ? member.value.acceptExpressionVisitor(this) : {
              kind: 'UnaryExpression',
              operator: '*',
              argument: member.value.acceptExpressionVisitor(this)
            },
            right: args[0]
          };
          assert(member.value.computedType.substitutions.length === 1 && member.value.computedType.substitutions[0].parameter === NativeTypes.LIST_T);
          if (member.value.computedType.substitutions[0].type.isOwned()) {
            return {
              kind: 'CallExpression',
              callee: {
                kind: 'MemberExpression',
                operator: '.',
                object: result,
                member: { kind: 'Identifier', name: 'get' }
              },
              arguments: []
            };
          }
          return result;

        case NativeTypes.LIST_SET:
          assert(args.length === 2);
          return {
            kind: 'AssignmentExpression',
            operator: '=',
            left: {
              kind: 'BinaryExpression',
              operator: '[]',
              left: {
                kind: 'UnaryExpression',
                operator: '*',
                argument: member.value.acceptExpressionVisitor(this)
              },
              right: args[0]
            },
            right: args[1]
          };

        case NativeTypes.LIST_PUSH:
          assert(args.length === 1);
          return {
            kind: 'CallExpression',
            callee: {
              kind: 'MemberExpression',
              operator: member.value.computedType.isPointer() ? '->' : '.',
              object: member.value.acceptExpressionVisitor(this),
              member: { kind: 'Identifier', name: 'push_back' }
            },
            arguments: args
          };

        case NativeTypes.LIST_POP:
        case NativeTypes.LIST_UNSHIFT:
        case NativeTypes.LIST_SHIFT:
        case NativeTypes.LIST_INDEX_OF:
        case NativeTypes.LIST_INSERT:
        case NativeTypes.LIST_REMOVE:
          assert(member.value.computedType.substitutions.length === 1 && member.value.computedType.substitutions[0].parameter === NativeTypes.LIST_T);
          var type: WrappedType = member.value.computedType.substitutions[0].type;
          switch (member.symbol) {
          case NativeTypes.LIST_POP: this.library.need(LibraryCPP.LIST_POP); break;
          case NativeTypes.LIST_UNSHIFT: this.library.need(LibraryCPP.LIST_UNSHIFT); break;
          case NativeTypes.LIST_SHIFT: this.library.need(LibraryCPP.LIST_SHIFT); break;
          case NativeTypes.LIST_INSERT: this.library.need(LibraryCPP.LIST_INSERT); break;
          case NativeTypes.LIST_REMOVE:
            switch (type.kind) {
            case TypeKind.VALUE: case TypeKind.REF: this.library.need(LibraryCPP.LIST_REMOVE); break;
            case TypeKind.OWNED: this.library.need(LibraryCPP.LIST_REMOVE_OWNED); break;
            default: assert(false);
            }
            break;
          case NativeTypes.LIST_INDEX_OF:
            switch (type.kind) {
              case TypeKind.OWNED: this.library.need(LibraryCPP.LIST_INDEXOF_OWNED); break;
              case TypeKind.REF: this.library.need(LibraryCPP.LIST_INDEXOF_REF); break;
              case TypeKind.VALUE: this.library.need(LibraryCPP.LIST_INDEXOF_VALUE); break;
              default: assert(false);
            }
            break;
          default: assert(false);
          }
          return {
            kind: 'CallExpression',
            callee: { kind: 'Identifier', name: 'List_' + member.symbol.name },
            arguments: [this.insertImplicitConversion(member.value, NativeTypes.LIST.wrapRef())].concat(args)
          };

        default:
          assert(false);
        }
        break;
      }
    }

    return {
      kind: 'CallExpression',
      callee: node.value.acceptExpressionVisitor(this),
      arguments: args
    };
  }

  visitNewExpression(node: NewExpression): Object {
    var functionType: FunctionType = node.type.computedType.asObject().constructorType();
    this.library.need(LibraryCPP.MEMORY_HEADER);
    return {
      kind: 'CallExpression',
      callee: {
        kind: 'SpecializeTemplate',
        template: {
          kind: 'MemberType',
          inner: { kind: 'Identifier', name: 'std' },
          member: { kind: 'Identifier', name: 'unique_ptr' }
        },
        parameters: [this.visitType(node.type.computedType)]
      },
      arguments: [{
        kind: 'NewExpression',
        callee: this.visitType(node.type.computedType),
        arguments: node.args.map((n, i) => this.insertImplicitConversion(n, functionType.args[i]))
      }]
    };
  }

  visitTypeKindExpression(node: TypeKindExpression): Object {
    assert(false);
    return null;
  }

  visitTypeParameterExpression(node: TypeParameterExpression): Object {
    return node.type.acceptExpressionVisitor(this);
  }
}
