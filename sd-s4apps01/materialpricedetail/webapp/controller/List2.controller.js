sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "sap/ui/export/Spreadsheet",
], (Base, formatter, BusyDialog, MessageBox, MessageToast, Filter, FilterOperator, Fragment, Spreadsheet) => {
    "use strict";

    return Base.extend("sd.materialpricedetail.controller.List2", {
        formatter: formatter,
        onInit() {
            var that = this;
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._oDataModel.setRefreshAfterChange(false);
            this._BusyDialog = new BusyDialog();
            if (sap.ushell && sap.ushell.Container) {
                this._UserInfo = sap.ushell.Container.getService("UserInfo").getUser();
            };
        },

        onBeforeRebindTable: function (oEvent) {
            let afilters = oEvent.getParameters().bindingParams.filters;
            var oGjahr = new Date(this.byId("idGjahr2").getValue());
            afilters.push(new sap.ui.model.Filter( "Gjahr", "EQ", oGjahr.getFullYear()));
            var oMonth = this.byId("idMonat2");
            if (oMonth) {
                var aMonth = oMonth.getSelectedKeys();
                aMonth.forEach((e) => {
                    afilters.push(new sap.ui.model.Filter( "Monat", "EQ", e));
                })
            };

            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            afilters.push(new sap.ui.model.Filter("UserEmail", "EQ", sEmail));
            //Tab2
            afilters.push(new sap.ui.model.Filter("Type", "EQ", "2"));
        },

        onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("title2");
            this._exportExcel(mExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    //  Date
                    case "PostingDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    case "DemandTotal":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 3;
                        oColumn.textAlign = "End";
                        break;
                    case "Demand":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 3;
                        oColumn.textAlign = "End";
                        break;
                    case "RemainDemand":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 3;
                        oColumn.textAlign = "End";
                        break;
                    case "Quantity":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 3;
                        oColumn.textAlign = "End";
                        break;
                    case "UnitPrice":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.delimiter = true;
                        oColumn.scale = 5;
                        oColumn.textAlign = "End";
                        break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }

    });
});