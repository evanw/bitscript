test([
  'class A : A {}',
], [
  'error on line 1 of <stdin>: circular type',
  '',
  'class A : A {}',
  '          ^',
]);

test([
  'class A : B {}',
  'class B : A {}',
], [
  'error on line 2 of <stdin>: circular type',
  '',
  'class B : A {}',
  '          ^',
]);

test([
  'class A : B {}',
  'class B : C {}',
  'class C : A {}',
], [
  'error on line 3 of <stdin>: circular type',
  '',
  'class C : A {}',
  '          ^',
]);

test([
  'class A { C c; }',
  'class B : A {}',
  'class C { B b; }',
], [
]);

test([
  'class A {',
  '  B foo();',
  '}',
  'class B : A {',
  '  over B foo() { // This line should not cause a circular type error',
  '    new A(); // This should be detected as abstract',
  '    new B(); // This should not be detected as abstract',
  '    return this;',
  '  }',
  '}',
], [
  'error on line 6 of <stdin>: cannot use new on abstract type A',
  '',
  '    new A(); // This should be detected as abstract',
  '        ^',
]);
