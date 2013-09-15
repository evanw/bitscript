enum LibraryJS {
}

class LibraryDataJS {
  private isNeeded: { [index: number]: boolean } = {};

  need(flag: LibraryJS) {
    this.isNeeded[flag] = true;
  }

  generate(): Object[] {
    return [];
  }
}
