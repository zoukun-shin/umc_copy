sap.ui.define([
], function () {
    "use strict";
    return {

        formatCodeName: function (code, name) {
            if (code && name) {
                return `${name} (${code})`;
            } else if (code) {
                return `${code}`;
            } else if (name) {
                return `${name}`;
            }
        },

        // format Float, 5 decimal + thousandths
        formatFloat: function (n, decimal) {
            if (n) {
                var sign = "";
                if (typeof n === "string") {
                    var bNegative = n.endsWith("-");
                    if (bNegative) {
                        n = "-" + n.substring(0, n.length - 1);
                    }
                }
                var num = Number(n).toFixed(5);
                if (num < 0) {
                    num = num.substring(1);
                    sign = "-";
                }
                var re = /\d{1,3}(?=(\d{3})+$)/g;
                var n1 = num.toString().replace(/^(\d+)((\.\d+)?)$/, function (s, s1, s2) {
                    return s1.replace(re, "$&,") + s2;
                });
                if (sign === "-") {
                    n1 = sign + n1;
                }
                return n1;
            } else {
                return n;
            }
        },
    }
});