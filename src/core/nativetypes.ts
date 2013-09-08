class NativeTypes {
  static MATH: ObjectType = new ObjectType('Math', new Scope(null));
  static LIST: ObjectType = new ObjectType('List', new Scope(null));
  static LIST_T: TypeParameter = new TypeParameter('T');
  static LIST_LENGTH: Symbol;
  static LIST_GET: Symbol;
  static LIST_SET: Symbol;
  static LIST_PUSH: Symbol;
  static LIST_POP: Symbol;
  static LIST_UNSHIFT: Symbol;
  static LIST_SHIFT: Symbol;
  static LIST_INDEX_OF: Symbol;
  static LIST_INSERT: Symbol;
  static LIST_REMOVE: Symbol;

  static createFunction(result: SpecialType, args: SpecialType[]): WrappedType {
    return new FunctionType(result.wrapValue(), args.map(t => t.wrapValue())).wrapRef();
  }
}

// TODO: Use static functions when those work
NativeTypes.MATH.scope.define('E', SpecialType.DOUBLE.wrapValue());
NativeTypes.MATH.scope.define('PI', SpecialType.DOUBLE.wrapValue());
NativeTypes.MATH.scope.define('NAN', SpecialType.DOUBLE.wrapValue());
NativeTypes.MATH.scope.define('INFINITY', SpecialType.DOUBLE.wrapValue());
NativeTypes.MATH.scope.define('cos', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('sin', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('tan', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('acos', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('asin', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('atan', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('atan2', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('round', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('floor', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('ceil', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('abs', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('log', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('exp', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('sqrt', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('pow', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('min', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('max', NativeTypes.createFunction(SpecialType.DOUBLE, [SpecialType.DOUBLE, SpecialType.DOUBLE]));
NativeTypes.MATH.scope.define('random', NativeTypes.createFunction(SpecialType.DOUBLE, []));
NativeTypes.MATH.scope.define('trunc', NativeTypes.createFunction(SpecialType.INT, [SpecialType.DOUBLE]));

// Lists are special-cased for now
NativeTypes.LIST.isSealed = true;
NativeTypes.LIST.byteAlignment = 4;
NativeTypes.LIST.byteSize = 8;
NativeTypes.LIST._constructorType = new FunctionType(null, []);
NativeTypes.LIST.parameters.push(NativeTypes.LIST_T);
NativeTypes.LIST_LENGTH = NativeTypes.LIST.scope.define('length', SpecialType.INT.wrapValue());
NativeTypes.LIST_GET = NativeTypes.LIST.scope.define('get', NativeTypes.createFunction(NativeTypes.LIST_T, [SpecialType.INT]));
NativeTypes.LIST_SET = NativeTypes.LIST.scope.define('set', NativeTypes.createFunction(SpecialType.VOID, [SpecialType.INT, NativeTypes.LIST_T]));
NativeTypes.LIST_PUSH = NativeTypes.LIST.scope.define('push', NativeTypes.createFunction(SpecialType.VOID, [NativeTypes.LIST_T]));
NativeTypes.LIST_POP = NativeTypes.LIST.scope.define('pop', NativeTypes.createFunction(NativeTypes.LIST_T, []));
NativeTypes.LIST_UNSHIFT = NativeTypes.LIST.scope.define('unshift', NativeTypes.createFunction(SpecialType.VOID, [NativeTypes.LIST_T]));
NativeTypes.LIST_SHIFT = NativeTypes.LIST.scope.define('shift', NativeTypes.createFunction(NativeTypes.LIST_T, []));
NativeTypes.LIST_INDEX_OF = NativeTypes.LIST.scope.define('indexOf', NativeTypes.createFunction(SpecialType.INT, [NativeTypes.LIST_T]));
NativeTypes.LIST_INSERT = NativeTypes.LIST.scope.define('insert', NativeTypes.createFunction(SpecialType.VOID, [SpecialType.INT, NativeTypes.LIST_T]));
NativeTypes.LIST_REMOVE = NativeTypes.LIST.scope.define('remove', NativeTypes.createFunction(SpecialType.VOID, [SpecialType.INT]));

// Getting an element from a list of owned pointers should not steal ownership
NativeTypes.LIST_GET.type.asFunction().result.modifiers |= TypeModifier.UNOWNED;
NativeTypes.LIST_INDEX_OF.type.asFunction().args[0].modifiers |= TypeModifier.UNOWNED;
