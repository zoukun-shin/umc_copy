sap.ui.define([
    "sap/ui/core/format/DateFormat"
], function (DateFormat) {
    "use strict";
    return {
        // format State
        formatState: function (value) {
            if (value === "S") {
                return "Success";
            }
            if (value === "E") {
                return "Error";
            }
            if (value === "P") {
                return "In Process";
            }
            if (value === "F") {
                return "Finished";
            }
            if (value === "C") {
                return "Finished";
            }
            return "None";
        },

        formatStateIcon: function (value) {
            if (value === "S") {
                return "sap-icon://status-positive";
            }
            if (value === "E") {
                return "sap-icon://status-negative";
            }
            if (value === "W") {
                return "sap-icon://status-critical";
            }
            return "sap-icon://status-inactive";
        },

        // format Date
        formatDate: function (value) {
            if (value) {
                var oDateFormat = DateFormat.getTimeInstance({
                    pattern: "yyyy/MM/dd"
                });
                return oDateFormat.format(new Date(value));
            }
            return value;
        },

        // format Time
        formatTime: function (value) {
            if (value) {
                var oTimeFormat = DateFormat.getTimeInstance({
                    pattern: "HH:mm:ss"
                });
                return oTimeFormat.format(new Date(value.ms));
            }
            return value;
        },

        // format Number, integer + thousandths
        formatNumber: function (n) {
            if (n) {
                if (parseFloat(n) === 0) {
                    return "";
                }
                var sign = "";
                if (typeof n === "string") {
                    var bNegative = n.endsWith("-");
                    if (bNegative) {
                        n = "-" + n.substring(0, n.length - 1);
                    }
                }
                var num = Number(n);
                if (num < 0) {
                    num = num * -1;
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

        // format Float, two decimal + thousandths
        formatQuantity: function (n) {
            if (n) {
                if (parseFloat(n) === 0) {
                    return "";
                }
                var sign = "";
                if (typeof n === "string") {
                    var bNegative = n.endsWith("-");
                    if (bNegative) {
                        n = "-" + n.substring(0, n.length - 1);
                    }
                }
                var num = Number(n).toFixed(2);
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

        // format Float, decimal + thousandths
        formatFloat: function (n, currency) {
            if (n) {
                if (parseFloat(n) === 0 && currency === "") {
                    return "";
                }
                var sign = "";
                var decimal = 5;
                if (typeof n === "string") {
                    var bNegative = n.endsWith("-");
                    if (bNegative) {
                        n = "-" + n.substring(0, n.length - 1);
                    }
                }
                if (currency === "JPY" || currency === "TWD") {
                    decimal = 3;
                }
                var num = Number(n).toFixed(decimal);
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
        // format Float, always 2 decimals + thousandths
        formatFloat2: function (n, currency) {
            if (n) {
                if (parseFloat(n) === 0 && currency === "") {
                    return "";
                }

                var sign = "";
                var decimal = 2; // 固定两位小数

                // 处理尾负号：123-
                if (typeof n === "string") {
                    var bNegative = n.endsWith("-");
                    if (bNegative) {
                        n = "-" + n.substring(0, n.length - 1);
                    }
                }

                var num = Number(n).toFixed(decimal);

                // 处理负数
                if (num < 0) {
                    num = num.substring(1);
                    sign = "-";
                }

                // 千分位
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

        // format number: remove trailing zeros in decimals + thousand separators
        formatNumberTrimZero: function (n, currency) {
            if (n || n === 0) {
                if (parseFloat(n) === 0 && currency === "") {
                    return "";
                }

                var sign = "";

                // 处理尾负号：123-
                if (typeof n === "string") {
                    if (n.endsWith("-")) {
                        n = "-" + n.substring(0, n.length - 1);
                    }
                }

                var num = Number(n);
                if (isNaN(num)) {
                    return n;
                }

                // 处理负数
                if (num < 0) {
                    num = Math.abs(num);
                    sign = "-";
                }

                // 转字符串并去掉多余小数 0
                var sNum = num.toString();

                // 防止科学计数法
                if (sNum.indexOf("e") !== -1) {
                    sNum = num.toFixed(10);
                }

                // 去掉尾随 0 和多余的小数点
                if (sNum.indexOf(".") > -1) {
                    sNum = sNum
                        .replace(/0+$/, "")   // 去尾 0
                        .replace(/\.$/, "");  // 去尾 .
                }

                // 千分位
                var re = /\d{1,3}(?=(\d{3})+$)/g;
                sNum = sNum.replace(/^(\d+)(\.\d+)?$/, function (s, s1, s2) {
                    return s1.replace(re, "$&,") + (s2 || "");
                });

                return sign + sNum;
            } else {
                return n;
            }
        },

        formatOrderStatus: function (value) {
            if (value) {
                return "完了";
            } else {
                return "未完了";
            }
        },

        formatDescription: function (key, text) {
            var sDesc;
            if (key && text) {
                sDesc = text + "(" + key + ")";
            } else if (key) {
                sDesc = key;
            } else if (text) {
                sDesc = text;
            } else {
                sDesc = "";
            }
            return sDesc;
        }
    };
});