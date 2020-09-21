/**@license
 *   __ __                          __
 *  / / \ \       _    _  ___  ___  \ \
 * | |   \ \     | |  | || . \/ __>  | |
 * | |    > \    | |_ | ||  _/\__ \  | |
 * | |   / ^ \   |___||_||_|  <___/  | |
 *  \_\ /_/ \_\                     /_/
 *
 * LIPS is Pretty Simple - Scheme based Powerful LISP in JavaScript
 *
 * Copyright (c) 2018-2020 Jakub T. Jankiewicz <https://jcubic.pl/me>
 * Released under the MIT license
 *
 */

// -----------------------------------------------------------------------------
function LSymbol(name) {
    if (typeof this !== 'undefined' && this.constructor !== LSymbol ||
        typeof this === 'undefined') {
        return new LSymbol(name);
    }
    this.name = name;
}

// -----------------------------------------------------------------------------
LSymbol.is = function(symbol, name) {
    return symbol instanceof LSymbol &&
        ((name instanceof LSymbol && symbol.name === name.name) ||
         (typeof name === 'string' && symbol.name === name) ||
         (name instanceof RegExp && name.test(symbol.name)));
};

// -----------------------------------------------------------------------------
LSymbol.prototype.toJSON = LSymbol.prototype.toString = function() {
    //return '<#symbol \'' + this.name + '\'>';
    if (is_symbol(this.name)) {
        return this.name.toString().replace(/^Symbol\(([^)]+)\)/, '$1');
    }
    return this.valueOf();
};

// --------------------------------------------------------------------------------
LSymbol.prototype.valueOf = function() {
    return this.name.valueOf();
};

// --------------------------------------------------------------------------------
LSymbol.prototype.is_gensym = function() {
    return is_gensym(this.name);
};

// --------------------------------------------------------------------------------
LSymbol.prototype.toDry = function() {
    return {
        value: {
            name: this.name
        }
    };
};

// --------------------------------------------------------------------------------
LSymbol.unDry = function(value) {
    return new LSymbol(value.name);
};

// -----------------------------------------------------------------------------
// detect if object is ES6 Symbol that work with polyfills
// -----------------------------------------------------------------------------
function is_symbol(x) {
    return typeof x === 'symbol' ||
        typeof x === 'object' &&
        Object.prototype.toString.call(x) === '[object Symbol]';
}

// --------------------------------------------------------------------------------
function is_gensym(symbol) {
    if (typeof symbol === 'symbol') {
        return !!symbol.toString().match(/^Symbol\(#:/);
    }
    return false;
}

// --------------------------------------------------------------------------------
LSymbol.gensym = (function() {
    var count = 0;
    return function(name = null) {
        if (name instanceof LSymbol) {
            name = name.valueOf();
        }
        if (is_gensym(name)) {
            // don't do double gynsyms in nested syntax-rules
            return LSymbol(name);
        }
        // use ES6 symbol as name for lips symbol (they are unique)
        if (name !== null) {
            return new LSymbol(Symbol(`#:${name}`));
        }
        count++;
        return new LSymbol(Symbol(`#:g${count}`));
    };
})();

// --------------------------------------------------------------------------------
export default LSymbol;
