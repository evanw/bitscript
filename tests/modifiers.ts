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

// TODO: Warn about each one individually
test([
  'class Foo {}',
  'void main() {',
  '  Foo bar = Math.random() < 0.5 ? new Foo() : new Foo();',
  '}',
], [
  'error on line 3 of <stdin>: new object will be deleted immediately (store it somewhere with an owned or shared type instead)',
  '',
  '  Foo bar = Math.random() < 0.5 ? new Foo() : new Foo();',
  '            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]);

// TODO: Warn only about 'new Foo()', and also must not delete foo until the end of the scope
test([
  'class Foo {}',
  'void main() {',
  '  owned Foo foo = new Foo();',
  '  Foo bar = Math.random() < 0.5 ? new Foo() : foo;',
  '}',
], [
  'error on line 4 of <stdin>: new object will be deleted immediately (store it somewhere with an owned or shared type instead)',
  '',
  '  Foo bar = Math.random() < 0.5 ? new Foo() : foo;',
  '            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]);

// TODO: Warn only about 'new Foo()', and also must not delete foo until the end of the scope
test([
  'class Foo {}',
  'void main() {',
  '  owned Foo foo = new Foo();',
  '  Foo bar = Math.random() < 0.5 ? foo : new Foo();',
  '}',
], [
  'error on line 4 of <stdin>: new object will be deleted immediately (store it somewhere with an owned or shared type instead)',
  '',
  '  Foo bar = Math.random() < 0.5 ? foo : new Foo();',
  '            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]);

// TODO: This should work, and also must not delete foo until the end of the scope
test([
  'class Foo {}',
  'void main() {',
  '  owned Foo foo = new Foo();',
  '  Foo bar = Math.random() < 0.5 ? foo : foo;',
  '}',
], [
  'error on line 4 of <stdin>: new object will be deleted immediately (store it somewhere with an owned or shared type instead)',
  '',
  '  Foo bar = Math.random() < 0.5 ? foo : foo;',
  '            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]);

// This should work, and should transfer foo to bar
test([
  'class Foo {}',
  'void main() {',
  '  owned Foo foo = new Foo();',
  '  owned Foo bar = Math.random() < 0.5 ? foo : foo;',
  '}',
], [
]);

test([
  'class Foo {',
  '  int x = 0;',
  '}',
  'void bar(Foo a, int b) {}',
  'void baz(int a, Foo b) {}',
  'int main() {',
  '  owned Foo foo = new Foo();',
  '  bar(foo, foo.x);',
  '  baz(foo.x, foo);',
  '  return 0;',
  '}',
], [
]);

test([
  'class Foo {',
  '  int x = 0;',
  '}',
  'void bar1(owned Foo a, int b) {}',
  'void bar2(int a, owned Foo b) {}',
  'void baz1(owned Foo a, int b, int c) {}',
  'void baz2(int a, owned Foo b, int c) {}',
  'void baz3(int a, int b, owned Foo c) {}',
  'int main() {',
  '  owned Foo foo = new Foo();',
  '  bar1(move foo, foo.x);',
  '  bar2(foo.x, move foo);',
  '  baz1(move foo, foo.x, foo.x);',
  '  baz2(foo.x, move foo, foo.x);',
  '  baz3(foo.x, foo.x, move foo);',
  '  return 0;',
  '}',
], [
  'error on line 11 of <stdin>: foo is both moved and used in the same expression',
  '',
  '  bar1(move foo, foo.x);',
  '                 ~~~',
  '',
  'error on line 12 of <stdin>: foo is both moved and used in the same expression',
  '',
  '  bar2(foo.x, move foo);',
  '                   ~~~',
  '',
  'error on line 13 of <stdin>: foo is both moved and used in the same expression',
  '',
  '  baz1(move foo, foo.x, foo.x);',
  '                 ~~~',
  '',
  'error on line 14 of <stdin>: foo is both moved and used in the same expression',
  '',
  '  baz2(foo.x, move foo, foo.x);',
  '                   ~~~',
  '',
  'error on line 15 of <stdin>: foo is both moved and used in the same expression',
  '',
  '  baz3(foo.x, foo.x, move foo);',
  '                          ~~~',
]);

test([
  'class Foo {',
  '}',
  'bool foo(owned Foo foo, shared Foo bar, Foo baz) {',
  '  // This should compile in C++ by implicitly converting to raw pointers before each comparison',
  '  return foo == foo || bar == bar || baz == baz || foo == bar || foo == baz || bar == baz;',
  '}',
], [
]);

test([
  'class Foo {}',
  'int main() {',
  '  owned Foo foo;',
  '  Foo bar;',
  '  bar = foo = new Foo(); // This should compile correctly in C++',
  '  return 0;',
  '}',
], [
]);
