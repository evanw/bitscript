enum SymbolModifier {
  OVER = 1, // Is this symbol hiding another symbol from the base type?
}

class Symbol {
  modifiers: number = 0;
  node: Declaration = null;
  enclosingObject: ObjectType = null;
  isOverridden: boolean = false;

  constructor(
    public name: string,
    public type: WrappedType,
    public scope: Scope) {
  }

  isOver(): boolean {
    return (this.modifiers & SymbolModifier.OVER) !== 0;
  }
}

class Scope {
  symbols: Symbol[] = [];
  baseParent: Scope = null;

  constructor(
    public lexicalParent: Scope) {
  }

  define(name: string, type: WrappedType): Symbol {
    var symbol: Symbol = new Symbol(name, type, this);
    this.symbols.push(symbol);
    return symbol;
  }

  find(name: string): Symbol {
    for (var i = 0; i < this.symbols.length; i++) {
      var symbol: Symbol = this.symbols[i];
      if (symbol.name === name) {
        return symbol;
      }
    }
    return null;
  }

  baseFind(name: string): Symbol {
    var symbol: Symbol = this.find(name);
    if (symbol !== null) {
      return symbol;
    }
    if (this.baseParent !== null) {
      return this.baseParent.find(name);
    }
    return null;
  }

  lexicalFind(name: string): Symbol {
    var symbol: Symbol = this.find(name);
    if (symbol === null && this.lexicalParent !== null) {
      return this.lexicalParent.lexicalFind(name);
    }
    return symbol;
  }
}
