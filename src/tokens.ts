class Token {
  constructor(
    public range: SourceRange,
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
    'class', 'true', 'false', 'null', 'new', 'this',
    'owned', 'shared', 'over',
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
        syntaxErrorExtraData(log, new SourceRange(source, start, end), part);
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
    tokens.push(new Token(new SourceRange(source, start, end), kind, part));
    index += length;
  }

  // Every token stream ends in END
  var marker: Marker = new Marker(index, line, index + columnAdjust);
  tokens.push(new Token(new SourceRange(source, marker, marker), 'END', ''));
  return tokens;
}

function prepareTokens(tokens: Token[]): Token[] {
  var tokenStack: Token[] = [];
  var indexStack: number[] = [];

nextToken:
  for (var i = 0; i < tokens.length; i++) {
    var token: Token = tokens[i];

    // Remove tokens on the stack if they aren't working out
    while (tokenStack.length > 0) {
      var top: Token = tokenStack[tokenStack.length - 1];

      // Stop parsing a type if we find a token that no type expression uses
      if (top.kind === '<' && token.kind !== '<' && token.kind[0] !== '>' && token.kind !== 'IDENTIFIER' &&
          token.kind !== ',' && token.kind !== 'owned' && token.kind !== 'shared') {
        tokenStack.pop();
        indexStack.pop();
      } else {
        break;
      }
    }

    // Group open
    if (token.kind === '(' || token.kind === '{' || token.kind === '[' || token.kind === '<') {
      tokenStack.push(token);
      indexStack.push(i);
      continue;
    }

    // Group close
    if (token.kind === ')' || token.kind === '}' || token.kind === ']' || token.kind[0] === '>') {
      // Search for a matching opposite token
      while (tokenStack.length > 0) {
        var top: Token = tokenStack[tokenStack.length - 1];

        // Don't match closing angle brackets that don't work since they are just operators
        if (token.kind[0] === '>' && top.kind !== '<') {
          break;
        }

        // Remove tentative matches that didn't work out
        if (top.kind === '<' && token.kind[0] !== '>') {
          tokenStack.pop();
          indexStack.pop();
          continue;
        }

        // Break apart operators that start with a closing angle bracket
        if (token.kind[0] === '>' && token.kind.length > 1) {
          var start: Marker = token.range.start;
          var middle: Marker = new Marker(start.index + 1, start.line, start.column + 1);
          tokens.splice(i + 1, 0, new Token(new SourceRange(token.range.source, middle, token.range.end), token.kind.slice(1), token.text.slice(1)));
          token.range.end = middle;
          token.kind = '>';
          token.text = '>';
        }

        // Consume the matching token
        var match: Token = tokenStack.pop();
        var index: number = indexStack.pop();

        // Convert < and > into bounds for type parameter lists
        if (match.kind === '<' && token.kind === '>') {
          match.kind = 'START_PARAMETER_LIST';
          token.kind = 'END_PARAMETER_LIST';
        }

        // Stop the search since we found a match
        continue nextToken;
      }
    }
  }

  return tokens;
}
