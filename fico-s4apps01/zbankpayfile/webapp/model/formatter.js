sap.ui.define([
    "sap/ui/core/format/DateFormat"
], function (DateFormat) {
    "use strict";

    function toDate(value) {
        if (!value) { return null; }
        if (value instanceof Date) { return isNaN(value.getTime()) ? null : value; }
        var s = String(value);
        if (/^\d{8}$/.test(s)) {
            return new Date(Number(s.substring(0, 4)), Number(s.substring(4, 6)) - 1, Number(s.substring(6)));
        }
        var d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    return {
        // yyyy/MM/dd
        date: function (value) {
            var d = toDate(value);
            if (!d) { return value; }
            return DateFormat.getDateInstance({ pattern: "yyyy/MM/dd" }).format(d);
        },

        // yyyyMMdd
        dateYmd: function (value) {
            var d = toDate(value);
            if (!d) { return value; }
            return DateFormat.getDateInstance({ pattern: "yyyyMMdd" }).format(d);
        },

        // yyyy-MM-dd
        dateIso: function (value) {
            var d = toDate(value);
            if (!d) { return value; }
            return DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" }).format(d);
        },

        // 千分位 + 2位小数
        amount: function (value) {
            if (value === null || value === undefined || value === "") { return value; }
            var num = Number(value);
            if (isNaN(num)) { return value; }
            return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
    };
});