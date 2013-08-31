// Interesting thread about asm.js internals: https://bugzilla.mozilla.org/show_bug.cgi?id=854061

enum AsmJSType {
  // The void type is the type of functions that are not supposed to return any
  // useful value. As JavaScript functions, they produce the undefined value,
  // but asm.js code is not allowed to make use of this value; functions with
  // return type void can only be called for effect.
  VOID,

  // The double type is the type of ordinary JavaScript double-precision
  // floating-point numbers.
  DOUBLE,

  // The signed type is the type of signed 32-bit integers. While there is no
  // direct concept of integers in JavaScript, 32-bit integers can be represented
  // as doubles, and integer operations can be performed with JavaScript
  // arithmetic, relational, and bitwise operators.
  SIGNED,

  // The unsigned type is the type of unsigned 32-bit integers. Again, these
  // are not a first-class concept in JavaScript, but can be represented as
  // floating-point numbers.
  UNSIGNED,

  // The int type is the type of 32-bit integers where the signedness is not
  // known. In asm.js, the type of a variable never has a known signedness.
  // This allows them to be compiled as 32-bit integer registers and memory
  // words. However, this representation creates an overlap between signed
  // and unsigned numbers that causes an ambiguity in determining which
  // JavaScript number they represent. For example, the bit pattern 0xffffffff
  // could represent 4294967295 or -1, depending on the signedness. For this
  // reason, values of the int type are disallowed from escaping into external
  // (non-asm.js) JavaScript code.
  INT,

  // The fixnum type is the type of integers in the range [0, 2^31)-that is, the
  // range of integers such that an unboxed 32-bit representation has the same
  // value whether it is interpreted as signed or unsigned.
  FIXNUM,

  // Even though JavaScript only supports floating-point arithmetic, most
  // operations can simulate integer arithmetic by coercing their result to an
  // integer. For example, adding two integers may overflow beyond the 32-bit
  // range, but coercing the result back to an integer produces the same 32-bit
  // integer as integer addition in, say, C.
  //
  // The intish type represents the result of a JavaScript integer operation
  // that must be coerced back to an integer with an explicit coercion (ToInt32
  // for signed integers and ToUint32 for unsigned integers). Validation
  // requires all intish values to be immediately passed to an operator or
  // standard library that performs the appropriate coercion or else dropped via
  // an expression statement. This way, each integer operation can be compiled
  // directly to machine operations.
  //
  // The one operator that does not support this approach is multiplication.
  // (Multiplying two large integers can result in a large enough double that
  // some lower bits of precision are lost.) So asm.js does not support applying
  // the multiplication operator to integer operands. Instead, the proposed
  // Math.imul function is recommended as the proper means of implementing
  // integer multiplication.
  INTISH,

  // Similar to intish, the doublish type represents operations that are expected
  // to produce a double but may produce additional junk that must be coerced
  // back to a number via ToNumber. In particular, reading out of bounds from
  // a typed array produces undefined, and calling FFI functions may produce
  // arbitrary JavaScript values.
  DOUBLISH,

  // The unknown type represents a value returned from an FFI call. Since asm.js
  // does not allow general JavaScript values, the result must be immediately
  // coerced to an integer or double.
  UNKNOWN,

  // The abstract extern type represents the root of all types that can escape
  // back into external JavaScript.
  EXTERN,

  // BitScript-specific special types for the return type of CallExpressions.
  RETURN_DOUBLE,
  RETURN_INT,
}

// Bundles a JavaScript AST with an asm.js type to know where to insert casts
class AsmJSPair {
  constructor(
    public type: AsmJSType,
    public result: any) {
  }
}

// Note: This whole thing was hacked up really fast and is pretty messy. It's
// also currently incomplete and doesn't yet support things you probably want
// like lists, virtual functions, and shared pointers, and freeing memory.
class OutputAsmJS implements StatementVisitor<any>, DeclarationVisitor<any>, ExpressionVisitor<AsmJSPair> {
  returnType: WrappedType = null;
  usesIntegerMultiplication: boolean = false;
  functionTables: { [key: string]: FunctionDeclaration[] } = {};

  static generate(node: Module, moduleName: string): string {
    BinaryLayout.run(node);
    return escodegen.generate(new OutputAsmJS().visitModule(node, moduleName), {
      parse: esprima.parse, // Needed for raw floating-point literals with integer values
      format: { indent: { style: '  ' } }
    });
  }

