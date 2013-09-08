enum LibraryCPP {
  MEMORY_HEADER,
  VECTOR_HEADER,
  MATH_HEADER,
  STDLIB_HEADER,
  MATH_RANDOM,
  MATH_IMIN,
  MATH_IMAX,
  LIST_POP,
  LIST_UNSHIFT,
  LIST_SHIFT,
  LIST_INDEXOF_OWNED,
  LIST_INDEXOF_REF,
  LIST_INDEXOF_VALUE,
  LIST_INSERT,
  LIST_REMOVE,
  LIST_REMOVE_OWNED,
}

class LibraryDataCPP {
  private isNeeded: { [index: number]: boolean } = {};

  need(flag: LibraryCPP) {
    this.isNeeded[flag] = true;
  }

  generate(): Object[] {
    var result: Object[] = [];

    if (this.isNeeded[LibraryCPP.MEMORY_HEADER]) {
      result.push({
        kind: 'IncludeStatement',
        text: '<memory>'
      });
    }

    if (this.isNeeded[LibraryCPP.MATH_HEADER]) {
      result.push({
        kind: 'IncludeStatement',
        text: '<math.h>'
      });
    }

    if (this.isNeeded[LibraryCPP.STDLIB_HEADER] || this.isNeeded[LibraryCPP.MATH_RANDOM]) {
      result.push({
        kind: 'IncludeStatement',
        text: '<stdlib.h>'
      });
    }

    if (this.isNeeded[LibraryCPP.VECTOR_HEADER]) {
      result.push({
        kind: 'IncludeStatement',
        text: '<vector>'
      });
    }

    if (this.isNeeded[LibraryCPP.MATH_RANDOM]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'double Math_random() {',
          '  return (double)rand() / (double)RAND_MAX;',
          '}',
        ].join('\n')
      });
    }

    if (this.isNeeded[LibraryCPP.LIST_POP]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'template <typename T>',
          'T List_pop(std::vector<T> *list) {',
          '  T t = std::move(*(list->end() - 1));',
          '  list->pop_back();',
          '  return std::move(t);',
          '}',
        ].join('\n')
      });
    }

    if (this.isNeeded[LibraryCPP.LIST_UNSHIFT]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'template <typename T>',
          'void List_unshift(std::vector<T> *list, T t) {',
          '  list->insert(list->begin(), std::move(t));',
          '}',
        ].join('\n')
      });
    }

    if (this.isNeeded[LibraryCPP.LIST_SHIFT]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'template <typename T>',
          'T List_shift(std::vector<T> *list) {',
          '  T t = std::move(*list->begin());',
          '  list->erase(list->begin());',
          '  return std::move(t);',
          '}',
        ].join('\n')
      });
    }

    if (this.isNeeded[LibraryCPP.LIST_INDEXOF_OWNED]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'template <typename T, typename U>',
          'int List_indexOf(std::vector<std::unique_ptr<T>> *list, U *u) {',
          '  for (typename std::vector<std::unique_ptr<T>>::iterator i = list->begin(); i != list->end(); i++) {',
          '    if (i->get() == u) {',
          '      return i - list->begin();',
          '    }',
          '  }',
          '  return -1;',
          '}',
        ].join('\n')
      });
    }

    if (this.isNeeded[LibraryCPP.LIST_INDEXOF_REF]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'template <typename T, typename U>',
          'int List_indexOf(std::vector<T *> *list, U *u) {',
          '  for (typename std::vector<T *>::iterator i = list->begin(); i != list->end(); i++) {',
          '    if (*i == u) {',
          '      return i - list->begin();',
          '    }',
          '  }',
          '  return -1;',
          '}',
        ].join('\n')
      });
    }

    if (this.isNeeded[LibraryCPP.LIST_INDEXOF_VALUE]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'template <typename T>',
          'int List_indexOf(std::vector<T> *list, T t) {',
          '  for (typename std::vector<std::unique_ptr<T>>::iterator i = list->begin(); i != list->end(); i++) {',
          '    if (i->get() == t) {',
          '      return i - list->begin();',
          '    }',
          '  }',
          '  return -1;',
          '}',
        ].join('\n')
      });
    }

    if (this.isNeeded[LibraryCPP.LIST_INSERT]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'template <typename T>',
          'void List_insert(std::vector<T> *list, int offset, T t) {',
          '  list->insert(list->begin() + offset, std::move(t));',
          '}',
        ].join('\n')
      });
    }

    if (this.isNeeded[LibraryCPP.LIST_REMOVE]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'template <typename T>',
          'T List_remove(std::vector<T> *list, int offset) {',
          '  T item = (*list)[offset];',
          '  list->erase(list->begin() + offset);',
          '  return item;',
          '}',
        ].join('\n')
      });
    }

    if (this.isNeeded[LibraryCPP.LIST_REMOVE_OWNED]) {
      result.push({
        kind: 'VerbatimStatement',
        text: [
          'template <typename T>',
          'std::unique_ptr<T> List_remove(std::vector<std::unique_ptr<T>> *list, int offset) {',
          '  std::unique_ptr<T> item = std::move((*list)[offset]);',
          '  list->erase(list->begin() + offset);',
          '  return item;',
          '}',
        ].join('\n')
      });
    }

    return result;
  }
}
