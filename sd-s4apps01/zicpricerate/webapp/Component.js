sap.ui.define([
    "sap/fe/core/AppComponent",
    "sd/zicpricerate/ext/controller/ListReportAuth"
],
    function (Component, ListReportAuth) {
        "use strict";

        return Component.extend("sd.zicpricerate.Component", {
            ListReportAuth: ListReportAuth,
            metadata: {
                manifest: "json"
            },
            onAfterRendering: function () {
                ListReportAuth.init(this.oModels, this._oViews);
            }
        });
    }
);
