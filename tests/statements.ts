test([
  '100;',
], [
  'error on line 1 of <stdin>: cannot use expression statement here',
  '',
  '100;',
  '~~~~',
]);

test([
  'if (true) {}',
], [
  'error on line 1 of <stdin>: cannot use if statement here',
  '',
  'if (true) {}',
  '~~~~~~~~~~~~',
]);

test([
  'while (true) {}',
], [
  'error on line 1 of <stdin>: cannot use while statement here',
  '',
  'while (true) {}',
  '~~~~~~~~~~~~~~~',
]);

test([
  'return;',
], [
  'error on line 1 of <stdin>: cannot use return statement here',
  '',
  'return;',
  '~~~~~~~',
]);

test([
  'break;',
], [
  'error on line 1 of <stdin>: cannot use break statement here',
  '',
  'break;',
  '~~~~~~',
]);

test([
  'continue;',
], [
  'error on line 1 of <stdin>: cannot use continue statement here',
  '',
  'continue;',
  '~~~~~~~~~',
]);

test([
  'struct Foo {',
  '  struct Bar {}',
  '}',
], [
  'error on line 2 of <stdin>: cannot use struct declaration here',
  '',
  '  struct Bar {}',
  '  ~~~~~~~~~~~~~',
]);

test([
  'void foo() {',
  '  struct Foo {}',
  '}',
], [
  'error on line 2 of <stdin>: cannot use struct declaration here',
  '',
  '  struct Foo {}',
  '  ~~~~~~~~~~~~~',
]);

test([
  'struct Foo {',
  '  void foo() {}',
  '}',
], [
  'error on line 2 of <stdin>: cannot use function declaration here',
  '',
  '  void foo() {}',
  '  ~~~~~~~~~~~~~',
]);

test([
  'void foo() {',
  '  void bar() {}',
  '}',
], [
  'error on line 2 of <stdin>: cannot use function declaration here',
  '',
  '  void bar() {}',
  '  ~~~~~~~~~~~~~',
]);

test([
  'void foo() {',
  '  100;',
  '}',
], [
]);

test([
  'void foo() {',
  '  if (true) {}',
  '}',
], [
]);

test([
  'void foo() {',
  '  while (true) {}',
  '}',
], [
]);

test([
  'void foo() {',
  '  return;',
  '}',
], [
]);

test([
  'void foo() {',
  '  break;',
  '}',
], [
  'error on line 2 of <stdin>: cannot use break statement here',
  '',
  '  break;',
  '  ~~~~~~',
]);

test([
  'void foo() {',
  '  continue;',
  '}',
], [
  'error on line 2 of <stdin>: cannot use continue statement here',
  '',
  '  continue;',
  '  ~~~~~~~~~',
]);

test([
  'void foo() {',
  '  while (true) break;',
  '}',
], [
]);

test([
  'void foo() {',
  '  while (true) continue;',
  '}',
], [
]);

test([
  'int foo;',
], [
]);

test([
  'int foo = 100;',
], [
]);

test([
  'struct Foo {',
  '  int foo;',
  '}',
], [
]);

test([
  'struct Foo {',
  '  int foo = 100;',
  '}',
], [
]);

test([
  'void foo() {',
  '  int bar;',
  '}',
], [
]);

test([
  'void foo() {',
  '  int bar = 100;',
  '}',
], [
]);
