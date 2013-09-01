enum TypeModifier {
  OWNED = 1, // Is a unique pointer
  SHARED = 2, // Is a reference-counted pointer
  STORAGE = 4, // Can this be stored to (is this an L-value)?
  INSTANCE = 8, // Is this an instance of the type instead of the type itself?
  UNOWNED = 16, // Should this type parameter be stripped of OWNED here?
  UNSHARED = 32, // Should this type parameter be stripped of SHARED here?
}

class Type {
  parameters: TypeParameter[] = [];

  constructor(
    public byteAlignment: number,
    public byteSize: number) {
  }

  wrap(modifiers: number): WrappedType {
    return new WrappedType(this, modifiers, []);
  }

  asString(): string {
    assert(false);
    return '';
  }
}

class SpecialType extends Type {
  constructor(
    byteSize: number,
    public name: string) {
    super(byteSize, byteSize);
  }

  static INT: SpecialType = new SpecialType(4, 'int');
  static BOOL: SpecialType = new SpecialType(1, 'bool');
  static NULL: SpecialType = new SpecialType(4, 'null');
  static VOID: SpecialType = new SpecialType(0, 'void');
  static ERROR: SpecialType = new SpecialType(0, '<error>');
  static DOUBLE: SpecialType = new SpecialType(8, 'double');
  static CIRCULAR: SpecialType = new SpecialType(0, '<circular>');

  asString(): string {
    return this.name;
  }
}

class FunctionType extends Type {
  constructor(
    public result: WrappedType,
    public args: WrappedType[]) {
    super(0, 0);
  }

  asString(): string {
    return this.result.asString() + ' function(' + this.args.map(t => t.asString()).join(', ') + ')';
  }
}

class ObjectType extends Type {
  lazyInitializer: () => void = null;
  _constructorType: FunctionType = null;
  baseType: ObjectType = null;
  vtableByteOffset: number = 0;
  vtable: Symbol[] = [];

  // Does some other object type have this as a base?
  hasDerivedTypes: boolean = false;

  // Does this object type have a (possibly inherited) function without a body?
  _isAbstract: boolean = false;

  // Is this object type allowed to be the base class of another object type?
  isSealed: boolean = false;

  constructor(
    public name: string,
    public scope: Scope) {
    super(0, 0);
  }

  // Lazily compute the constructor type when it's needed instead of when the
  // class is first initialized to get around tricky ordering problems:
  //
  //   class A { C c; }
  //   class B : A {}
  //   class C { B b; }
  //
  ensureIsInitialized() {
    if (this.lazyInitializer !== null) {
      this.lazyInitializer();
      this.lazyInitializer = null;
    }
  }

  isAbstract(): boolean {
    this.ensureIsInitialized();
    return this._isAbstract;
  }

  constructorType(): FunctionType {
    this.ensureIsInitialized();
    return this._constructorType;
  }

  asString(): string {
    return this.name;
  }

  needsVTable(): boolean {
    return this.vtable.length !== 0;
  }
}

class TypeParameter extends Type {
  constructor(
    public name: string) {
    super(4, 4); // All type parameters are pointers
  }

  asString(): string {
    return this.name;
  }
}

class Substitution {
  constructor(
    public parameter: TypeParameter,
    public type: WrappedType) {
  }
}

class WrappedType {
  constructor(
    public innerType: Type,
    public modifiers: number,
    public substitutions: Substitution[]) {
    assert(innerType !== null);
  }

  isOwned(): boolean {
    return (this.modifiers & TypeModifier.OWNED) !== 0;
  }

  isShared(): boolean {
    return (this.modifiers & TypeModifier.SHARED) !== 0;
  }

  isStorage(): boolean {
    return (this.modifiers & TypeModifier.STORAGE) !== 0;
  }

  isInstance(): boolean {
    return (this.modifiers & TypeModifier.INSTANCE) !== 0;
  }

  isUnowned(): boolean {
    return (this.modifiers & TypeModifier.UNOWNED) !== 0;
  }

  isUnshared(): boolean {
    return (this.modifiers & TypeModifier.UNSHARED) !== 0;
  }

  isPointer(): boolean {
    return this.isObject() || this.isNull();
  }

  isRawPointer(): boolean {
    return this.isPointer() && !this.isOwned() && !this.isShared();
  }

  isError(): boolean {
    return this.innerType === SpecialType.ERROR;
  }

  isCircular(): boolean {
    return this.innerType === SpecialType.CIRCULAR;
  }

  isNull(): boolean {
    return this.innerType === SpecialType.NULL;
  }

  isVoid(): boolean {
    return this.innerType === SpecialType.VOID;
  }

  isInt(): boolean {
    return this.innerType === SpecialType.INT;
  }

  isDouble(): boolean {
    return this.innerType === SpecialType.DOUBLE;
  }

  isBool(): boolean {
    return this.innerType === SpecialType.BOOL;
  }

  isPrimitive(): boolean {
    return this.isInt() || this.isDouble() || this.isBool();
  }

  isObject(): boolean {
    return this.innerType instanceof ObjectType;
  }

  isFunction(): boolean {
    return this.innerType instanceof FunctionType;
  }

  asObject(): ObjectType {
    return this.innerType instanceof ObjectType ? <ObjectType>this.innerType : null;
  }

  asFunction(): FunctionType {
    return this.innerType instanceof FunctionType ? <FunctionType>this.innerType : null;
  }

  byteAlignment(): number {
    return this.isPointer() ? 4 : this.innerType.byteAlignment;
  }

  byteSize(): number {
    return this.isPointer() ? 4 : this.innerType.byteSize;
  }

  asString(): string {
    return (
      (this.modifiers & TypeModifier.OWNED ? 'owned ' : '') +
      (this.modifiers & TypeModifier.SHARED ? 'shared ' : '') +
      this.innerType.asString() +
      (this.substitutions.length > 0 ? '<' + TypeLogic.filterSubstitutionsForType(
        this.substitutions, this.innerType).map(s => s.type.asString()).join(', ') + '>' : '')
    );
  }

  toString(): string {
    return (this.modifiers & TypeModifier.INSTANCE ? (this.isPointer() ? 'pointer' : 'value') + ' of type ' : 'type ') + this.asString();
  }

  wrapWith(flag: number): WrappedType {
    return new WrappedType(this.innerType, this.modifiers | flag, this.substitutions);
  }

  wrapWithout(flag: number): WrappedType {
    return new WrappedType(this.innerType, this.modifiers & ~flag, this.substitutions);
  }
}
