['+', '-'].map(op => {
  test([
    'bool foo = ' + op + 'false;',
  ], [
    'error on line 1 of <stdin>: no unary operator ' + op + ' for value of type bool',
    '',
    'bool foo = ' + op + 'false;',
    '           ~~~~~~',
  ]);

  test([
    'void foo() {}',
    'bool bar = ' + op + 'foo();',
  ], [
    'error on line 2 of <stdin>: no unary operator ' + op + ' for value of type void',
    '',
    'bool bar = ' + op + 'foo();',
    '           ~~~~~~',
  ]);

  test([
    'bool foo = ' + op + '1;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type int to value of type bool',
    '',
    'bool foo = ' + op + '1;',
    '           ~~',
  ]);

  test([
    'bool foo = ' + op + '1.5;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type double to value of type bool',
    '',
    'bool foo = ' + op + '1.5;',
    '           ~~~~',
  ]);
});

test([
  'int foo = !false;',
], [
  'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
  '',
  'int foo = !false;',
  '          ~~~~~~',
]);

test([
  'void foo() {}',
  'int bar = !foo();',
], [
  'error on line 2 of <stdin>: no unary operator ! for value of type void',
  '',
  'int bar = !foo();',
  '          ~~~~~~',
]);

test([
  'int foo = !1;',
], [
  'error on line 1 of <stdin>: no unary operator ! for value of type int',
  '',
  'int foo = !1;',
  '          ~~',
]);

test([
  'int foo = !1.5;',
], [
  'error on line 1 of <stdin>: no unary operator ! for value of type double',
  '',
  'int foo = !1.5;',
  '          ~~~~',
]);

test([
  'bool foo = ~false;',
], [
  'error on line 1 of <stdin>: no unary operator ~ for value of type bool',
  '',
  'bool foo = ~false;',
  '           ~~~~~~',
]);

test([
  'void foo() {}',
  'bool bar = ~foo();',
], [
  'error on line 2 of <stdin>: no unary operator ~ for value of type void',
  '',
  'bool bar = ~foo();',
  '           ~~~~~~',
]);

test([
  'bool foo = ~1;',
], [
  'error on line 1 of <stdin>: cannot convert from value of type int to value of type bool',
  '',
  'bool foo = ~1;',
  '           ~~',
]);

test([
  'bool foo = ~1.5;',
], [
  'error on line 1 of <stdin>: no unary operator ~ for value of type double',
  '',
  'bool foo = ~1.5;',
  '           ~~~~',
]);

['+', '-', '*', '/'].map(op => {
  test([
    'bool foo = 1 ' + op + ' false;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type int and value of type bool',
    '',
    'bool foo = 1 ' + op + ' false;',
    '           ~~~~~~~~~',
  ]);

  test([
    'bool foo = false ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type bool and value of type int',
    '',
    'bool foo = false ' + op + ' 1;',
    '           ~~~~~~~~~',
  ]);

  test([
    'bool foo = 1 ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type int to value of type bool',
    '',
    'bool foo = 1 ' + op + ' 1;',
    '           ~~~~~',
  ]);

  test([
    'bool foo = 1 ' + op + ' 1.5;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type double to value of type bool',
    '',
    'bool foo = 1 ' + op + ' 1.5;',
    '           ~~~~~~~',
  ]);

  test([
    'bool foo = 1.5 ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type double to value of type bool',
    '',
    'bool foo = 1.5 ' + op + ' 1;',
    '           ~~~~~~~',
  ]);

  test([
    'bool foo = 1.5 ' + op + ' 1.5;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type double to value of type bool',
    '',
    'bool foo = 1.5 ' + op + ' 1.5;',
    '           ~~~~~~~~~',
  ]);
});

['%', '<<', '>>', '|', '&', '^'].map(op => {
  var tildes = op.replace(/./g, '~');

  test([
    'bool foo = 1 ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type int to value of type bool',
    '',
    'bool foo = 1 ' + op + ' 1;',
    '           ~~~~' + tildes,
  ]);

  test([
    'bool foo = 1 ' + op + ' 1.5;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type int and value of type double',
    '',
    'bool foo = 1 ' + op + ' 1.5;',
    '           ~~~~~~' + tildes,
  ]);

  test([
    'bool foo = 1.5 ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type double and value of type int',
    '',
    'bool foo = 1.5 ' + op + ' 1;',
    '           ~~~~~~' + tildes,
  ]);
});

['||', '&&'].map(op => {
  test([
    'int foo = false ' + op + ' true;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = false ' + op + ' true;',
    '          ~~~~~~~~~~~~~',
  ]);

  test([
    'int foo = false ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type bool and value of type int',
    '',
    'int foo = false ' + op + ' 1;',
    '          ~~~~~~~~~~',
  ]);

  test([
    'int foo = 1 ' + op + ' false;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type int and value of type bool',
    '',
    'int foo = 1 ' + op + ' false;',
    '          ~~~~~~~~~~',
  ]);
});

['<', '>', '<=', '>='].map(op => {
  var tildes = op.replace(/./g, '~');

  test([
    'int foo = false ' + op + ' true;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type bool and value of type bool',
    '',
    'int foo = false ' + op + ' true;',
    '          ~~~~~~~~~~~' + tildes,
  ]);

  test([
    'int foo = 1 ' + op + ' true;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type int and value of type bool',
    '',
    'int foo = 1 ' + op + ' true;',
    '          ~~~~~~~' + tildes,
  ]);

  test([
    'int foo = false ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type bool and value of type int',
    '',
    'int foo = false ' + op + ' 1;',
    '          ~~~~~~~~' + tildes,
  ]);

  test([
    'int foo = 1 ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = 1 ' + op + ' 1;',
    '          ~~~~' + tildes,
  ]);

  test([
    'int foo = 1 ' + op + ' 1.5;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = 1 ' + op + ' 1.5;',
    '          ~~~~~~' + tildes,
  ]);

  test([
    'int foo = 1.5 ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = 1.5 ' + op + ' 1;',
    '          ~~~~~~' + tildes,
  ]);

  test([
    'int foo = 1.5 ' + op + ' 1.5;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = 1.5 ' + op + ' 1.5;',
    '          ~~~~~~~~' + tildes,
  ]);
});

['==', '!='].map(op => {
  test([
    'int foo = false ' + op + ' true;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = false ' + op + ' true;',
    '          ~~~~~~~~~~~~~',
  ]);

  test([
    'int foo = 1 ' + op + ' true;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type int and value of type bool',
    '',
    'int foo = 1 ' + op + ' true;',
    '          ~~~~~~~~~',
  ]);

  test([
    'int foo = false ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: no binary operator ' + op + ' for value of type bool and value of type int',
    '',
    'int foo = false ' + op + ' 1;',
    '          ~~~~~~~~~~',
  ]);

  test([
    'int foo = 1 ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = 1 ' + op + ' 1;',
    '          ~~~~~~',
  ]);

  test([
    'int foo = 1 ' + op + ' 1.5;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = 1 ' + op + ' 1.5;',
    '          ~~~~~~~~',
  ]);

  test([
    'int foo = 1.5 ' + op + ' 1;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = 1.5 ' + op + ' 1;',
    '          ~~~~~~~~',
  ]);

  test([
    'int foo = 1.5 ' + op + ' 1.5;',
  ], [
    'error on line 1 of <stdin>: cannot convert from value of type bool to value of type int',
    '',
    'int foo = 1.5 ' + op + ' 1.5;',
    '          ~~~~~~~~~~',
  ]);
});
