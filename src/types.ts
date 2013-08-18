class Modifier {
  static REF: number = 1; // Is a plain pointer
  static OWNED: number = 2; // Is a unique pointer
  static SHARED: number = 4; // Is a reference-counted pointer
  static STORAGE: number = 8; // Can this be stored to (is this an L-value)?
  static INSTANCE: number = 16; // Is this an instance of the type instead of the type itself?
}

class Type {
  wrap(modifiers: number): WrappedType {
    return new WrappedType(this, modifiers);
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

class StructType extends Type {
  constructorType: FunctionType = null;

  constructor(
    public name: string,
    public scope: Scope) {
    super();
  }

  asString(): string {
    return this.name;
  }
}

class WrappedType {
  constructor(
    public innerType: Type,
    public modifiers: number) {
    assert(innerType !== null);
  }

  isRef(): boolean {
    return (this.modifiers & Modifier.REF) !== 0;
  }

  isOwned(): boolean {
    return (this.modifiers & Modifier.OWNED) !== 0;
  }

  isShared(): boolean {
    return (this.modifiers & Modifier.SHARED) !== 0;
  }

  isStorage(): boolean {
    return (this.modifiers & Modifier.STORAGE) !== 0;
  }

  isInstance(): boolean {
    return (this.modifiers & Modifier.INSTANCE) !== 0;
  }

  isPointer(): boolean {
    return (this.modifiers & (Modifier.REF | Modifier.OWNED | Modifier.SHARED)) !== 0;
  }

  isError(): boolean {
    return this.innerType === SpecialType.ERROR;
  }

  isCircular(): boolean {
    return this.innerType === SpecialType.CIRCULAR;
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

  isStruct(): boolean {
    return this.innerType instanceof StructType;
  }

  isFunction(): boolean {
    return this.innerType instanceof FunctionType;
  }

  asStruct(): StructType {
    return this.innerType instanceof StructType ? <StructType>this.innerType : null;
  }

  asFunction(): FunctionType {
    return this.innerType instanceof FunctionType ? <FunctionType>this.innerType : null;
  }

  asString(): string {
    return (
      (this.modifiers & Modifier.REF ? 'ref ' : '') +
      (this.modifiers & Modifier.OWNED ? 'owned ' : '') +
      (this.modifiers & Modifier.SHARED ? 'shared ' : '') +
      this.innerType.asString()
    );
  }

  toString(): string {
    return (this.modifiers & Modifier.INSTANCE ? 'value of type ' : 'type ') + this.asString();
  }

  wrapWith(flag: number): WrappedType {
    return new WrappedType(this.innerType, this.modifiers | flag);
  }
}
