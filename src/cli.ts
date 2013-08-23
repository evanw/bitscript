function cli() {
  var inputs: string[] = [];
  var outputJS: any = null;
  var outputCPP: any = null;
  var helpFlag: boolean = false;
  var watchFlag: boolean = false;

  var fs: any = require('fs');
  var tty: any = require('tty');
  var path: any = require('path');
  var notifier: any = require('terminal-notifier');
  var useColors: boolean = tty.isatty(1) && tty.isatty(2);

  function time(): string {
    var now: Date = new Date();
    if (!watchFlag) return '';
    return ((now.getHours() % 12 + 11) % 12 + 1) + ':' +
      (100 + now.getMinutes()).toString().slice(1) +
      ['am', 'pm'][now.getHours() / 12 | 0] +
      ' - ';
  }

  function indent(text: string): string {
    return '  ' + text.replace(/\n/g, '\n  ');
  }

  function wrapColor(color: number): (text: string) => string {
    if (!useColors) return text => { return text; };
    return text => { return '\u001b[' + color + 'm' + text + '\u001b[0m'; };
  }

  var gray: (text: string) => string = wrapColor(90);
  var red: (text: string) => string = wrapColor(91);
  var green: (text: string) => string = wrapColor(92);

  function showNotification(diagnostic: Diagnostic) {
    if (!watchFlag) return;
    var options: any = {
      title: diagnostic.range !== null ? diagnostic.range.source.name + ' on line ' + diagnostic.range.start.line : 'Build error',
      group: 'bitscript'
    };
    if (diagnostic.range !== null && process.env.EDITOR) {
      options.execute = process.env.EDITOR + ' "' + path.resolve(diagnostic.range.source.name) + ':' + diagnostic.range.start.line + '"';
    }
    notifier(diagnostic.text, options);
  }

  function compile() {
    var compiler = new Compiler();
    inputs.forEach(input => compiler.addSource(input, fs.readFileSync(input, 'utf8')));
    compiler.compile();

    if (compiler.log.errorCount === 0) {
      if (outputJS !== null) fs.writeFileSync(outputJS, OutputJS.generate(compiler.module) + '\n');
      if (outputCPP !== null) fs.writeFileSync(outputCPP, OutputCPP.generate(compiler.module) + '\n');
      console.log(gray(time() + 'build successful'));
      return true;
    }

    if (outputJS !== null && fs.existsSync(outputJS)) fs.unlinkSync(outputJS);
    if (outputCPP !== null && fs.existsSync(outputCPP)) fs.unlinkSync(outputCPP);
    if (watchFlag) showNotification(compiler.log.diagnostics[0]);

    // Use fancy colored output for TTYs
    console.log(gray(time() + 'build failed\n\n') + indent(compiler.log.diagnostics.map(d => {
      var parts = d.range.sourceString().split('\n');
      return gray(d.type + ' on line ' + d.range.start.line + ' of ' + d.range.source.name + ': ') + red(d.text) + '\n\n' + parts[0] + '\n' + green(parts[1]) + '\n';
    }).join('\n')));
    return false;
  }

  // Return a unique string that will change when one of the files changes
  function stat(): string {
    return inputs.map(input => input + fs.statSync(input).mtime).join('\n');
  }

  function usage() {
    console.log([
      '',
      'usage: bitc in1.bit in2.bit ... [--js out.js] [--cpp out.cpp] [--watch]',
      '',
    ].join('\n'));
  }

  // Parse command-line flags
  var args = process.argv.slice(2);
  while (args.length > 0) {
    var arg = args.shift();
    switch (arg) {
      case '-h': case '--help': helpFlag = true; break;
      case '--watch': watchFlag = true; break;
      case '--js': outputJS = args.shift(); break;
      case '--cpp': outputCPP = args.shift(); break;
      default: inputs.push(arg); break;
    }
  }

  // Validate command-line flags
  if (helpFlag || outputJS === void 0 || outputCPP === void 0 || inputs.length === 0 || outputJS === null && outputCPP === null) {
    usage();
    process.exit(1);
  }

  // Main compilation logic
  if (!watchFlag) process.exit(compile() ? 0 : 1);
  var oldStat: string = stat();
  compile();
  setInterval(() => {
    var newStat = stat();
    if (oldStat !== newStat) {
      oldStat = newStat;
      compile();
    }
  }, 100);
}

if (typeof window === 'undefined') cli();
