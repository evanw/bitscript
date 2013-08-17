function assert(truth: boolean) {
  if (!truth) {
    throw new Error('assertion failed');
  }
}

function repeat(text: string, times: number): string {
  return new Array(times + 1).join(text);
}

function flatten(array: any[][]): any[] {
  return Array.prototype.concat.apply(Array.prototype, array);
}

class Source {
  lines: string[];

  constructor(
    public name: string,
    public contents: string) {
    this.lines = contents.split('\n');
  }
}

class Marker {
  constructor(
    public index: number,
    public line: number,
    public column: number) {
  }
}

class TRange {
  constructor(
    public source: Source,
    public start: Marker,
    public end: Marker) {
  }
}

class Diagnostic {
  constructor(
    public type: string,
    public range: TRange,
    public text: string) {
  }

  toString(): string {
    var source: Source = this.range.source;
    var start: Marker = this.range.start;
    var end: Marker = this.range.end;
    var line: string = source.lines[start.line - 1];
    var a: number = start.column - 1;
    var b: number = end.line === start.line ? end.column - 1 : line.length;
    return this.type + ' on line ' + start.line + ' of ' + source.name + ': ' + this.text +
      '\n\n' + line + '\n' + repeat(' ', a) + (b - a < 2 ? '^' : repeat('~', b - a)) + '\n';
  }
}

class Log {
  diagnostics: Diagnostic[] = [];
  hasErrors: boolean = false;

  error(range: TRange, text: string) {
    this.diagnostics.push(new Diagnostic('error', range, text));
    this.hasErrors = true;
  }

  warning(range: TRange, text: string) {
    this.diagnostics.push(new Diagnostic('warning', range, text));
  }
}
