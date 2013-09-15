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
    return TypeLogic.equal(a.innerType, b.innerType) && a.kind === b.kind && a.modifiers === b.modifiers && a.substitutions.length === b.substitutions.length &&
      a.substitutions.every(sa => b.substitutions.some(sb => sa.parameter === sb.parameter && TypeLogic.equalWrapped(sa.type, sb.type)));
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
    if ((from.isInt() || from.isFloat()) && to.isDouble()) return true;
    if (from.isNull() && to.isPointer()) return true;
    if (from.isObject() && to.isObject()) {
      return TypeLogic.isBaseTypeOf(from.asObject(), to.asObject()) && // Upcasting is implicit
        from.isPointer() && to.isPointer() ||
        !from.isPointer() && !to.isPointer() && TypeLogic.equal(from.innerType, to.innerType); // Forbid slicing via copy
    }
    return TypeLogic.equal(from.innerType, to.innerType);
  }

  static checkImplicitConversionTypeModifiers(from: WrappedType, to: WrappedType): boolean {
    if (!from.isNull()) {
      if (from.substitutions.length !== to.substitutions.length) return false;
      if (from.substitutions.some(f => to.substitutions.every(t => f.parameter !== t.parameter || !TypeLogic.equalWrapped(f.type, t.type)))) return false;
    }
    return from.isPointer() === to.isPointer();
  }

  static canImplicitlyConvert(from: WrappedType, to: WrappedType): boolean {
    return TypeLogic.checkImplicitConversionTypes(from, to) &&
           TypeLogic.checkImplicitConversionTypeModifiers(from, to);
  }

  static canExplicitlyConvert(from: WrappedType, to: WrappedType): boolean {
    if (from.isNumeric() && to.isNumeric()) return true;
    if (from.isObject() && to.isObject()) {
      return TypeLogic.isBaseTypeOf(to.asObject(), from.asObject()) && // Downcasting is explicit
        from.isPointer() && to.isPointer() ||
        !from.isPointer() && !to.isPointer() && TypeLogic.equal(from.innerType, to.innerType); // Forbid slicing via copy
    }
    return TypeLogic.canImplicitlyConvert(from, to);
  }

  static commonImplicitType(a: WrappedType, b: WrappedType): WrappedType {
    if (TypeLogic.canImplicitlyConvert(a, b)) return b.withoutModifier(TypeModifier.STORAGE);
    if (TypeLogic.canImplicitlyConvert(b, a)) return a.withoutModifier(TypeModifier.STORAGE);
    if (a.isObject() && b.isObject()) {
      var base: ObjectType = TypeLogic.commonBaseType(a.asObject(), b.asObject());
      if (base !== null) {
        if (a.isPointer() || b.isPointer()) return base.wrapPointer();
        if (a.isReference() || b.isReference()) return base.wrapReference();
        return null;
      }
    }
    return null;
  }

  // static hasTypeParameters(type: WrappedType): boolean {
  //   return type.innerType.parameters.length > 0;
  // }

  // static isParameterized(type: WrappedType): boolean {
  //   if (TypeLogic.hasTypeParameters(type)) {
  //     // If a type has type parameters, make sure every parameter has a substitution
  //     if (type.innerType.parameters.some(p => !type.substitutions.some(s => s.parameter === p))) {
  //       return false;
  //     }

  //     // Recursively check the substitutions
  //     return type.substitutions.every(s => !TypeLogic.hasTypeParameters(s.type) || TypeLogic.isParameterized(s.type));
  //   }

  //   return false;
  // }

  static filterSubstitutionsForType(substitutions: Substitution[], type: Type): Substitution[] {
    return substitutions.filter(s => type.parameters.indexOf(s.parameter) >= 0);
  }

  // static substitute(type: WrappedType, substitutions: Substitution[]): WrappedType {
  //   if (substitutions.length === 0) {
  //     return type;
  //   }
  //   assert(type.substitutions.length === 0);

  //   if (type.innerType instanceof TypeParameter) {
  //     for (var i = 0; i < substitutions.length; i++) {
  //       var sub: Substitution = substitutions[i];
  //       if (type.innerType === sub.parameter) {
  //         var result: WrappedType = sub.type.withModifier(TypeModifier.INSTANCE);

  //         // Possibly strip owned before returning the substitution. We may need
  //         // to strip owned to maintain ownership. For example, lists of owned
  //         // pointers should not relinquish ownership just because they returned
  //         // a value from a getter.
  //         if (type.isUnowned() && result.isOwned()) {
  //           result.kind = TypeKind.REF;
  //         }

  //         return result;
  //       }
  //     }
  //   }

  //   if (type.innerType instanceof FunctionType) {
  //     var f: FunctionType = type.asFunction();
  //     return new WrappedType(type.kind, new FunctionType(
  //       TypeLogic.substitute(f.result, substitutions),
  //       f.args.map(t => TypeLogic.substitute(t, substitutions))
  //     ), type.modifiers, []);
  //   }

  //   if (type.innerType instanceof ObjectType) {
  //     var o: ObjectType = type.asObject();
  //     return new WrappedType(type.kind, o, type.modifiers, TypeLogic.filterSubstitutionsForType(substitutions, o));
  //   }

  //   return type;
  // }

  static isValidVariableType(type: WrappedType): boolean {
    return !type.isVoid() && (!type.isValue() || !type.isObject() || !type.asObject().isAbstract());
  }

  static hasDefaultConstructor(type: WrappedType): boolean {
    return type.isPointer() || type.isPrimitive() ||
      type.isObject() && type.isValue() && type.asObject().constructorType().args.length === 0;
  }
}
