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

import { typecheck } from './utils.js';
import { doc } from '../utils.js';

// -----------------------------------------------------------------------------
export default function Macro(name, fn, doc_string, dump) {
    if (typeof this !== 'undefined' && this.constructor !== Macro ||
        typeof this === 'undefined') {
        return new Macro(name, fn);
    }
    typecheck('Macro', name, 'string', 1);
    typecheck('Macro', fn, 'function', 2);
    doc(this, doc_string, dump);
    this.name = name;
    this.fn = fn;
}

// -----------------------------------------------------------------------------
Macro.defmacro = function(name, fn, doc, dump) {
    var macro = new Macro(name, fn, doc, dump);
    macro.defmacro = true;
    return macro;
};

// -----------------------------------------------------------------------------
Macro.prototype.invoke = function(code, { env, dynamic_scope, error }, macro_expand) {
    var args = {
        dynamic_scope,
        error,
        macro_expand
    };
    var result = this.fn.call(env, code, args, this.name);
    return result;
    //return macro_expand ? quote(result) : result;
};

// -----------------------------------------------------------------------------
Macro.prototype.toString = function() {
    return '#<Macro ' + this.name + '>';
};
