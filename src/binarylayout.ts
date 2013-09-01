class BinaryLayout {
  static run(node: Module) {
    // Find all user-defined object types
    var objectTypes: ObjectType[] = node.block.sortedObjectDeclarations().map(n => n.symbol.type.asObject());

    // All classes with the same original base class should have the same
    // alignment because of polymorphism. Figure out alignment in two phases:
    //
    //   1) Compute the maximum alignment of all symbols
    //   2) Propagate that alignment up to the base classes
    //
    // This needs to be done using one pass up and one pass down the base class
    // tree because siblings may have alignments that are different but are both
    // larger than their common parent. All three classes need to have the same
    // alignment in this case regardless of declaration order.
    //
    // TODO: Do all three classes need to have the same alignment in this case?
    // Making them the same is definitely safe, but is it actually needed?
    objectTypes.forEach(BinaryLayout.computeAlignment);
    objectTypes.forEach(BinaryLayout.propagateAlignmentToBase);
    objectTypes.forEach(BinaryLayout.computeVTable);
    objectTypes.forEach(BinaryLayout.computeSize);
  }

  // Each object's alignment is the maximum of every field's alignment
  static computeAlignment(objectType: ObjectType) {
    // This should only be run once per object type
    assert(objectType.byteAlignment === 0);

    // Objects must not be empty
    objectType.byteAlignment = 1;

    // Objects must be aligned to their base type
    if (objectType.baseType !== null) {
      objectType.byteAlignment = Math.max(objectType.baseType.byteAlignment, objectType.byteAlignment);
    }

    // Objects must be aligned to the maximum alignment of each member
    objectType.scope.forEachSymbol(symbol => {
      objectType.byteAlignment = Math.max(objectType.byteAlignment, symbol.type.byteAlignment());
      return ForEachSymbol.CONTINUE;
    });
  }

  static propagateAlignmentToBase(objectType: ObjectType) {
    for (var baseType: ObjectType = objectType.baseType; baseType !== null; baseType = baseType.baseType) {
      baseType.byteAlignment = Math.max(baseType.byteAlignment, objectType.byteAlignment);
    }
  }

  static computeVTable(objectType: ObjectType) {
    // This should only be run once per object type
    assert(objectType.vtable.length === 0);

    // Start off with the size of the parent's vtable
    if (objectType.baseType !== null) {
      objectType.vtable = objectType.baseType.vtable.slice(0);
    }

    // Give each new symbol a vtable slot and match up each overridden symbol
    objectType.scope.forEachSymbol(symbol => {
      // Only look at virtual symbols (which are all functions)
      if (!symbol.isVirtual()) {
        return ForEachSymbol.CONTINUE;
      }

      // Overridden symbols reuse the same vtable slot
      if (symbol.overriddenSymbol !== null) {
        symbol.byteOffset = symbol.overriddenSymbol.byteOffset;
        objectType.vtable[symbol.byteOffset >> 2] = symbol;
      }

      // Other symbols create a new vtable slot
      else {
        symbol.byteOffset = objectType.vtable.length << 2;
        objectType.vtable.push(symbol);
      }

      return ForEachSymbol.CONTINUE;
    });
  }

  static computeSize(objectType: ObjectType) {
    // This should only be run once per object type
    assert(objectType.byteSize === 0);
    assert(objectType.vtableByteOffset === 0);

    // The ObjectType array is sorted so the base class should have a size
    assert(objectType.baseType === null || objectType.baseType.byteSize !== 0);

    // Collect all symbols
    var symbols: Symbol[] = [];
    objectType.scope.forEachSymbol(symbol => {
      // Only take symbols from this scope, not base class scopes
      if (symbol.scope === objectType.scope && !symbol.type.isFunction()) {
        symbols.push(symbol);
      }
      return ForEachSymbol.CONTINUE;
    });

    // Stable sort symbols by decreasing alignment to pack them tightly
    // together (we might as well since we have no pointer arithmetic)
    stableSort(symbols, (a, b) => b.type.byteSize() - a.type.byteSize());

    // Start from the size of the base class if there is one
    var byteOffset: number = objectType.baseType !== null ? objectType.baseType.byteSize : 0;

    // Add a vtable pointer if the base class doesn't have one
    if (objectType.needsVTable() && (objectType.baseType === null || !objectType.baseType.needsVTable())) {
      objectType.vtableByteOffset = nextMultipleOf(byteOffset, 4);
      byteOffset = objectType.vtableByteOffset + 4;
    }

    // Give each symbol an offset with the correct alignment
    symbols.forEach(symbol => {
      var byteSize: number = symbol.type.byteSize();
      if (byteSize !== 0) {
        symbol.byteOffset = nextMultipleOf(byteOffset, symbol.type.byteAlignment());
        byteOffset = symbol.byteOffset + symbol.type.byteSize();
      }
    });

    // Round up the size of the object from the end of the last field
    objectType.byteSize = Math.max(1, nextMultipleOf(byteOffset, objectType.byteAlignment));
  }
}
