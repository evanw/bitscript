enum SymbolModifier {
  OVER = 1, // Is this symbol hiding another symbol from the base type?
}

class Symbol {
  modifiers: number = 0;
  node: Declaration = null;
  enclosingObject: ObjectType = null;
  isOverridden: boolean = false;
  isAbstract: boolean = false;

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

  constructor(
    public lexicalParent: Scope) {
  }

  containsAbstractSymbols(): boolean {
    for (var i = 0; i < this.symbols.length; i++) {
      if (this.symbols[i].isAbstract) return true;
    }
    return false;
  }

  replace(symbol: Symbol) {
    for (var i = 0; i < this.symbols.length; i++) {
      if (this.symbols[i].name === symbol.name) {
        this.symbols[i] = symbol;
        return;
      }
    }
    this.symbols.push(symbol);
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

  lexicalFind(name: string): Symbol {
    var symbol: Symbol = this.find(name);
    if (symbol === null && this.lexicalParent !== null) {
      return this.lexicalParent.lexicalFind(name);
    }
    return symbol;
  }
}
