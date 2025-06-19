sap.ui.define([
    "sap/fe/core/AppComponent",
    "pp/zumespostingdatemgt/ext/controller/ListReportExt"
], function (Component, ListReportExt) {
    "use strict";

    return Component.extend("pp.zumespostingdatemgt.Component", {

        ListReportExt: ListReportExt,

        metadata: {
            manifest: "json"
        },

        onAfterRendering: function () {
            ListReportExt.init(this.oModels);
        }
    });
});