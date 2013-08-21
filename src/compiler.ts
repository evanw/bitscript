class Compiler {
  log: Log = new Log();
  sources: Source[] = [];
  tokens: Token[] = [];
  module: Module = null;

  addSource(fileName: string, input: string) {
    this.sources.push(new Source(fileName, input));
  }

  compile() {
    // Tokenize and parse each module individually
    var modules: Module[] = this.sources.map(source => {
      var errorCount: number = this.log.errorCount;
      var tokens: Token[] = prepareTokens(tokenize(this.log, source));
      this.tokens = this.tokens.concat(tokens);
      return this.log.errorCount === errorCount ? parse(this.log, tokens) : null;
    });
    if (this.log.errorCount > 0) return;

    // Create one module and resolve everything together
    this.module = new Module(null, new Block(null, flatten(modules.map(n => n.block.statements))));
    Resolver.resolve(this.log, this.module);
  }
}
