enum SymbolModifier {
  OVER = 1, // Is this symbol hiding another symbol from the base type?
  FINAL = 2, // Are assignments to this symbol disallowed?
  STATIC = 4, // Is this symbol defined on the type itself instead of an instance?
}

class Symbol {
  modifiers: number = 0;
  node: Declaration = null;
  enclosingObject: ObjectType = null;
  overriddenSymbol: Symbol = null;
  overriddenBySymbols: Symbol[] = [];
  isAbstract: boolean = false;
  isArgument: boolean = false;

  // This means the byte offset in the object for object fields and the
  // byte offset in the object's vtable for virtual member functions.
  byteOffset: number = 0;

  constructor(
    public name: string,
    public type: WrappedType,
    public scope: Scope) {
  }

  isOver(): boolean {
    return (this.modifiers & SymbolModifier.OVER) !== 0;
  }

  isFinal(): boolean {
    return (this.modifiers & SymbolModifier.FINAL) !== 0;
  }

  isStatic(): boolean {
    return (this.modifiers & SymbolModifier.STATIC) !== 0;
  }

  isOverridden(): boolean {
    return this.overriddenBySymbols.length > 0;
  }

  isVirtual(): boolean {
    return this.isAbstract || this.isOver() || this.isOverridden();
  }

  originalOverriddenSymbol(): Symbol {
    var symbol: Symbol = this.overriddenSymbol;
    while (symbol !== null && symbol.overriddenSymbol !== null) {
      symbol = symbol.overriddenSymbol;
    }
    return symbol;
  }
}

class Scope {
  // Note: All symbols are prefixed with ' ' to avoid collisions with native properties (i.e. __proto__)
  private _symbols: { [name: string]: Symbol } = {};

  constructor(
    public lexicalParent: Scope) {
  }

  symbols(): Symbol[] {
    var symbols: Symbol[] = [];
    for (var name in this._symbols) {
      if (name[0] === ' ') {
        symbols.push(this._symbols[name]);
      }
    }
    return symbols;
  }

  containsAbstractSymbols(): boolean {
    return this.symbols().some(s => s.isAbstract);
  }

  replace(symbol: Symbol) {
    this._symbols[' ' + symbol.name] = symbol;
  }

  find(name: string): Symbol {
    return this._symbols[' ' + name] || null;
  }

  lexicalFind(name: string): Symbol {
    var symbol: Symbol = this.find(name);
    if (symbol === null && this.lexicalParent !== null) {
      return this.lexicalParent.lexicalFind(name);
    }
    return symbol;
  }
}
