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

        // 目标工厂是否有在库：X=YES 空=NO
        stockIndicator: function (v) {
            if (v === "X") {
                return "YES";
            }
            return "NO";
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

        // ★ format Time（Edm.Time → HH:mm:ss）
        //
        // 修正两个问题：
        //  1) 时区偏移：Edm.Time 的 ms 是「当天0点起的毫秒数」（时长），不是时刻。
        //     原来 DateFormat.getTimeInstance().format(new Date(value.ms)) 会按
        //     本地时区解释，GMT+8 下 09:30:00 会显示成 17:30:00（多8小时）。
        //     改用 UTC 取时分秒即可。
        //  2) 空值：Edm.Time 空值也是个对象（{ms: 0} 或 {}），if(value) 恒为 true，
        //     原来会显示成 08:00:00。改为判断 ms 是否为有效数字。
        formatTime: function (value) {
            if (value === undefined || value === null || value === "") {
                return "";
            }

            // Edm.Time → {ms: 毫秒数, __edmType: "Edm.Time"}；也兼容直接传数字
            var iMs = (typeof value === "object") ? value.ms : value;
            if (typeof iMs !== "number" || isNaN(iMs)) {
                return "";
            }

            var oDate = new Date(iMs);
            var pad = function (n) { return String(n).padStart(2, "0"); };

            // 必须用 UTC，否则会被本地时区偏移
            return pad(oDate.getUTCHours()) + ":" +
                   pad(oDate.getUTCMinutes()) + ":" +
                   pad(oDate.getUTCSeconds());
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