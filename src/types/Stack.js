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
// Stack used in balanced function
// TODO: use it in parser
// -----------------------------------------------------------------------------
export default function Stack() {
    this.data = [];
}

// -----------------------------------------------------------------------------
Stack.prototype.push = function(item) {
    this.data.push(item);
};

// -----------------------------------------------------------------------------
Stack.prototype.top = function() {
    return this.data[this.data.length - 1];
};

// -----------------------------------------------------------------------------
Stack.prototype.pop = function() {
    return this.data.pop();
};

// -----------------------------------------------------------------------------
Stack.prototype.is_empty = function() {
    return !this.data.length;
};
