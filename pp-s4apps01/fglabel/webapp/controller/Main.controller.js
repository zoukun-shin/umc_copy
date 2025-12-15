sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/export/Spreadsheet"
], (Base, formatter, BusyDialog, MessageBox, MessageToast, Filter, FilterOperator, Fragment, Spreadsheet) => {
    "use strict";

    return Base.extend("pp.fglabel.controller.Main", {
        formatter: formatter,

        onInit() {

        }
    });
});
