class BinaryLayout {
  static run(node: Module) {
    // Find all user-defined object types
    var objectTypes: ObjectType[] = node.block.statements
      .filter(n => n instanceof ObjectDeclaration)
      .map(n => (<ObjectDeclaration>n).symbol.type.asObject());

    // All classes with the same original base class should have the same
    // alignment because of polymorphism. Figure out alignment in three phases:
    //
    //   1) Compute the maximum alignment of all symbols
    //   2) Propagate that alignment up to the base classes
    //   3) Propagate the alignment down from the base classes
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
    objectTypes.forEach(BinaryLayout.propagateAlignmentFromBase);

    // Now that we have the alignments computed, we can layout each object
    objectTypes.forEach(BinaryLayout.ensureObjectTypeHasLayout);
  }

  // Each object's alignment is the maximum of every field's alignment
  static computeAlignment(objectType: ObjectType) {
    objectType.byteAlignment = 1; // Objects must not be empty
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

  static propagateAlignmentFromBase(objectType: ObjectType) {
    for (var baseType: ObjectType = objectType.baseType; baseType !== null; baseType = baseType.baseType) {
      objectType.byteAlignment = Math.max(baseType.byteAlignment, objectType.byteAlignment);
    }
  }

  static ensureObjectTypeHasLayout(objectType: ObjectType) {
    // Only layout each object type once
    if (objectType.byteSize !== 0) {
      return;
    }

    // Ensure the base type has a layout first
    if (objectType.baseType !== null) {
      BinaryLayout.ensureObjectTypeHasLayout(objectType.baseType);
    }

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

    // Start from the size of the base class
    var byteOffset: number = objectType.baseType !== null ? objectType.baseType.byteSize : 0;

    // Give each symbol an offset with the correct alignment
    symbols.forEach(symbol => {
      symbol.byteOffset = nextMultipleOf(byteOffset, symbol.type.byteAlignment());
      byteOffset = symbol.byteOffset + symbol.type.byteSize();
    });

    // Round up the size of the object from the end of the last field
    objectType.byteSize = nextMultipleOf(byteOffset, objectType.byteAlignment);
  }
}