  static typeToAsmJSType(type: WrappedType): AsmJSType {
    return type.isDouble() ? AsmJSType.DOUBLE : type.isVoid() ? AsmJSType.VOID : AsmJSType.INT;
  }

  static doubleValue(value: number): AsmJSPair {
    return new AsmJSPair(AsmJSType.DOUBLE, {
      type: 'Literal',
      raw: value.toString().indexOf('.') >= 0 ? value.toString() : value.toString().replace(/([eE]|$)/, '.0$1'),
      value: value
    });
  }

  static integerValue(value: number): AsmJSPair {
    assert(value === (0 | value));
    return new AsmJSPair(value < 0 ? AsmJSType.SIGNED : AsmJSType.FIXNUM, {
      type: 'Literal',
      value: value
    });
  }

  static defaultValueForType(type: WrappedType): AsmJSPair {
    return type.isDouble() ? OutputAsmJS.doubleValue(0) : OutputAsmJS.integerValue(0);
  }

  static wrapWithDoubleTypeAnnotation(result: AsmJSPair): AsmJSPair {
    // Must pick either SIGNED or UNSIGNED before converting to double
    if (result.type === AsmJSType.INTISH || result.type === AsmJSType.INT) {
      result = OutputAsmJS.wrapWithSignedTypeAnnotation(result);
    }

    return new AsmJSPair(AsmJSType.DOUBLE, {
      type: 'UnaryExpression',
      operator: '+',
      argument: result.result
    });
  }

  static wrapWithSignedTypeAnnotation(result: AsmJSPair): AsmJSPair {
    return new AsmJSPair(AsmJSType.SIGNED, {
      type: 'BinaryExpression',
      operator: '|',
      left: result.result,
      right: { type: 'Literal', value: 0 }
    });
  }

  static wrapWithTypeAnnotation(result: AsmJSPair, type: AsmJSType): AsmJSPair {
    switch (type) {
    case AsmJSType.DOUBLE:
      if (result.type !== AsmJSType.DOUBLE) {
        return OutputAsmJS.wrapWithDoubleTypeAnnotation(result);
      }
      break;

    case AsmJSType.DOUBLISH:
      if (result.type !== AsmJSType.DOUBLISH && result.type !== AsmJSType.DOUBLE && result.type !== AsmJSType.UNKNOWN) {
        return OutputAsmJS.wrapWithDoubleTypeAnnotation(result);
      }
      break;

    case AsmJSType.INTISH:
      if (result.type !== AsmJSType.INTISH && result.type !== AsmJSType.INT && result.type !== AsmJSType.UNKNOWN &&
          result.type !== AsmJSType.SIGNED && result.type !== AsmJSType.UNSIGNED && result.type !== AsmJSType.FIXNUM) {
        return OutputAsmJS.wrapWithSignedTypeAnnotation(result);
      }
      break;

    case AsmJSType.EXTERN:
      if (result.type === AsmJSType.DOUBLISH || result.type === AsmJSType.RETURN_DOUBLE) {
        return OutputAsmJS.wrapWithDoubleTypeAnnotation(result);
      }
      if (result.type === AsmJSType.INT || result.type === AsmJSType.INTISH || result.type === AsmJSType.RETURN_INT) {
        return OutputAsmJS.wrapWithSignedTypeAnnotation(result);
      }
      break;

    case AsmJSType.SIGNED:
      if (result.type !== AsmJSType.SIGNED && result.type !== AsmJSType.FIXNUM) {
        return OutputAsmJS.wrapWithSignedTypeAnnotation(result);
      }
      break;

    case AsmJSType.INT:
      if (result.type !== AsmJSType.INT && result.type !== AsmJSType.SIGNED &&
          result.type !== AsmJSType.UNSIGNED && result.type !== AsmJSType.FIXNUM) {
        return OutputAsmJS.wrapWithSignedTypeAnnotation(result);
      }
      break;

    case AsmJSType.UNKNOWN:
      break;

    // We shouldn't ever convert to these types
    case AsmJSType.FIXNUM:
    case AsmJSType.UNSIGNED:
    case AsmJSType.VOID:
      assert(false);
      break;

    // Make sure we don't miss any cases
    default:
      assert(false);
    }
    return result;
  }

