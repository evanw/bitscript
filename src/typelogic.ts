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
    if (from.isInt() && to.isDouble()) return true;
    if (from.isNull() && to.isPointer()) return true;
    if (from.isObject() && to.isObject()) {
      return TypeLogic.isBaseTypeOf(from.asObject(), to.asObject()); // Upcasting is implicit
    }
    return TypeLogic.equal(from.innerType, to.innerType);
  }

  static checkImplicitConversionTypeModifiers(from: WrappedType, to: WrappedType): boolean {
    if (!from.isNull()) {
      if (from.substitutions.length !== to.substitutions.length) return false;
      if (from.substitutions.some(f => to.substitutions.every(t => f.parameter !== t.parameter || !TypeLogic.equalWrapped(f.type, t.type)))) return false;
    } else if (to.isPointer()) {
      return true;
    }
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
    if (TypeLogic.canImplicitlyConvert(a, b)) return b.wrapWithout(TypeModifier.STORAGE);
    if (TypeLogic.canImplicitlyConvert(b, a)) return a.wrapWithout(TypeModifier.STORAGE);
    if (a.isObject() && b.isObject()) {
      var base: ObjectType = TypeLogic.commonBaseType(a.asObject(), b.asObject());
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

  static hasTypeParameters(type: WrappedType): boolean {
    return type.innerType.parameters.length > 0;
  }

  static isParameterized(type: WrappedType): boolean {
    if (TypeLogic.hasTypeParameters(type)) {
      // If a type has type parameters, make sure every parameter has a substitution
      if (type.innerType.parameters.some(p => !type.substitutions.some(s => s.parameter === p))) {
        return false;
      }

      // Recursively check the substitutions
      return type.substitutions.every(s => !TypeLogic.hasTypeParameters(s.type) || TypeLogic.isParameterized(s.type));
    }

    return false;
  }

  static filterSubstitutionsForType(substitutions: Substitution[], type: Type): Substitution[] {
    return substitutions.filter(s => type.parameters.indexOf(s.parameter) >= 0);
  }

  static substitute(type: WrappedType, substitutions: Substitution[]): WrappedType {
    if (substitutions.length === 0) {
      return type;
    }
    assert(type.substitutions.length === 0);

    if (type.innerType instanceof TypeParameter) {
      for (var i = 0; i < substitutions.length; i++) {
        var sub: Substitution = substitutions[i];
        if (type.innerType === sub.parameter) {
          var result: WrappedType = sub.type.wrapWith(TypeModifier.INSTANCE);

          // Possibly strip owned before returning the substitution. We may need
          // to strip owned to maintain ownership. For example, lists of owned
          // pointers should not relinquish ownership just because they returned
          // a value from a getter.
          if (type.isUnowned()) {
            result.modifiers &= ~TypeModifier.OWNED;
          }

          // Stripping shared may also be useful for performance reasons
          if (type.isUnshared()) {
            result.modifiers &= ~TypeModifier.SHARED;
          }

          return result;
        }
      }
    }

    if (type.innerType instanceof FunctionType) {
      var f: FunctionType = type.asFunction();
      return new WrappedType(new FunctionType(
        TypeLogic.substitute(f.result, substitutions),
        f.args.map(t => TypeLogic.substitute(t, substitutions))
      ), type.modifiers, []);
    }

    if (type.innerType instanceof ObjectType) {
      var o: ObjectType = type.asObject();
      return new WrappedType(o, type.modifiers, TypeLogic.filterSubstitutionsForType(substitutions, o));
    }

    return type;
  }
}
