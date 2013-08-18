class Symbol {
  node: Declaration = null;
  enclosingStruct: StructType = null;

  constructor(
    public name: string,
    public type: WrappedType,
    public scope: Scope) {
  }
}

class Scope {
  symbols: Symbol[] = [];

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
      if (symbol.name === name) return symbol;
    }
    return null;
  }

  lexicalFind(name: string): Symbol {
    var symbol: Symbol = this.find(name);
    if (symbol === null && this.lexicalParent !== null) {
      symbol = this.lexicalParent.lexicalFind(name);
    }
    return symbol;
  }
}