  static keyForType(type: WrappedType): string {
    if (type.isDouble()) return 'D';
    if (type.isInt() || type.isPointer() || type.isBool()) return 'I';
    if (type.isVoid()) return 'V';
    if (type.isFunction()) return 'fn$' + OutputAsmJS.keyForType(type.asFunction().result) +
      type.asFunction().args.map(t => OutputAsmJS.keyForType(t)).join('');
    assert(false);
  }

  static isVirtualSymbol(symbol: Symbol): boolean {
    return symbol.isAbstract || symbol.isOverridden;
  }

  static manglePropertyLookup(node: Expression, symbol: Symbol): any {
    if (symbol.enclosingObject !== null) {
      if (node !== null && OutputAsmJS.isVirtualSymbol(symbol)) {
        throw new Error('TODO: EMIT VTABLE LOOKUP');
      }
      return { type: 'Identifier', name: symbol.enclosingObject.name + '$' + symbol.name };
    }
    return { type: 'Identifier', name: symbol.name };
  }

  static dereferenceMemory(pointer: AsmJSPair, symbol: Symbol): AsmJSPair {
    // Values from an Int32Array are INTISH and values from a Float64Array are DOUBLISH
    var type: AsmJSType = symbol.type.isDouble() ? AsmJSType.DOUBLISH : AsmJSType.INTISH;
    return new AsmJSPair(type, {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: symbol.type.isDouble() ? 'F64' : 'I32' },
      property: {
        type: 'BinaryExpression',
        operator: '>>',
        left: symbol.byteOffset === 0 ? pointer.result : {
          type: 'BinaryExpression',
          operator: '+',
          left: OutputAsmJS.wrapWithTypeAnnotation(pointer, AsmJSType.INT).result,
          right: { type: 'Literal', value: symbol.byteOffset }
        },
        right: { type: 'Literal', value: symbol.type.isDouble() ? 3 : 2 }
      },
      computed: true
    });
  }

  static emitTypeAnnotationsForArguments(args: VariableDeclaration[]): any[] {
    return args.map(n => ({
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: OutputAsmJS.visitIdentifier(n.id),
        right: n.symbol.type.isDouble()
          ? OutputAsmJS.wrapWithDoubleTypeAnnotation(new AsmJSPair(AsmJSType.UNKNOWN, OutputAsmJS.visitIdentifier(n.id))).result
          : OutputAsmJS.wrapWithSignedTypeAnnotation(new AsmJSPair(AsmJSType.UNKNOWN, OutputAsmJS.visitIdentifier(n.id))).result
      }
    }));
  }

  static findAllVariablesInFunctionDeclaration(node: FunctionDeclaration): Symbol[] {
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

    // TODO: prevent duplicate symbols by renaming
    var localSymbols: Symbol[] = [];
    searchBlock(node.block);
    return localSymbols;
  }

  getBaseVariables(node: Expression): VariableDeclaration[] {
    if (node instanceof SymbolExpression) {
      var base: ObjectDeclaration = <ObjectDeclaration>(<SymbolExpression>node).symbol.node;
      return this.getBaseVariables(base.base).concat(base.block.statements.filter(n => n instanceof VariableDeclaration));
    }
    return [];
  }

  generateConstructor(node: ObjectDeclaration): any {
    var variables: VariableDeclaration[] = <VariableDeclaration[]>node.block.statements.filter(n => n instanceof VariableDeclaration);
    var baseVariables: VariableDeclaration[] = this.getBaseVariables(node.base).filter(n => n.value === null);
    var args: VariableDeclaration[] = baseVariables.concat(variables.filter(n => n.value === null));
    var self: any = { type: 'Identifier', name: 'self' };

    // Create the constructor function
    var result: any = {
      type: 'FunctionDeclaration',
      params: [self].concat(args.map(n => OutputAsmJS.visitIdentifier(n.id))),
      id: OutputAsmJS.visitIdentifier(node.id),
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
              right: OutputAsmJS.wrapWithSignedTypeAnnotation(new AsmJSPair(AsmJSType.UNKNOWN, self)).result
            }
          },

          // Emit argument type annotations
          OutputAsmJS.emitTypeAnnotationsForArguments(args),

          // Add a call to the constructor for the base class
          node.base === null ? [] : <any>{
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: node.base.acceptExpressionVisitor(this).result,
              arguments: [self].concat(baseVariables.map(n => OutputAsmJS.visitIdentifier(n.id)))
            }
          },

          // Initialize each variable
          variables.map(n => {
            var type: AsmJSType = OutputAsmJS.typeToAsmJSType(n.symbol.type);
            return {
              type: 'ExpressionStatement',
              expression: {
                type: 'AssignmentExpression',
                operator: '=',
                left: OutputAsmJS.dereferenceMemory(new AsmJSPair(AsmJSType.INT, self), n.symbol).result,
                right: OutputAsmJS.wrapWithTypeAnnotation(n.value !== null ? n.value.acceptExpressionVisitor(this) :
                  new AsmJSPair(type, OutputAsmJS.visitIdentifier(n.id)), type).result
              }
            };
          }),

          // Return the "this" pointer
          {
            type: 'ReturnStatement',
            argument: OutputAsmJS.wrapWithSignedTypeAnnotation(new AsmJSPair(AsmJSType.UNKNOWN, self)).result
          }
        )
      }
    };

    return result;
  }

  generateMemberFunctions(node: ObjectDeclaration): any[] {
    return node.block.statements.filter(n => n instanceof FunctionDeclaration && n.block !== null).map(n => {
      var result: any = this.visitFunctionDeclaration(n);
      var self: any = { type: 'Identifier', name: 'self' };
      result.id = OutputAsmJS.manglePropertyLookup(null, (<FunctionDeclaration>n).symbol);
      result.params.unshift(self);
      result.body.body.unshift({
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: self,
          right: OutputAsmJS.wrapWithSignedTypeAnnotation(new AsmJSPair(AsmJSType.UNKNOWN, self)).result
        }
      });
      return result;
    });
  }

  visitModule(node: Module, moduleName: string): any {
    var body: any[] = [];
    var polyfills: any[] = [];
    var objects: ObjectDeclaration[] = <ObjectDeclaration[]>node.block.statements.filter(n => n instanceof ObjectDeclaration);
    var varibles: VariableDeclaration[] = <VariableDeclaration[]>node.block.statements.filter(n => n instanceof VariableDeclaration);
    var functions: FunctionDeclaration[] = <FunctionDeclaration[]>node.block.statements.filter(n => n instanceof FunctionDeclaration && n.block !== null);
    var externalFunctions: FunctionDeclaration[] = <FunctionDeclaration[]>node.block.statements.filter(n => n instanceof FunctionDeclaration && n.block === null);
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
      polyfills = polyfills.concat(esprima.parse([
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

    // Emit imports for external functions
    body = body.concat(externalFunctions.map(n => ({
      type: 'VariableDeclaration',
      declarations: [{
        type: 'VariableDeclarator',
        id: OutputAsmJS.visitIdentifier(n.id),
        init: {
          type: 'MemberExpression',
          object: { type: 'Identifier', name: 'foreign' },
          property: OutputAsmJS.visitIdentifier(n.id)
        }
      }],
      kind: 'var'
    })));

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
          key: OutputAsmJS.visitIdentifier(n.id),
          value: OutputAsmJS.visitIdentifier(n.id)
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

  visitBlock(node: Block): any {
    return {
      type: 'BlockStatement',
      body: node.statements
        .filter(n => !(n instanceof VariableDeclaration) || n.value !== null) // Ignore empty variable declarations
        .map(n => n.acceptStatementVisitor(this))
    };
  }

  static visitIdentifier(node: Identifier): any {
    return {
      type: 'Identifier',
      name: node.name
    };
  }

  visitExpressionStatement(node: ExpressionStatement): any {
    return {
      type: 'ExpressionStatement',
      expression: node.value.acceptExpressionVisitor(this).result
    };
  }

  visitIfStatement(node: IfStatement): any {
    var elseBlock: any = node.elseBlock !== null ? this.visitBlock(node.elseBlock) : null;
    return {
      type: 'IfStatement',
      test: OutputAsmJS.wrapWithTypeAnnotation(node.test.acceptExpressionVisitor(this).result, AsmJSType.INT),
      consequent: this.visitBlock(node.thenBlock),
      alternate: elseBlock !== null && elseBlock.body.length === 1 && elseBlock.body[0].type === 'IfStatement' ? elseBlock.body[0] : elseBlock
    };
  }

  visitWhileStatement(node: WhileStatement): any {
    return {
      type: 'WhileStatement',
      test: OutputAsmJS.wrapWithTypeAnnotation(node.test.acceptExpressionVisitor(this).result, AsmJSType.INT),
      body: this.visitBlock(node.block)
    };
  }

  visitForStatement(node: ForStatement): any {
    return {
      type: 'ForStatement',
      init: node.setup !== null ? node.setup.acceptExpressionVisitor(this).result : null,
      test: node.test !== null ? OutputAsmJS.wrapWithTypeAnnotation(node.test.acceptExpressionVisitor(this), AsmJSType.INT).result : null,
      update: node.update !== null ? node.update.acceptExpressionVisitor(this).result : null,
      body: this.visitBlock(node.block)
    };
  }

  visitReturnStatement(node: ReturnStatement): any {
    if (node.value === null) return { type: 'ReturnStatement', argument: null };

    // Force the annotation per the spec
    var value: AsmJSPair = node.value.acceptExpressionVisitor(this);
    return {
      type: 'ReturnStatement',
      argument: this.returnType.isDouble()
        ? OutputAsmJS.wrapWithDoubleTypeAnnotation(value).result
        : OutputAsmJS.wrapWithSignedTypeAnnotation(value).result
    };
  }

  visitBreakStatement(node: BreakStatement): any {
    return {
      type: 'BreakStatement',
      label: null
    };
  }

  visitContinueStatement(node: ContinueStatement): any {
    return {
      type: 'ContinueStatement',
      label: null
    };
  }

  visitDeclaration(node: Declaration): any {
    return node.acceptDeclarationVisitor(this);
  }

  visitObjectDeclaration(node: ObjectDeclaration): any {
    assert(false);
    return null;
  }

  visitFunctionDeclaration(node: FunctionDeclaration): any {
    assert(node.block !== null);
    this.returnType = node.symbol.type.asFunction().result;

    // Emit type annotations for arguments
    var args: any[] = OutputAsmJS.emitTypeAnnotationsForArguments(node.args);

    // Declare all variables now
    var locals: any[] = OutputAsmJS.findAllVariablesInFunctionDeclaration(node).map(symbol => ({
      type: 'VariableDeclaration',
      declarations: [{
        type: 'VariableDeclarator',
        id: { type: 'Identifier', name: symbol.name },
        init: OutputAsmJS.defaultValueForType(symbol.type).result
      }],
      kind: 'var'
    }));

    var body: any = this.visitBlock(node.block);
    body.body = args.concat(locals, body.body);
    return {
      type: 'FunctionDeclaration',
      params: node.args.map(n => OutputAsmJS.visitIdentifier(n.id)),
      id: OutputAsmJS.visitIdentifier(node.id),
      body: body
    };
  }

  visitVariableDeclaration(node: VariableDeclaration): any {
    assert(node.value !== null);
    return {
      type: 'ExpressionStatement',
      expression: {
        type: 'AssignmentExpression',
        operator: '=',
        left: OutputAsmJS.visitIdentifier(node.id),
        right: OutputAsmJS.wrapWithTypeAnnotation(node.value.acceptExpressionVisitor(this), OutputAsmJS.typeToAsmJSType(node.symbol.type)).result
      }
    };
  }

  visitSymbolExpression(node: SymbolExpression): AsmJSPair {
    // Access object fields off of "this"
    if (node.symbol.enclosingObject !== null) {
      return OutputAsmJS.dereferenceMemory(new AsmJSPair(AsmJSType.INT, { type: 'Identifier', name: 'self' }), node.symbol);
    }

    return new AsmJSPair(OutputAsmJS.typeToAsmJSType(node.computedType), {
      type: 'Identifier',
      name: node.name
    });
  }

  visitMoveExpression(node: MoveExpression): AsmJSPair {
    return node.value.acceptExpressionVisitor(this);
  }

  visitUnaryExpression(node: UnaryExpression): AsmJSPair {
    var value = node.value.acceptExpressionVisitor(this);
    var inputType: AsmJSType;
    var outputType: AsmJSType;

    switch (node.op) {
    case '+':
      return value; // Unary + is a no-op in BitScript

    case '-':
      inputType = node.value.computedType.isDouble() ? AsmJSType.DOUBLISH : AsmJSType.INT;
      outputType = node.value.computedType.isDouble() ? AsmJSType.DOUBLE : AsmJSType.INTISH;
      break;

    case '~':
      inputType = AsmJSType.INTISH;
      outputType = AsmJSType.SIGNED;
      break;

    case '!':
      inputType = AsmJSType.INT;
      outputType = AsmJSType.INT;
      break;

    // Make sure we catch all the cases
    default:
      assert(false);
    }

    return new AsmJSPair(outputType, {
      type: 'UnaryExpression',
      operator: node.op,
      argument: OutputAsmJS.wrapWithTypeAnnotation(value, inputType).result
    });
  }

  visitBinaryExpression(node: BinaryExpression): AsmJSPair {
    var isDouble: boolean = TypeLogic.commonImplicitType(node.left.computedType, node.right.computedType).isDouble();
    var left: any = node.left.acceptExpressionVisitor(this);
    var right: any = node.right.acceptExpressionVisitor(this);
    var inputType: AsmJSType;
    var outputType: AsmJSType;

    switch (node.op) {
    case '=':
      var type: AsmJSType = OutputAsmJS.typeToAsmJSType(node.left.computedType);
      return new AsmJSPair(type, {
        type: 'AssignmentExpression',
        operator: '=',
        left: left.result,
        right: OutputAsmJS.wrapWithTypeAnnotation(right, type).result
      });
      break;

    // The asm.js spec only has &, not &&, but we need short-circuit behavior
    case '&&':
      return new AsmJSPair(AsmJSType.INT, {
        type: 'ConditionalExpression',
        test: OutputAsmJS.wrapWithTypeAnnotation(left, AsmJSType.INT).result,
        consequent: OutputAsmJS.wrapWithTypeAnnotation(right, AsmJSType.INT).result,
        alternate: OutputAsmJS.integerValue(0).result
      });
      break;

    // The asm.js spec only has |, not ||, but we need short-circuit behavior
    case '||':
      return new AsmJSPair(AsmJSType.INT, {
        type: 'ConditionalExpression',
        test: OutputAsmJS.wrapWithTypeAnnotation(left, AsmJSType.INT).result,
        consequent: OutputAsmJS.integerValue(1).result,
        alternate: OutputAsmJS.wrapWithTypeAnnotation(right, AsmJSType.INT).result
      });
      break;

    case '==':
    case '!=':
    case '<':
    case '>':
    case '<=':
    case '>=':
      inputType = isDouble ? AsmJSType.DOUBLE : AsmJSType.SIGNED;
      outputType = AsmJSType.INT;
      break;

    case '+':
    case '-':
      inputType = isDouble ? AsmJSType.DOUBLE : AsmJSType.INT;
      outputType = isDouble ? AsmJSType.DOUBLE : AsmJSType.INTISH;
      break;

    case '*':
      // Special-case integer multiplication
      if (!node.computedType.isDouble()) {
        var Math_imul: AsmJSPair = new AsmJSPair(AsmJSType.UNKNOWN, { type: 'Identifier', name: 'Math_imul' });
        this.usesIntegerMultiplication = true;
        return OutputAsmJS.generateCallExpression(Math_imul, [
          OutputAsmJS.wrapWithTypeAnnotation(left, AsmJSType.INT),
          OutputAsmJS.wrapWithTypeAnnotation(right, AsmJSType.INT)],
          AsmJSType.INT);
      }
      inputType = AsmJSType.DOUBLISH;
      outputType = AsmJSType.DOUBLE;
      break;

    // Note: The spec says % returns INT but https://bugzilla.mozilla.org/show_bug.cgi?id=878433 says INTISH
    case '/':
    case '%':
      inputType = isDouble ? AsmJSType.DOUBLISH : AsmJSType.SIGNED;
      outputType = isDouble ? AsmJSType.DOUBLE : AsmJSType.INTISH;
      break;

    case '^':
    case '&':
    case '|':
    case '<<':
    case '>>':
      inputType = AsmJSType.INTISH;
      outputType = AsmJSType.SIGNED;
      break;

    // Make sure we catch all the cases
    default:
      assert(false);
    }

    return new AsmJSPair(outputType, {
      type: 'BinaryExpression',
      operator: node.op,
      left: OutputAsmJS.wrapWithTypeAnnotation(left, inputType).result,
      right: OutputAsmJS.wrapWithTypeAnnotation(right, inputType).result
    });
  }

  visitTernaryExpression(node: TernaryExpression): AsmJSPair {
    var type: AsmJSType = OutputAsmJS.typeToAsmJSType(node.computedType);
    return new AsmJSPair(type, {
      type: 'ConditionalExpression',
      test: OutputAsmJS.wrapWithTypeAnnotation(node.value.acceptExpressionVisitor(this), AsmJSType.INT),
      consequent: OutputAsmJS.wrapWithTypeAnnotation(node.trueValue.acceptExpressionVisitor(this), type),
      alternate: OutputAsmJS.wrapWithTypeAnnotation(node.falseValue.acceptExpressionVisitor(this), type)
    });
  }

  visitMemberExpression(node: MemberExpression): AsmJSPair {
    return OutputAsmJS.dereferenceMemory(
      node.value.acceptExpressionVisitor(this),
      node.symbol);
  }

  visitIntExpression(node: IntExpression): AsmJSPair {
    return OutputAsmJS.integerValue(node.value);
  }

  visitBoolExpression(node: BoolExpression): AsmJSPair {
    return OutputAsmJS.integerValue(+node.value);
  }

  visitDoubleExpression(node: DoubleExpression): AsmJSPair {
    return OutputAsmJS.doubleValue(node.value);
  }

  visitNullExpression(node: NullExpression): AsmJSPair {
    return OutputAsmJS.integerValue(0);
  }

  visitThisExpression(node: ThisExpression): AsmJSPair {
    return new AsmJSPair(AsmJSType.INT, {
      type: 'Identifier',
      name: 'self'
    });
  }

  // Need to wrap calls with the return type because otherwise asm.js assumes
  // void. We can't wrap it with DOUBLE or INT because we always need a cast,
  // so we wrap it with the special RETURN_DOUBLE or RETURN_INT types instead.
  static generateCallExpression(callee: AsmJSPair, args: AsmJSPair[], result: AsmJSType): AsmJSPair {
    return new AsmJSPair(result === AsmJSType.DOUBLE ? AsmJSType.RETURN_DOUBLE : AsmJSType.RETURN_INT, {
      type: 'CallExpression',
      callee: callee.result,
      arguments: args.map(p => p.result)
    });
  }

  visitCallExpression(node: CallExpression): AsmJSPair {
    var functionType: FunctionType = node.value.computedType.asFunction();
    var args: AsmJSPair[] = node.args.map(n => n.acceptExpressionVisitor(this));
    var resultType: AsmJSType = OutputAsmJS.typeToAsmJSType(functionType.result);

    // All argument types are AsmJSType.EXTERN when calling external functions
    if (node.value instanceof SymbolExpression && (<SymbolExpression>node.value).symbol.isAbstract) {
      args = args.map((p, i) => OutputAsmJS.wrapWithTypeAnnotation(p, AsmJSType.EXTERN));
    } else {
      args = args.map((p, i) => OutputAsmJS.wrapWithTypeAnnotation(p, OutputAsmJS.typeToAsmJSType(functionType.args[i])));
    }

    // Call member functions directly
    if (node.value instanceof MemberExpression) {
      var member = <MemberExpression>node.value;
      args.unshift(OutputAsmJS.wrapWithTypeAnnotation(member.value.acceptExpressionVisitor(this), AsmJSType.INT));
      return OutputAsmJS.generateCallExpression(new AsmJSPair(AsmJSType.UNKNOWN, OutputAsmJS.manglePropertyLookup(member.value, member.symbol)), args, resultType);
    }

    return OutputAsmJS.generateCallExpression(node.value.acceptExpressionVisitor(this), args, resultType);
  }

  visitNewExpression(node: NewExpression): AsmJSPair {
    var bytes: number = node.computedType.asObject().byteSize;
    var constructorType: FunctionType = node.computedType.asObject().constructorType();
    var malloc: AsmJSPair = new AsmJSPair(AsmJSType.UNKNOWN, { type: 'Identifier', name: 'malloc' });
    var callMalloc: AsmJSPair = OutputAsmJS.wrapWithSignedTypeAnnotation(OutputAsmJS.generateCallExpression(malloc, [OutputAsmJS.integerValue(bytes)], AsmJSType.INT));
    var args: AsmJSPair[] = node.args.map((n, i) => OutputAsmJS.wrapWithTypeAnnotation(n.acceptExpressionVisitor(this), OutputAsmJS.typeToAsmJSType(constructorType.args[i])));
    return OutputAsmJS.generateCallExpression(node.type.acceptExpressionVisitor(this), [callMalloc].concat(args), AsmJSType.INT);
  }

  visitTypeModifierExpression(node: TypeModifierExpression): AsmJSPair {
    assert(false);
    return null;
  }

  visitTypeParameterExpression(node: TypeParameterExpression): AsmJSPair {
    return node.type.acceptExpressionVisitor(this);
  }
}
