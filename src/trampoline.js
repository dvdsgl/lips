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
export function Thunk(fn, cont = null) {
    this.fn = fn;
    this.cont = cont;
}

// -----------------------------------------------------------------------------
export function trampoline(fn) {
    return function(...args) {
        return unwind(fn.apply(this, args));
    };
}

// -----------------------------------------------------------------------------
Thunk.prototype.continuation = function() {
    if (typeof this.cont === 'function') {
        this.cont();
    }
};

// -----------------------------------------------------------------------------
Thunk.prototype.toString = function() {
    return '#<Thunk>';
};

// -----------------------------------------------------------------------------
function is_thunk(obj) {
    return obj instanceof Thunk;
}

// -----------------------------------------------------------------------------
function thunk_invoke(obj) {
    if (obj instanceof Thunk) {
        return obj.fn();
    }
    return obj;
}

// -----------------------------------------------------------------------------
function thunk_continuation(obj) {
    if (obj instanceof Thunk) {
        obj.continuation();
    }
}

// -----------------------------------------------------------------------------
function unwind(result) {
    while (is_thunk(result)) {
        const thunk = result;
        result = thunk_invoke(result);
        if (!is_thunk(result)) {
            thunk_continuation(thunk);
        }
    }
    return result;
}

