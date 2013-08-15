class Token {
  constructor(
    public range: TRange,
    public kind: string,
    public text: string) {
  }
}

function tokenize(log: Log, source: Source): Token[] {
  // Lists for tokenizing
  var operators: string[] = [
    '\\(', '\\)', '\\{', '\\}', '\\[', '\\]',
    '\\.', '~', ',', ';', '\\?', ':',
    '\\+\\+', '--', '&&', '\\|\\|',
    '\\+=', '-=', '\\*=', '/=', '%=', '&=', '\\|=', '\\^=', '>>>=', '<<=', '>>=',
    '\\+', '-', '\\*', '/', '%', '&', '\\|', '\\^', '>>>', '<<', '>>',
    '!=', '==', '<=', '>=', '<', '>', '!', '=',
  ];
  var keywords: string[] = [
    'if', 'else', 'while', 'continue', 'break', 'return',
    'struct', 'true', 'false', 'null', 'new',
    'owned', 'nullable', 'shared',
  ];

  // Regular expressions for tokenizing
  var splitter: RegExp = new RegExp('(' + [
    '\\n',
    '//.*',
    '[ \\t]+',
    '(?:\\b)[0-9]+(?:\\.[0-9]+)?\\b',
    '\\b[A-Za-z_][A-Za-z\\$_0-9]*',
    '(?:' + operators.join('|') + ')',
  ].join('|') + ')');
  var isSpace: RegExp = new RegExp('^(?:[\\n \\t]|//|$)');
  var isDouble: RegExp = new RegExp('^[0-9]');
  var isIdent: RegExp = new RegExp('^[A-Za-z\\_]');
  var isKeyword: RegExp = new RegExp('^(?:' + keywords.join('|') + ')$');

  // Do most of the lexing with the runtime's built-in regular expression JIT
  var parts: string[] = source.contents.split(splitter);
  var tokens: Token[] = [];
  var empty: boolean = true;
  var i: number = 0;
  var line: number = 1;
  var index: number = 0;
  var columnAdjust: number = 1;

  // Extract tokens from the split results
  while (i < parts.length) {
    var part: string = parts[i];
    var length: number = part.length;
    i++;

    // Every other part should be empty
    if (empty) {
      empty = false;
      if (length > 0) {
        var start: Marker = new Marker(index, line, index + columnAdjust);
        var end: Marker = new Marker(index + length, line, index + length + columnAdjust);
        syntaxErrorExtraData(log, new TRange(source, start, end), part);
      }
      index += length;
      continue;
    }
    empty = true;

    // Decode the matched part (more frequent parts are tested earlier for efficiency)
    var kind: string = part;
    if (isSpace.test(part)) {
      index += length;
      if (part === '\n') {
        columnAdjust = 1 - index;
        line++;
      }
      continue;
    }
    else if (isIdent.test(part)) { if (!isKeyword.test(part)) kind = 'IDENTIFIER'; }
    else if (isDouble.test(part)) kind = part.indexOf('.') >= 0 ? 'DOUBLE' : 'INT';

    // Create the new token
    var start: Marker = new Marker(index, line, index + columnAdjust);
    var end: Marker = new Marker(index + length, line, index + length + columnAdjust);
    tokens.push(new Token(new TRange(source, start, end), kind, part));
    index += length;
  }

  // Every token stream ends in END
  var marker: Marker = new Marker(index, line, index + columnAdjust);
  tokens.push(new Token(new TRange(source, marker, marker), 'END', ''));
  return tokens;
}
