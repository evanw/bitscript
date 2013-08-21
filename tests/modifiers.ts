test([
  'class Foo {}',
  'Foo foo = new Foo();',
], [
  'error on line 2 of <stdin>: new object will be deleted immediately (store it somewhere with an owned or shared type instead)',
  '',
  'Foo foo = new Foo();',
  '          ~~~~~~~~~',
]);

test([
  'class Foo {}',
  'owned Foo foo = new Foo();',
], [
]);

test([
  'class Foo {}',
  'shared Foo foo = new Foo();',
], [
]);

test([
  'class Foo {}',
  'Foo foo;',
  'owned Foo bar = foo;',
], [
  'error on line 3 of <stdin>: cannot convert from pointer of type Foo to pointer of type owned Foo',
  '',
  'owned Foo bar = foo;',
  '                ~~~',
]);

test([
  'class Foo {}',
  'Foo foo;',
  'shared Foo bar = foo;',
], [
  'error on line 3 of <stdin>: cannot convert from pointer of type Foo to pointer of type shared Foo',
  '',
  'shared Foo bar = foo;',
  '                 ~~~',
]);

test([
  'class Foo {}',
  'shared Foo foo;',
  'owned Foo bar = foo;',
], [
  'error on line 3 of <stdin>: cannot convert from pointer of type shared Foo to pointer of type owned Foo',
  '',
  'owned Foo bar = foo;',
  '                ~~~',
]);

test([
  'class Foo {}',
  'owned shared Foo foo = new Foo();',
], [
  'error on line 2 of <stdin>: cannot use both owned and shared',
  '',
  'owned shared Foo foo = new Foo();',
  '~~~~~~~~~~~~~~~~',
]);

test([
  'class Link {',
  '  Link next; // Test circular types',
  '}',
], [
]);

test([
  'class Foo {}',
  'Foo foo() {',
  '  return new Foo();',
  '}',
], [
  'error on line 3 of <stdin>: new object will be deleted immediately (store it somewhere with an owned or shared type instead)',
  '',
  '  return new Foo();',
  '         ~~~~~~~~~',
]);

test([
  'class Foo {}',
  'shared Foo foo() {',
  '  return new Foo();',
  '}',
], [
]);

test([
  'class Foo {}',
  'owned Foo foo() {',
  '  return new Foo();',
  '}',
], [
]);

test([
  'class Foo {}',
  'owned Foo foo() {}',
  'Foo bar() {',
  '  return foo();',
  '}',
], [
  'error on line 4 of <stdin>: new object will be deleted immediately (store it somewhere with an owned or shared type instead)',
  '',
  '  return foo();',
  '         ~~~~~',
]);

test([
  'class Foo {}',
  'void bar(owned Foo foo) {',
  '  Foo bar = foo;',
  '}',
], [
]);

test([
  'class Foo {}',
  'void foo() {',
  '  owned Foo foo = null;',
  '}',
], [
]);

test([
  'class Foo {}',
  'void foo() {',
  '  shared Foo foo = null;',
  '}',
], [
]);

test([
  'class Foo {}',
  'void foo() {',
  '  Foo foo = null;',
  '}',
], [
]);
