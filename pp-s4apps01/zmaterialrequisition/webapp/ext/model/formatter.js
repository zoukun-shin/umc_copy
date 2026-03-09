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
            return "None";
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

        // format Number, 2 decimal + thousandths
        formatNumber: function (n, currency) {
            if (n) {
                if (parseFloat(n) === 0 && currency === "") {
                    return "";
                }
                var sign = "";
                var decimal = 2;
                if (typeof n === "string") {
                    var bNegative = n.endsWith("-");
                    if (bNegative) {
                        n = "-" + n.substring(0, n.length - 1);
                    }
                }
                if (currency === "JPY" || currency === "TWD" || currency === "VND") {
                    decimal = 0;
                } else if (currency === "USD") {
                    decimal = 5;
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

        // format Float, two decimal + thousandths
        formatFloat: function (n, decimal) {
            if (n) {
                var sign = "";
                if (typeof n === "string") {
                    var bNegative = n.endsWith("-");
                    if (bNegative) {
                        n = "-" + n.substring(0, n.length - 1);
                    }
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

        formatOrderStatus: function (value) {
            var sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
            var sStatusText1 = "",
                sStatusText2 = "";
            switch (sLanguage) {
                case "EN":
                    sStatusText1 = "Finished";
                    sStatusText2 = "Unfinished";
                    break;
                case "ZH":
                    sStatusText1 = "完了";
                    sStatusText2 = "未完了";
                    break;
                default:
                    sStatusText1 = "完了";
                    sStatusText2 = "未完了";
                    break;
            }
            if (value) {
                return sStatusText1;
            } else {
                return sStatusText2;
            }
        },
    };
});