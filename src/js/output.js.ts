class OutputJS {
  static generate(node: Module): string {
    return '';
  }

  static generateWithSourceMap(node: Module, root: string): { code: string; map: string } {
    return { code: '', map: '' };
  }
}
