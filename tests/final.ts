test([
  'void foo() {',
  '  foo = foo;',
  '}',
], [
  'error on line 2 of <stdin>: cannot assign to final symbol',
  '',
  '  foo = foo;',
  '  ~~~',
]);

test([
  'void foo() {',
  '  final int bar;',
  '}',
], [
  'error on line 2 of <stdin>: final variable of type int must be initialized',
  '',
  '  final int bar;',
  '            ~~~',
]);

test([
  'void foo() {',
  '  final int bar = 0;',
  '  bar = 1;',
  '}',
], [
  'error on line 3 of <stdin>: cannot assign to final symbol',
  '',
  '  bar = 1;',
  '  ~~~',
]);

test([
  'void foo(final int bar) {',
  '  bar = 1;',
  '}',
], [
  'error on line 2 of <stdin>: cannot assign to final symbol',
  '',
  '  bar = 1;',
  '  ~~~',
]);

test([
  'class Foo {}',
  'void foo(final Foo *bar) {',
  '  bar = null;',
  '}',
], [
  'error on line 3 of <stdin>: cannot assign to final symbol',
  '',
  '  bar = null;',
  '  ~~~',
]);

test([
  'class Foo {}',
  'void foo(final Foo *bar) {',
  '  *bar = Foo();',
  '}',
], [
]);

test([
  'class Foo {}',
  'void foo(final Foo bar) {',
  '  &bar = new Foo();',
  '}',
], [
  'error on line 3 of <stdin>: cannot store to this location',
  '',
  '  &bar = new Foo();',
  '  ~~~~',
]);

test([
  'class Foo {',
  '  Foo *foo;',
  '  void bar() {',
  '    foo = null;',
  '  }',
  '}',
], [
]);

test([
  'class Foo {',
  '  final Foo *foo;',
  '  void bar() {',
  '    foo = null;',
  '  }',
  '}',
], [
  'error on line 4 of <stdin>: cannot assign to final symbol',
  '',
  '    foo = null;',
  '    ~~~',
]);
