class Modifier {
  static OWNED: number = 1;
  static SHARED: number = 2;
  static STORAGE: number = 4; // Can this be stored to (is this an L-value)?
  static NULLABLE: number = 8;
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

class StructType extends Type {
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

  isOwned(): boolean {
    return (this.modifiers & Modifier.OWNED) !== 0;
  }

  isShared(): boolean {
    return (this.modifiers & Modifier.SHARED) !== 0;
  }

  isStorage(): boolean {
    return (this.modifiers & Modifier.STORAGE) !== 0;
  }

  isNullable(): boolean {
    return (this.modifiers & Modifier.NULLABLE) !== 0;
  }

  isInstance(): boolean {
    return (this.modifiers & Modifier.INSTANCE) !== 0;
  }

  isError(): boolean {
    return this.innerType === SpecialType.ERROR;
  }

  isCircular(): boolean {
    return this.innerType === SpecialType.CIRCULAR;
  }

  asString(): string {
    return (
      (this.modifiers & Modifier.INSTANCE ? 'value of type ' : 'type ') +
      (this.modifiers & Modifier.OWNED ? 'owned ' : '') +
      (this.modifiers & Modifier.SHARED ? 'shared ' : '') +
      (this.modifiers & Modifier.NULLABLE ? 'nullable ' : '') +
      this.innerType.asString()
    );
  }

  wrapWith(flag: number): WrappedType {
    return new WrappedType(this.innerType, this.modifiers | flag);
  }
}
