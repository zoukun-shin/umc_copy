sap.ui.define([
    "sap/fe/core/AppComponent",
    "fico/zaccountmapping/ext/controller/ListReportExt"
], function (Component, ListReportExt) {
    "use strict";

    return Component.extend("fico.zaccountmapping.Component", {

        ListReportExt: ListReportExt,

        metadata: {
            manifest: "json"
        },

        onAfterRendering: function () {
            this.ListReportExt.getAuthorityData(this.oModels, this._oViews);
        }
    });
});