declare var usr: any;
declare var module: any;
declare var exports: any;
declare var require: any;
declare var process: any;

var usr_bin_env_node; // This will turn into '#!/usr/bin/env node' but must be here to reserve the line in the source map

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

class SourceRange {
  constructor(
    public source: Source,
    public start: Marker,
    public end: Marker) {
  }

  locationString(): string {
    return 'on line ' + this.start.line + ' of ' + this.source.name;
  }

  sourceString(): string {
    var line: string = this.source.lines[this.start.line - 1];
    var a: number = this.start.column - 1;
    var b: number = this.end.line === this.start.line ? this.end.column - 1 : line.length;
    return line + '\n' + repeat(' ', a) + (b - a < 2 ? '^' : repeat('~', b - a));
  }
}

class Diagnostic {
  constructor(
    public type: string,
    public range: SourceRange,
    public text: string) {
  }

  toString(): string {
    return this.type + ' ' + this.range.locationString() + ': ' + this.text + '\n\n' + this.range.sourceString();
  }
}

class Log {
  diagnostics: Diagnostic[] = [];
  errorCount: number = 0;

  error(range: SourceRange, text: string) {
    this.diagnostics.push(new Diagnostic('error', range, text));
    this.errorCount++;
  }

  warning(range: SourceRange, text: string) {
    this.diagnostics.push(new Diagnostic('warning', range, text));
  }
}
