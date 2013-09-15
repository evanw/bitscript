class NativeTypes {
  static MATH: ObjectType = new ObjectType('Math', new Scope(null));
  static INT: SpecialType = new SpecialType(4, 'int');
  static BOOL: SpecialType = new SpecialType(1, 'bool');
  static NULL: SpecialType = new SpecialType(4, 'null');
  static VOID: SpecialType = new SpecialType(0, 'void');
  static ERROR: SpecialType = new SpecialType(0, '<error>');
  static FLOAT: SpecialType = new SpecialType(4, 'float');
  static DOUBLE: SpecialType = new SpecialType(8, 'double');
  static CIRCULAR: SpecialType = new SpecialType(0, '<circular>');

  static createGlobalScope(): Scope {
    var scope: Scope = new Scope(null);
    scope.replace(new Symbol('int', NativeTypes.INT.wrapValueType(), scope));
    scope.replace(new Symbol('void', NativeTypes.VOID.wrapValueType(), scope));
    scope.replace(new Symbol('bool', NativeTypes.BOOL.wrapValueType(), scope));
    scope.replace(new Symbol('float', NativeTypes.FLOAT.wrapValueType(), scope));
    scope.replace(new Symbol('double', NativeTypes.DOUBLE.wrapValueType(), scope));
    scope.replace(new Symbol('Math', NativeTypes.MATH.wrapValueType(), scope));
    return scope;
  }

  static defineStaticFinal(objectType: ObjectType, name: string, type: WrappedType): Symbol {
    var symbol: Symbol = new Symbol(name, type, objectType.scope);
    symbol.modifiers = SymbolModifier.FINAL | SymbolModifier.STATIC;
    objectType.scope.replace(symbol);
    return symbol;
  }

  static createFunction(result: SpecialType, args: SpecialType[]): WrappedType {
    return new FunctionType(result.wrapValue(), args.map(t => t.wrapValue())).wrapValue();
  }
}

NativeTypes.defineStaticFinal(NativeTypes.MATH, 'E', NativeTypes.DOUBLE.wrapValue());
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'PI', NativeTypes.DOUBLE.wrapValue());
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'NAN', NativeTypes.DOUBLE.wrapValue());
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'INFINITY', NativeTypes.DOUBLE.wrapValue());
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'cos', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'sin', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'tan', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'acos', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'asin', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'atan', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'atan2', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE, NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'round', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'floor', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'ceil', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'abs', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'log', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'exp', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'sqrt', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'pow', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE, NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'min', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE, NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'max', NativeTypes.createFunction(NativeTypes.DOUBLE, [NativeTypes.DOUBLE, NativeTypes.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'random', NativeTypes.createFunction(NativeTypes.DOUBLE, []));
