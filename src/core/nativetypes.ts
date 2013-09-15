class NativeTypes {
  static MATH: ObjectType = new ObjectType('Math', new Scope(null));

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

NativeTypes.defineStaticFinal(NativeTypes.MATH, 'E', SpecialType.DOUBLE.wrapValue());
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'PI', SpecialType.DOUBLE.wrapValue());
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'NAN', SpecialType.DOUBLE.wrapValue());
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'INFINITY', SpecialType.DOUBLE.wrapValue());
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'cos', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'sin', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'tan', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'acos', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'asin', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'atan', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'atan2', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'round', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'floor', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'ceil', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'abs', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'log', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'exp', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'sqrt', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'pow', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'min', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'max', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.defineStaticFinal(NativeTypes.MATH, 'random', NativeTypes.createFunction(SpecialType.DOUBLE, []));
