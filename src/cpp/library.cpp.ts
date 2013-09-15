enum LibraryCPP {
}

class LibraryDataCPP {
  private isNeeded: { [index: number]: boolean } = {};

  need(flag: LibraryCPP) {
    this.isNeeded[flag] = true;
  }

  generate(): Object[] {
    return [];
  }
}
