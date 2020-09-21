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

import Macro from './Macro.js';

// -----------------------------------------------------------------------------
// TODO: Don't put Syntax as Macro they are not runtime
// -----------------------------------------------------------------------------
export default function Syntax(fn, env) {
    this.name = 'syntax';
    this.env = env;
    this.fn = fn;
    // allow macroexpand
    this.defmacro = true;
}
Syntax.merge_env = Symbol.for('merge');

// -----------------------------------------------------------------------------
Syntax.prototype = Object.create(Macro.prototype);
Syntax.prototype.invoke = function(code, { error, env }, macro_expand) {
    var args = {
        error,
        env,
        dynamic_scope: this.env,
        macro_expand
    };
    return this.fn.call(env, code, args, this.name);
};
Syntax.prototype.constructor = Syntax;
Syntax.prototype.toString = function() {
    return '<#syntax>';
};
Syntax.className = 'syntax';
