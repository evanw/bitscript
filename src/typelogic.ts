class TypeLogic {
  static equal(a: Type, b: Type): boolean {
    if (a === b) return true;
    return false;
  }

  static canImplicitlyConvert(from: WrappedType, to: WrappedType): boolean {
    var f: Type = from.innerType;
    var t: Type = to.innerType;
    return (
      TypeLogic.equal(f, t) ||
      f === SpecialType.INT && t === SpecialType.DOUBLE
    ) && (
      from.isOwned() && (to.isOwned() || to.isShared()) ||
      from.isShared() && to.isShared() ||
      !from.isOwned() && !from.isShared() && !to.isOwned() && !to.isShared()
    );
  }
}
