enum LibraryJS {
  EXTENDS,
  MATH_IMUL,
  LIST_ASSIGN,
}

class LibraryDataJS {
  private isNeeded: { [index: number]: boolean } = {};

  need(flag: LibraryJS) {
    this.isNeeded[flag] = true;
  }

  generate(): Object[] {
    var result: Object[] = [];

    if (this.isNeeded[LibraryJS.EXTENDS]) {
      result = result.concat(esprima.parse([
        'function __extends(d, b) {',
        '  function c() {}',
        '  c.prototype = b.prototype;',
        '  d.prototype = new c();',
        '  d.prototype.constructor = d;',
        '}',
      ].join('\n')).body);
    }

    if (this.isNeeded[LibraryJS.MATH_IMUL]) {
      result = result.concat(esprima.parse([
        'if (!Math.imul) {',
        '  Math.imul = function(a, b) {',
        '    var al = a & 0xFFFF, bl = b & 0xFFFF;',
        '    return al * bl + ((a >>> 16) * bl + al * (b >>> 16) << 16) | 0;',
        '  };',
        '}',
      ].join('\n')).body);
    }

    if (this.isNeeded[LibraryJS.LIST_ASSIGN]) {
      result = result.concat(esprima.parse([
        'function List$assign(to, from) {',
        '  to.length = 0;',
        '  for (var i = 0, n = from.length; i < n; i = i + 1 | 0) {',
        '    to[i] = from[i];',
        '  }',
        '  return to;',
        '}',
      ].join('\n')).body);
    }

    return result;
  }
}
