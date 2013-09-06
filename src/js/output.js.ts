class OutputJS {
  static generate(node: Module, moduleName: string): string {
    return '';
  }

  static generateWithSourceMap(node: Module, moduleName: string): { code: string; map: string } {
    return { code: '', map: '' };
  }
}
