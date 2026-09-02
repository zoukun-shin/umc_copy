sap.ui.define([
    "sap/ui/core/format/DateFormat",
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

        setResult: function (v) {
            if (v === "S") {
                return "成功";
            }
            if (v === "E") {
                return "失敗";
            }
            if (v === "W") {
                return "警告";
            }
            return "";
        },

        setRate: function (v) {
            return v + "%";
        },

        // 0000/00/00
        date: function (value) {
            if (value) {
                let localDate = new Date(value);
                if (!isNaN(localDate.getTime()) && value.ms) {
                    var oDateFormat = DateFormat.getDateTimeInstance({
                        pattern: "yyyy/MM/dd"
                    });
                    return oDateFormat.format(new Date(value));
                } else {
                    if (value.length === 8){
                        return value.substring(0, 4) + "/" + value.substring(4, 6) + "/" + value.substring(6);
                    }
                }
                return value;
            }
        },

        // 00:00:00
        time: function (value) {
            if (value) {
                let localDate = new Date(value);
                if (!isNaN(localDate.getTime()) && value.ms) {
                    var timeFormat = DateFormat.getTimeInstance({
                        pattern: "HH:mm:ss"
                    });
                    if (value.ms !== 0) {
                        return timeFormat.format(new Date(value.ms), true);
                    }
                    return null;
                } else {
                    if (value.length === 6){
                        return value.substring(0, 2) + ":" + value.substring(2, 4) + ":" + value.substring(4);
                    }
                }
                return value;
            }
        },

        // OData日期类型格式化
        odataDate: function (v) {
            var odataDate = new Date(v); //只能接收"/""-",""，之类的符号间隔 在中文环境下，年月日的格式无法处理，所以要么在外部转换格式，要么直接传入日期格式
            if ( isNaN(odataDate.getTime()) ) {
                return "";
            }
            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd"
            });
            var odataDateString = oDateFormat.format(odataDate, false);
            return new Date(odataDateString + "T00:00:00Z");
        },

        stringToDate: function (value) {
            if (value) {
                if (Number(value) === 0) {
                    return "";
                } else {
                    return value.substring(0, 4) + "/" + value.substring(4, 6) + "/" + value.substring(6);
                }
            }
            return value;
        },

        // 如果字符全部为0 则显示空白
        allZeroToBlank: function (value) {
            if (value) {
                if (Number(value) === 0) {
                    return "";
                }
                return value;
            }
            return value;
        },

        removeLeadingZero: function (value) {
            if (value) {
                if (Number(value) === 0) {
                    return "";
                }
                return Number(value).toString();
            }
            return value;
        },

        convertLocalDateToUTCDate: function (localDate = new Date()) {
            let timezoneOffset = localDate.getTimezoneOffset();
            let utcDate = new Date(localDate.getTime() - timezoneOffset * 60000);
            return utcDate;
        },

        convertISOString: function (v) {
            let localDate = new Date(v);
            if(!isNaN(localDate.getTime)){
                return localDate.toISOString().slice(0,10);
            } else {
                return v;
            }
        },

        dateFormatter: function(date, sPattern){
            var dDate = new Date(date);
            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: sPattern
            });
            return oDateFormat.format(dDate, false);
        }
    };
});
