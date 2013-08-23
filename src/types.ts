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
    public name: string) {
    super();
  }

  static INT: SpecialType = new SpecialType('int');
  static BOOL: SpecialType = new SpecialType('bool');
  static NULL: SpecialType = new SpecialType('null');
  static VOID: SpecialType = new SpecialType('void');
  static ERROR: SpecialType = new SpecialType('<error>');
  static DOUBLE: SpecialType = new SpecialType('double');
  static CIRCULAR: SpecialType = new SpecialType('<circular>');

  asString(): string {
    return this.name;
  }
}

class FunctionType extends Type {
  constructor(
    public result: WrappedType,
    public args: WrappedType[]) {
    super();
  }

  asString(): string {
    return this.result.asString() + ' function(' + this.args.map(t => t.asString()).join(', ') + ')';
  }
}

class ObjectType extends Type {
  lazyInitializer: () => void = null;
  _constructorType: FunctionType = null;
  baseType: ObjectType = null;

  // Does some other object type have this as a base?
  hasDerivedTypes: boolean = false;

  // Does this object type have a (possibly inherited) function without a body?
  _isAbstract: boolean = false;

  // Is this object type allowed to be the base class of another object type?
  isSealed: boolean = false;

  constructor(
    public name: string,
    public scope: Scope) {
    super();
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
}

class TypeParameter extends Type {
  constructor(
    public name: string) {
    super();
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
