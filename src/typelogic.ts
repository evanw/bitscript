class TypeLogic {
  static equal(a: Type, b: Type): boolean {
    if (a === b) return true;
    if (a instanceof FunctionType && b instanceof FunctionType) {
      var fa: FunctionType = <FunctionType>a;
      var fb: FunctionType = <FunctionType>b;
      return TypeLogic.equalWrapped(fa.result, fb.result) && TypeLogic.allEqualWrapped(fa.args, fb.args);
    }
    return false;
  }

  static equalWrapped(a: WrappedType, b: WrappedType): boolean {
    return TypeLogic.equal(a.innerType, b.innerType) && a.modifiers === b.modifiers;
  }

  static allEqualWrapped(a: WrappedType[], b: WrappedType[]): boolean {
    return a.length === b.length && a.every((a, i) => TypeLogic.equalWrapped(a, b[i]));
  }

  static isBaseTypeOf(derived: ObjectType, base: ObjectType): boolean {
    for (var type: ObjectType = derived; type !== null; type = type.baseType) {
      if (type === base) return true;
    }
    return false;
  }

  static commonBaseType(a: ObjectType, b: ObjectType): ObjectType {
    for (var c: ObjectType = a; c !== null; c = c.baseType) {
      for (var d: ObjectType = b; d !== null; d = d.baseType) {
        if (c === d) return c;
      }
    }
    return null;
  }

  static isValidOverride(derived: WrappedType, base: WrappedType): boolean {
    return derived.isFunction() && base.isFunction() && TypeLogic.equalWrapped(derived, base);
  }

  static checkImplicitConversionTypes(from: WrappedType, to: WrappedType): boolean {
    var f: Type = from.innerType;
    var t: Type = to.innerType;
    if (f === SpecialType.INT && t === SpecialType.DOUBLE) return true;
    if (f === SpecialType.NULL && to.isPointer()) return true;
    if (f instanceof ObjectType && t instanceof ObjectType) {
      return TypeLogic.isBaseTypeOf(<ObjectType>f, <ObjectType>t); // Upcasting is implicit
    }
    return TypeLogic.equal(f, t);
  }

  static checkImplicitConversionTypeModifiers(from: WrappedType, to: WrappedType): boolean {
    if (from.isRawPointer() && to.isRawPointer()) return true;
    if (from.isOwned() && to.isPointer()) return true;
    if (from.isShared() && to.isPointer() && !to.isOwned()) return true;
    if (from.isPrimitive() && to.isPrimitive()) return true;
    return false;
  }

  static canImplicitlyConvert(from: WrappedType, to: WrappedType): boolean {
    return TypeLogic.checkImplicitConversionTypes(from, to) &&
           TypeLogic.checkImplicitConversionTypeModifiers(from, to);
  }

  static commonImplicitType(a: WrappedType, b: WrappedType): WrappedType {
    if (TypeLogic.canImplicitlyConvert(a, b)) return b;
    if (TypeLogic.canImplicitlyConvert(b, a)) return a;
    if (a.innerType instanceof ObjectType && b.innerType instanceof ObjectType) {
      var oa: ObjectType = <ObjectType>a.innerType;
      var ob: ObjectType = <ObjectType>b.innerType;
      var base: ObjectType = TypeLogic.commonBaseType(oa, ob);
      if (base !== null) {
        if (a.isRawPointer() || b.isRawPointer()) {
          return base.wrap(TypeModifier.INSTANCE);
        }
        if (a.isShared() || b.isShared()) {
          return base.wrap(TypeModifier.INSTANCE | TypeModifier.SHARED);
        }
        assert(a.isOwned() && b.isOwned());
        return base.wrap(TypeModifier.INSTANCE | TypeModifier.OWNED);
      }
    }
    return null;
  }
}
