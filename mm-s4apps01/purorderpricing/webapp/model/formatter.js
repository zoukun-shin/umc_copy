sap.ui.define([
    "sap/ui/core/format/DateFormat",
], function (DateFormat) {
    "use strict";
    return {
        setState: function (v) {
            if (v === "S") { return "Success"; }
            if (v === "E") { return "Error"; }
            if (v === "W") { return "Warning"; }
            return "None";
        },

        setStateIcon: function (v) {
            if (v === "S") { return "sap-icon://status-positive"; }
            if (v === "E") { return "sap-icon://status-negative"; }
            if (v === "W") { return "sap-icon://status-critical"; }
            return "sap-icon://status-inactive";
        },

        date: function (value) {
            if (value) {
                var localDate = new Date(value);
                if (!isNaN(localDate.getTime()) && value.ms) {
                    var oDateFormat = DateFormat.getDateTimeInstance({ pattern: "yyyy/MM/dd" });
                    return oDateFormat.format(new Date(value));
                } else {
                    if (value.length === 8) {
                        return value.substring(0, 4) + "/" + value.substring(4, 6) + "/" + value.substring(6);
                    }
                }
                return value;
            }
        },

        removeLeadingZero: function (value) {
            if (value) {
                if (Number(value) === 0) { return ""; }
                return Number(value).toString();
            }
            return value;
        }
    };
});