class TypeLogic {
  static equal(a: Type, b: Type): boolean {
    if (a === b) return true;
    return false;
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

  static checkImplicitlyConversionTypes(from: WrappedType, to: WrappedType): boolean {
    var f: Type = from.innerType;
    var t: Type = to.innerType;
    if (f === SpecialType.INT && t === SpecialType.DOUBLE) return true;
    if (f === SpecialType.NULL && to.isPointer()) return true;
    if (f instanceof ObjectType && t instanceof ObjectType) {
      return TypeLogic.isBaseTypeOf(<ObjectType>f, <ObjectType>t); // Upcasting is implicit
    }
    return TypeLogic.equal(f, t);
  }

  static checkImplicitlyConversionModifiers(from: WrappedType, to: WrappedType): boolean {
    if (from.isRawPointer() && to.isRawPointer()) return true;
    if (from.isOwned() && to.isPointer()) return true;
    if (from.isShared() && to.isPointer() && !to.isOwned()) return true;
    if (from.isPrimitive() && to.isPrimitive()) return true;
    return false;
  }

  static canImplicitlyConvert(from: WrappedType, to: WrappedType): boolean {
    return TypeLogic.checkImplicitlyConversionTypes(from, to) &&
           TypeLogic.checkImplicitlyConversionModifiers(from, to);
  }
}
