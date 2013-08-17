test([
  'struct Foo {}',
  'Foo foo = new Foo();',
], [
  'error on line 2 of <stdin>: cannot convert from value of type owned Foo to value of type Foo',
  '',
  'Foo foo = new Foo();',
  '          ~~~~~~~~~',
]);

test([
  'struct Foo {}',
  'ref Foo foo = new Foo();',
], [
  'error on line 2 of <stdin>: new object will be deleted immediately (store it somewhere with an owned or shared type instead)',
  '',
  'ref Foo foo = new Foo();',
  '              ~~~~~~~~~',
]);

test([
  'struct Foo {}',
  'owned Foo foo = new Foo();',
], [
]);

test([
  'struct Foo {}',
  'shared Foo foo = new Foo();',
], [
]);

test([
  'struct Foo {}',
  'ref Foo foo;',
  'owned Foo bar = foo;',
], [
  'error on line 3 of <stdin>: cannot convert from value of type ref Foo to value of type owned Foo',
  '',
  'owned Foo bar = foo;',
  '                ~~~',
]);

test([
  'struct Foo {}',
  'ref Foo foo;',
  'shared Foo bar = foo;',
], [
  'error on line 3 of <stdin>: cannot convert from value of type ref Foo to value of type shared Foo',
  '',
  'shared Foo bar = foo;',
  '                 ~~~',
]);

test([
  'struct Foo {}',
  'shared Foo foo;',
  'owned Foo bar = foo;',
], [
  'error on line 3 of <stdin>: cannot convert from value of type shared Foo to value of type owned Foo',
  '',
  'owned Foo bar = foo;',
  '                ~~~',
]);

test([
  'struct Foo {}',
  'owned shared Foo foo = new Foo();',
], [
  'error on line 2 of <stdin>: can only use one of ref, shared, or owned',
  '',
  'owned shared Foo foo = new Foo();',
  '~~~~~~~~~~~~~~~~',
]);

test([
  'struct Link {',
  '  ref Link next; // Test circular types',
  '}',
], [
]);

test([
  'struct Foo {}',
  'Foo foo() {',
  '  return new Foo();',
  '}',
], [
  'error on line 3 of <stdin>: cannot convert from value of type owned Foo to value of type Foo',
  '',
  '  return new Foo();',
  '         ~~~~~~~~~',
]);

test([
  'struct Foo {}',
  'ref Foo foo() {',
  '  return new Foo();',
  '}',
], [
  'error on line 3 of <stdin>: new object will be deleted immediately (store it somewhere with an owned or shared type instead)',
  '',
  '  return new Foo();',
  '         ~~~~~~~~~',
]);

test([
  'struct Foo {}',
  'shared Foo foo() {',
  '  return new Foo();',
  '}',
], [
]);

test([
  'struct Foo {}',
  'owned Foo foo() {',
  '  return new Foo();',
  '}',
], [
]);
