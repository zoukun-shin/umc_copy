sap.ui.define([
    "sap/ui/core/format/DateFormat"
], function (DateFormat) {
    "use strict";
    return {
           setState: function (v) {
            if (v === "S") {
                return "Success";
            }
            if (v === "E") {
                return "Error";
            }
            if (v === "W") {
                return "Warning";
            }
            return "None";
        },

        setStateIcon: function (v) {
            if (v === "S") {
                return "sap-icon://status-positive";
            }
            if (v === "E") {
                return "sap-icon://status-negative";
            }
            if (v === "W") {
                return "sap-icon://status-critical";
            }
            return "sap-icon://status-inactive";
        },
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

        formatResult: function (v) {
            if (v === "S") {
                return "Success";
            }
            if (v === "E") {
                return "Error";
            }
            return "";
        },
        // 0000/00/00
        date: function (value) {
            if (value) {
                let localDate = new Date(value);
                if (!isNaN(localDate.getTime())) {
                    var oDateFormat = DateFormat.getDateTimeInstance({
                        pattern: "yyyy/MM/dd"
                    });
                    return oDateFormat.format(new Date(value));
                } else {
                    if (value.length === 8) {
                        return value.substring(0, 4) + "/" + value.substring(4, 6) + "/" + value.substring(6);
                    }
                }
                return value;
            }
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
        
        odataDate: function (sDate) {
			var oDate = new Date(sDate);
			var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
				pattern: "yyyy-MM-dd"
			});
			var sFormatDate = oDateFormat.format(oDate, false);
			return new Date(sFormatDate);
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
            }
        }
    };
});