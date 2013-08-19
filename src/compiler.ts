class Compiler {
  log: Log = new Log();
  tokens: Token[] = null;
  module: Module = null;

  constructor(input: string) {
    var source: Source = new Source('<stdin>', input);

    // Tokenize
    this.tokens = prepareTokens(tokenize(this.log, source));
    if (this.log.hasErrors) return;

    // Parse
    this.module = parse(this.log, this.tokens);
    if (this.log.hasErrors) return;

    // Resolve
    Resolver.resolve(this.log, this.module);
    if (this.log.hasErrors) return;
  }
}
