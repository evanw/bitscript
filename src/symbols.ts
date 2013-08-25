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

enum ForEachSymbol {
  CONTINUE,
  BREAK,
}

class Scope {
  // Note: All symbols are prefixed with ' ' to avoid collisions with native properties (i.e. __proto__)
  private symbols: { [name: string]: Symbol } = {};

  constructor(
    public lexicalParent: Scope) {
  }

  // Return true for continue, false for break
  forEachSymbol(callback: (symbol: Symbol) => ForEachSymbol) {
    for (var name in this.symbols) {
      if (name[0] === ' ' && callback(this.symbols[name]) === ForEachSymbol.BREAK) {
        break;
      }
    }
  }

  containsAbstractSymbols(): boolean {
    var isAbstract: boolean = false;
    this.forEachSymbol(s => {
      if (s.isAbstract) isAbstract = true;
      return isAbstract ? ForEachSymbol.BREAK : ForEachSymbol.CONTINUE;
    });
    return isAbstract;
  }

  replace(symbol: Symbol) {
    this.symbols[' ' + symbol.name] = symbol;
  }

  define(name: string, type: WrappedType): Symbol {
    return this.symbols[' ' + name] = new Symbol(name, type, this);
  }

  find(name: string): Symbol {
    return this.symbols[' ' + name] || null;
  }

  lexicalFind(name: string): Symbol {
    var symbol: Symbol = this.find(name);
    if (symbol === null && this.lexicalParent !== null) {
      return this.lexicalParent.lexicalFind(name);
    }
    return symbol;
  }
}
