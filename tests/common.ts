declare var it: any;
declare var require: any;

require('source-map-support').install();

function test(lines: string[], expected: string[]) {
  it(lines.join(' ').replace(/\s+/g, ' '), () => {
    var compiler = new Compiler(lines.join('\n'));
    require('assert').strictEqual(compiler.log.diagnostics.join('\n').trim(), expected.join('\n'));
  });
}
