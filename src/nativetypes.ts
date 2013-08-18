class NativeTypes {
  static MATH: ObjectType = new ObjectType('Math', new Scope(null));

  static createFunction(result: Type, args: Type[]): WrappedType {
    return new FunctionType(result.wrap(TypeModifier.INSTANCE), args.map(t => t.wrap(TypeModifier.INSTANCE))).wrap(TypeModifier.INSTANCE);
  }
}

// TODO: Use static functions to fix C++ generation when those work
NativeTypes.MATH.scope.define('E', SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE));
NativeTypes.MATH.scope.define('PI', SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE));
NativeTypes.MATH.scope.define('NAN', SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE));
NativeTypes.MATH.scope.define('INFINITY', SpecialType.DOUBLE.wrap(TypeModifier.INSTANCE));
NativeTypes.MATH.scope.define('cos', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('sin', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('tan', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('acos', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('asin', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('atan2', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('floor', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('ceil', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('abs', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('log', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('exp', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('sqrt', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('pow', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('min', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('max', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('random', NativeTypes.createFunction(SpecialType.DOUBLE, []));
