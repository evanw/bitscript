test([
  'void foo(nullable int x) {',
  '  int y = x;',
  '}',
], [
  'error on line 2 of <stdin>: cannot convert from value of type nullable int to value of type int',
  '',
  '  int y = x;',
  '          ^',
]);
